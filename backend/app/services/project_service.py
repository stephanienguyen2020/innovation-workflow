from fastapi import HTTPException, UploadFile
from google.cloud.firestore_v1.async_client import AsyncClient
import asyncio
import tempfile
import os
import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, AsyncGenerator, Any
import uuid
from pydantic import BaseModel, Field

from app.database.query.db_project import (
    create_project,
    get_project as db_get_project,
    get_projects_by_user_id,
    get_project_pdf_data,
    get_stage,
    update_stage_1,
    update_stage_2,
    update_stage_3,
    update_stage_4,
    update_document_id,
    update_original_file,
    delete_all_data,
    delete_project as db_delete_project
)
from app.schema.project import Project, Stage, Stage1Data
from app.services.rag_service import rag_service
from app.services.agent_service import agent_service
from app.services.image_service import image_service
from app.services.file_service import file_service
from app.constant.status import StageStatus
from app.prompts.assistant import ProjectPrompts

# Initialize logger
logger = logging.getLogger(__name__)

# Simplified Pydantic model for analysis
class DocumentAnalysis(BaseModel):
    content: str = Field(..., description="Concise analysis paragraph about the document")

class AnalysisResponse(BaseModel):
    analysis: DocumentAnalysis

class ProjectService:
    @staticmethod
    async def create_project(db: AsyncClient, user_id: str, problem_domain: str) -> Project:
        """
        Create a new project.
        
        Args:
            db: Database session
            user_id: User ID
            problem_domain: Domain or area the project will focus on
            
        Returns:
            Newly created project
        """
        return await create_project(db, user_id, problem_domain)

    @staticmethod
    async def get_user_projects(db: AsyncClient, user_id: str) -> List[Project]:
        """
        Get all projects belonging to a specific user.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of projects belonging to the user
        """
        return await get_projects_by_user_id(db, user_id)

    @staticmethod
    async def get_project_by_id(db: AsyncClient, project_id: str, user_id: str = None) -> Project:
        """
        Get project by ID with optional user validation.
        
        Args:
            db: Database session
            project_id: Project ID
            user_id: Optional user ID to validate project ownership
            
        Returns:
            Project if found and belongs to user (if user_id provided)
        """
        return await db_get_project(db, project_id, user_id)

    @staticmethod
    async def get_stage(db: AsyncClient, project_id: str, stage_number: int, user_id: str) -> Stage:
        """Get specific stage of a project."""
        project = await db_get_project(db, project_id, user_id)
        return next((stage for stage in project.stages if stage.stage_number == stage_number), None)

    @staticmethod
    async def save_stage_progress(
        db: AsyncClient, project_id: str, stage_number: int, data: dict, status: str, user_id: str
    ) -> Stage:
        """Save progress for a specific stage."""
        from app.database.database import session_manager
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        stage = next((s for s in project.stages if s.stage_number == stage_number), None)
        if not stage:
            raise HTTPException(status_code=404, detail="Stage not found")

        # Update stage data and status
        if data:
            stage.data = {**stage.data, **data} if stage.data else data
        if status in ("completed", "in_progress", "not_started"):
            stage.status = status
        stage.updated_at = datetime.utcnow()
        project.updated_at = datetime.utcnow()

        # Save to Firestore
        doc_ref = db.collection("projects").document(project_id)
        stages_data = [s.dict() for s in project.stages]
        await doc_ref.update({"stages": stages_data, "updated_at": project.updated_at})

        return stage

    @staticmethod
    async def upload_document(db: AsyncClient, project_id: str, file: UploadFile, user_id: str) -> Stage:
        """
        Stage 1 - Part 1: Upload PDF and store document ID.
        
        Args:
            db: Database session
            project_id: Project ID
            file: Uploaded PDF file
            user_id: User ID for authorization
            
        Returns:
            Stage 1 with document ID
        """
        print(f"DEBUG: upload_document called with project_id={project_id}, user_id={user_id}")
        project = await db_get_project(db, project_id, user_id)
        if not project:
            print(f"DEBUG: Project not found for id={project_id} and user={user_id}")
            raise HTTPException(status_code=404, detail="Project not found")

        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        # Read the file content once
        content = await file.read()

        # Create temporary directory for file processing
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = os.path.join(temp_dir, file.filename)
            
            # Save uploaded file to temp directory for RAG processing
            with open(pdf_path, 'wb') as temp_file:
                temp_file.write(content)

            try:
                # Store the original file in the database
                original_file_id = await file_service.store_file(
                    file_data=content,
                    filename=file.filename,
                    content_type="application/pdf",
                    project_id=project_id,
                    user_id=user_id
                )
                
                # Update project with original file info
                await update_original_file(db, project_id, original_file_id, file.filename)
                
                # Ingest PDF using directory reader and get document ID for RAG
                parent_doc_id = await rag_service.ingest_documents_from_directory(
                    temp_dir,
                    filename=file.filename
                )
                
                # Update document ID and get project
                project = await update_document_id(db, project_id, parent_doc_id)
                
                # Return stage 1 data
                return project.stages[0]

            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

    @staticmethod
    async def upload_text(db: AsyncClient, project_id: str, text: str, user_id: str) -> Stage:
        """
        Stage 1 - Part 1 (alt): Upload plain text and store as a document for RAG.
        """
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        try:
            # Ingest the text into RAG storage
            doc_id = await rag_service.ingest_text(
                text,
                metadata={
                    "project_id": project_id,
                    "source": "pasted_text",
                    "filename": "pasted_text.txt",
                }
            )

            # Update document ID on the project
            project = await update_document_id(db, project_id, doc_id)

            return project.stages[0]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error uploading text: {str(e)}")

    @staticmethod
    async def analyze_document(db: AsyncClient, project_id: str, user_id: str) -> Stage:
        """
        Stage 1 - Part 2: Generate analysis for the uploaded document.

        Args:
            db: Database session
            project_id: Project ID
            user_id: User ID for authorization

        Returns:
            Stage 1 with analysis
        """
        # Get project and validate document ID
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        if not project.document_id:
            raise HTTPException(status_code=400, detail="No document uploaded. Please upload a document first.")

        try:
            # Create query engine
            query_engine = await rag_service.create_document_query_engine(project.document_id)
            
            # Create tools for the agent
            tools = agent_service.create_document_analysis_tools(query_engine, stage_number=1)
            
            # Create agent and run analysis
            agent = agent_service.create_agent(tools)
            response = await agent_service.run_analysis(
                agent,
                ProjectPrompts.STAGE_1_ANALYSIS,
                context={
                    "problem_domain": project.problem_domain
                }
            )
            
            try:
                # Parse and validate the response using Pydantic
                if isinstance(response, str):
                    response_dict = json.loads(response)
                else:
                    response_dict = response
                    
                analysis_response = AnalysisResponse(**response_dict)
                
                # Update stage 1 with the analysis paragraph
                updated_project = await update_stage_1(
                    db, 
                    project_id, 
                    analysis=analysis_response.analysis.content,
                )
                return updated_project.stages[0]
                
            except (json.JSONDecodeError, ValueError) as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Invalid response format from agent: {str(e)}"
                )

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error analyzing document: {str(e)}")

    @staticmethod
    async def analyze_document_stream(
        db: AsyncClient, project_id: str, user_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        project = await db_get_project(db, project_id, user_id)
        if not project:
            yield {"event": "error", "data": {"message": "Project not found"}}
            return

        if not project.document_id:
            yield {"event": "error", "data": {"message": "No document uploaded. Please upload a document first."}}
            return

        try:
            # Read raw document text directly from Firestore (no LLM call needed)
            print(f"DEBUG STREAM: Starting analysis for project {project_id}, document_id={project.document_id}")
            yield {"event": "status", "data": {"message": "Reading document content..."}}
            doc_content = await rag_service.get_document_text(project.document_id)
            print(f"DEBUG STREAM: Got document text, length={len(doc_content)}")

            if not doc_content.strip():
                yield {"event": "error", "data": {"message": "Document content is empty."}}
                return

            yield {"event": "status", "data": {"message": "Generating analysis..."}}
            print(f"DEBUG STREAM: Calling Gemini for analysis...")

            problem_domain = project.problem_domain
            streaming_prompt = f"""Based on the following document content, analyze it to understand what it reveals about the {problem_domain} context.

DOCUMENT CONTENT:
{doc_content}

Provide a focused analysis (150-250 words) that:
1. Identifies what type of document this is
2. Explains the context relevant to {problem_domain}
3. Highlights specific problems or challenges that emerge
4. Suggests opportunities for innovation

Write the analysis as a single coherent paragraph. Do NOT use JSON formatting, markdown, or bullet points. Just write plain text."""

            # Use google-genai SDK for streaming
            from app.constant.config import GEMINI_MODEL

            full_text = ""
            try:
                client = agent_service.native_client
                print(f"DEBUG STREAM: Using model: {GEMINI_MODEL}, prompt length: {len(streaming_prompt)} chars")

                response = client.models.generate_content_stream(
                    model=GEMINI_MODEL,
                    contents=streaming_prompt,
                )
                print(f"DEBUG STREAM: Got response iterator, reading chunks...")
                for chunk in response:
                    delta = chunk.text
                    if delta:
                        full_text += delta
                        print(f"DEBUG STREAM: Chunk received, length={len(delta)}")
                        yield {"event": "chunk", "data": {"text": delta}}
                print(f"DEBUG STREAM: Streaming complete, total length={len(full_text)}")
            except Exception as e:
                print(f"DEBUG STREAM: Gemini streaming failed: {type(e).__name__}: {e}")
                import asyncio
                # Retry once with same model
                print(f"DEBUG STREAM: Retry attempt 1, waiting 3s...")
                await asyncio.sleep(3)
                try:
                    response = agent_service.native_client.models.generate_content(
                        model=GEMINI_MODEL,
                        contents=streaming_prompt,
                    )
                    full_text = response.text
                    print(f"DEBUG STREAM: Retry succeeded, length={len(full_text)}")
                    yield {"event": "chunk", "data": {"text": full_text}}
                except Exception as retry_err:
                    print(f"DEBUG STREAM: Retry failed: {retry_err}")
                    # Fall back to flash model
                    try:
                        fallback_model = "gemini-3-flash-preview"
                        print(f"DEBUG STREAM: Trying fallback model: {fallback_model}")
                        response = agent_service.native_client.models.generate_content(
                            model=fallback_model,
                            contents=streaming_prompt,
                        )
                        full_text = response.text
                        print(f"DEBUG STREAM: Fallback succeeded, length={len(full_text)}")
                        yield {"event": "chunk", "data": {"text": full_text}}
                    except Exception as fallback_err:
                        print(f"DEBUG STREAM: Fallback also failed: {fallback_err}")
                        yield {"event": "error", "data": {"message": "Gemini API is temporarily unavailable. Please try again in a moment."}}
                        return

            cleaned_text = full_text.strip()
            if cleaned_text.startswith('"') and cleaned_text.endswith('"'):
                cleaned_text = cleaned_text[1:-1]

            yield {"event": "done", "data": {"analysis": cleaned_text}}

            if cleaned_text:
                await update_stage_1(db, project_id, analysis=cleaned_text)

        except Exception as e:
            logger.error(f"Error in streaming analysis: {e}", exc_info=True)
            yield {"event": "error", "data": {"message": f"Error analyzing document: {str(e)}"}}

    @staticmethod
    async def process_stage_2(db: AsyncClient, project_id: str, user_id: str) -> Stage:
        """
        Process stage 2: Generate problem statements based on analysis.
        """
        # Get project and validate stage 1
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        stage_1 = next((stage for stage in project.stages if stage.stage_number == 1), None)
        if not stage_1 or stage_1.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 1 must be completed first")
            
        analysis = stage_1.data.get("analysis")
        if not analysis:
            raise HTTPException(status_code=400, detail="Stage 1 analysis is missing")

        # Read raw document text for additional context (fast Firestore read, no LLM)
        doc_text = await rag_service.get_document_text(project.document_id)

        # Build prompt with all context — single direct LLM call, no RAG overhead
        enriched_prompt = ProjectPrompts.STAGE_2_PROBLEMS + (
            f"\n\nORIGINAL DOCUMENT CONTENT (for reference):\n{doc_text}" if doc_text else ""
        )
        response = await agent_service.generate_json(
            enriched_prompt,
            context={
                "analysis": analysis,
                "problem_domain": project.problem_domain
            }
        )

        try:
            # Check if response is empty or None
            if not response or (isinstance(response, str) and not response.strip()):
                raise HTTPException(
                    status_code=500,
                    detail="Agent returned empty response. Check model configuration and prompt formatting."
                )

            # Handle different response formats
            if isinstance(response, str) and "Sorry, I can't assist with that" in response:
                raise HTTPException(status_code=500, detail="Failed to generate problem statements")
                
            # Parse the response into structured format
            if isinstance(response, dict):
                problem_data = response
            else:
                # Clean up response string before parsing
                response_str = str(response).strip()
                if not response_str:
                    raise HTTPException(status_code=500, detail="Agent returned empty string response")
                problem_data = json.loads(response_str)
            
            # Validate problem statements structure
            if not problem_data.get("problem_statements") or not isinstance(problem_data["problem_statements"], list):
                raise HTTPException(
                    status_code=500,
                    detail="Invalid problem statements format received from agent"
                )
            
            # Format stage data
            stage_data = {
                "problem_statements": problem_data["problem_statements"],
                "custom_problems": []  # Initialize empty custom problems list
            }
            
            updated_project = await update_stage_2(
                db,
                project_id,
                stage_data
            )
            return next(stage for stage in updated_project.stages if stage.stage_number == 2)
            
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error processing response: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response format from agent: {str(e)}"
            )

    @staticmethod
    async def process_stage_3(
        db: AsyncClient, 
        project_id: str,
        user_id: str,
        selected_problem_id: Optional[str] = None,
        custom_problem: Optional[str] = None,
    ) -> Stage:
        """
        Process stage 3: Generate product ideas based on a single selected or custom problem statement.

        Args:
            db: Database session
            project_id: Project ID
            user_id: User ID for authorization
            selected_problem_id: ID of a problem selected from stage 2 (mutually exclusive with custom_problem)
            custom_problem: New problem statement as string (mutually exclusive with selected_problem_id)

        Returns:
            Updated stage 3 data
        """
        logger.info(f"Starting process_stage_3 for project {project_id}")
        # Get project and validate prior stages
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        stage_1 = next((stage for stage in project.stages if stage.stage_number == 1), None)
        stage_2 = next((stage for stage in project.stages if stage.stage_number == 2), None)
        
        if not stage_1 or stage_1.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 1 must be completed first")
        if not stage_2 or stage_2.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 2 must be completed first")
            
        analysis = stage_1.data.get("analysis")
        all_problem_statements = stage_2.data.get("problem_statements", [])
        
        # Validate input parameters
        if selected_problem_id and custom_problem:
            raise HTTPException(
                status_code=400,
                detail="Cannot provide both selected_problem_id and custom_problem"
            )
        if not selected_problem_id and not custom_problem:
            raise HTTPException(
                status_code=400,
                detail="Must provide either selected_problem_id or custom_problem"
            )

        selected_problem = None
        
        # Handle selected problem from stage 2
        if selected_problem_id:
            selected_problem = next(
                (p for p in all_problem_statements if p.get("id") == selected_problem_id),
                None
            )
            if not selected_problem:
                raise HTTPException(
                    status_code=400,
                    detail=f"Problem with ID {selected_problem_id} not found"
                )
        
        # Handle custom problem
        if custom_problem:
            if not isinstance(custom_problem, str) or not custom_problem.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Custom problem must be a non-empty string"
                )
            
            # Create new problem statement
            custom_problem_id = str(uuid.uuid4())
            selected_problem = {
                "id": custom_problem_id,
                "problem": custom_problem,
                "explanation": custom_problem,  # Use same text for both fields
                "is_custom": True
            }
            
            # Add to stage 2's custom problems
            stage_data = {
                "problem_statements": all_problem_statements,
                "custom_problems": stage_2.data.get("custom_problems", []) + [selected_problem]
            }
            
            # Update stage 2 with the new custom problem
            await update_stage_2(
                db,
                project_id,
                stage_data
            )
            
        # Read raw document text for additional context (fast Firestore read, no LLM)
        doc_text = await rag_service.get_document_text(project.document_id)

        # Single direct LLM call — no RAG overhead
        enriched_prompt = ProjectPrompts.STAGE_3_IDEAS + (
            f"\n\nORIGINAL DOCUMENT CONTENT (for reference):\n{doc_text}" if doc_text else ""
        )
        response = await agent_service.generate_json(
            enriched_prompt,
            context={
                "analysis": analysis,
                "problem_statements": [selected_problem],
                "problem_domain": project.problem_domain
            }
        )

        try:
            ideas_data = response if isinstance(response, dict) else json.loads(response)
            logger.info(f"✅ Parsed ideas data, found {len(ideas_data.get('product_ideas', []))} ideas")

            # Ensure image service has database connection
            if image_service.db is None:
                image_service.set_db(db)

            # Assign IDs and problem references
            for idea in ideas_data["product_ideas"]:
                idea["problem_id"] = selected_problem["id"]
                idea["id"] = idea.get("id", str(uuid.uuid4()))

            # Generate images for all ideas IN PARALLEL
            async def generate_image_for_idea(idea):
                try:
                    logger.info(f"Starting image generation for idea: {idea['idea']}")
                    image_url = await image_service.generate_product_image(
                        idea_title=idea["idea"],
                        detailed_explanation=idea["detailed_explanation"],
                        problem_domain=project.problem_domain,
                        project_id=project_id,
                        idea_id=idea["id"],
                    )
                    idea["image_url"] = image_url
                    logger.info(f"✅ Generated image for idea '{idea['idea']}'")
                except Exception as e:
                    logger.error(f"❌ Failed to generate image for idea '{idea['idea']}': {str(e)}")
                    idea["image_url"] = None

            await asyncio.gather(
                *[generate_image_for_idea(idea) for idea in ideas_data["product_ideas"]]
            )

            # Update stage 3 with product ideas
            updated_project = await update_stage_3(
                db,
                project_id,
                {
                    "product_ideas": ideas_data["product_ideas"]
                }
            )
            return next(stage for stage in updated_project.stages if stage.stage_number == 3)
        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response format from agent: {str(e)}"
            )

    @staticmethod
    async def process_stage_4(
        db: AsyncClient, 
        project_id: str,
        chosen_solution_id: str,
        user_id: str
    ) -> Dict:
        """
        Process stage 4: Update chosen solution and return formatted data.
        
        Args:
            db: Database session
            project_id: Project ID
            chosen_solution_id: ID of the solution chosen by the user
            user_id: User ID for authorization
            
        Returns:
            Dictionary containing formatted project data
        """
        # Get project and validate all prior stages
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        # Validate all prior stages are complete
        for stage_num in range(1, 4):
            stage = next((s for s in project.stages if s.stage_number == stage_num), None)
            if not stage or stage.status != StageStatus.COMPLETED:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stage {stage_num} must be completed first"
                )
        
        try:
            # Find chosen solution from stage 3
            stage_3 = next((s for s in project.stages if s.stage_number == 3), None)
            product_ideas = stage_3.data.get("product_ideas", [])
            chosen_solution = next((idea for idea in product_ideas if idea.get("id") == chosen_solution_id), None)

            if not chosen_solution:
                raise HTTPException(status_code=404, detail=f"Solution with ID {chosen_solution_id} not found in stage 3")

            # Update stage 4 with the full chosen solution object
            await update_stage_4(
                db,
                project_id,
                {"chosen_solution": chosen_solution}
            )
            
            # Find the chosen problem from stage 2
            stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
            problem_statements = stage_2.data.get("problem_statements", [])
            chosen_problem = next((p for p in problem_statements if p.get("id") == chosen_solution.get("problem_id")), None)
            
            # Return formatted data for the report
            return {
                "title": f"Innovation Report for {project.problem_domain}",
                "analysis": project.stages[0].data.get("analysis", ""),
                "chosen_problem": {
                    "statement": chosen_problem.get("problem", "Problem not found") if chosen_problem else "Problem not found",
                    "explanation": chosen_problem.get("explanation", "") if chosen_problem else ""
                },
                "chosen_solution": {
                    "idea": chosen_solution.get("idea"),
                    "explanation": chosen_solution.get("detailed_explanation"),
                    "image_url": chosen_solution.get("image_url") # Ensure image_url is returned
                }
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error processing stage 4: {str(e)}"
            )

    @staticmethod
    async def proxy_image(image_url: str) -> bytes:
        """
        Proxy an image from a URL, fetching it on the server side.
        
        Args:
            image_url: The URL of the image to fetch.
            
        Returns:
            The image content in bytes.
        """
        image_bytes = image_service.download_image(image_url)
        if not image_bytes:
            raise HTTPException(status_code=404, detail="Image not found or could not be downloaded")
        return image_bytes

    @staticmethod
    async def get_project_pdf(db: AsyncClient, project_id: str) -> bytes:
        """
        Generate PDF from project data.
        
        Args:
            db: Database session
            project_id: Project ID
            
        Returns:
            PDF bytes
        """
        try:
            # Get formatted project data
            pdf_data = await get_project_pdf_data(db, project_id)
            
            # TODO: Implement actual PDF generation using a library like ReportLab
            # For now, return a simple formatted string as bytes
            pdf_content = f"""
            {pdf_data['title']}
            
            Analysis:
            {pdf_data['analysis']}
            
            Problem:
            Statement: {pdf_data['chosen_problem']['statement']}
            Explanation: {pdf_data['chosen_problem']['explanation']}
            
            Solution:
            Idea: {pdf_data['chosen_solution']['idea']}
            Explanation: {pdf_data['chosen_solution']['explanation']}
            """
            
            return pdf_content.encode('utf-8')
            
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    @staticmethod
    async def regenerate_idea_image(
        db: AsyncClient,
        project_id: str,
        idea_id: str,
        user_id: str,
        feedback: str = None,
    ) -> Dict:
        """
        Regenerate image for a specific product idea.

        Args:
            db: Database session
            project_id: Project ID
            idea_id: ID of the idea to regenerate image for
            user_id: User ID for authorization
            feedback: Optional user feedback on what to change in the visualization

        Returns:
            Dictionary containing the updated idea with new image URL
        """
        # Get project and validate access
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        # Find stage 3
        stage_3 = next((stage for stage in project.stages if stage.stage_number == 3), None)
        if not stage_3 or stage_3.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 3 must be completed first")
            
        # Find the specific idea
        product_ideas = stage_3.data.get("product_ideas", [])
        idea_index = None
        target_idea = None
        
        for i, idea in enumerate(product_ideas):
            if idea.get("id") == idea_id:
                idea_index = i
                target_idea = idea
                break
                
        if target_idea is None:
            raise HTTPException(status_code=404, detail="Idea not found")
            
        # Ensure image service has database connection
        if image_service.db is None:
            image_service.set_db(db)
        
        try:
            # Get old image URL for cleanup
            old_image_url = target_idea.get("image_url")
            
            new_image_url = await image_service.regenerate_product_image(
                idea_title=target_idea["idea"],
                detailed_explanation=target_idea["detailed_explanation"],
                problem_domain=project.problem_domain,
                project_id=project_id,
                idea_id=idea_id,
                old_image_id=old_image_url,
                feedback=feedback,
            )
            
            # Update the idea with new image URL
            product_ideas[idea_index]["image_url"] = new_image_url
            
            # Update stage 3 in database
            updated_project = await update_stage_3(
                db,
                project_id,
                {
                    "product_ideas": product_ideas
                }
            )
            
            print(f"Regenerated image for idea '{target_idea['idea']}': {new_image_url}")
            
            return {
                "idea_id": idea_id,
                "image_url": new_image_url,
                "success": True
            }
            
        except Exception as e:
            print(f"Failed to regenerate image for idea '{target_idea['idea']}': {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to regenerate image: {str(e)}"
            )

    @staticmethod
    async def regenerate_idea(
        db: AsyncClient,
        project_id: str,
        idea_id: str,
        user_id: str,
        feedback: str,
    ) -> Dict:
        """
        Regenerate (iterate on) a specific product idea using user feedback.

        Implements professor's Prompt 3: given the original idea and user feedback,
        generate one improved idea that is preferred by users.

        Args:
            db: Database session
            project_id: Project ID
            idea_id: ID of the idea to improve
            user_id: User ID for authorization
            feedback: User feedback on what to improve in the idea

        Returns:
            Dictionary containing the updated idea with the improved content and new image URL
        """
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        stage_1 = next((s for s in project.stages if s.stage_number == 1), None)
        stage_3 = next((s for s in project.stages if s.stage_number == 3), None)

        if not stage_3 or stage_3.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 3 must be completed first")

        product_ideas = stage_3.data.get("product_ideas", [])
        idea_index = None
        target_idea = None
        for i, idea in enumerate(product_ideas):
            if idea.get("id") == idea_id:
                idea_index = i
                target_idea = idea
                break

        if target_idea is None:
            raise HTTPException(status_code=404, detail="Idea not found")

        analysis = stage_1.data.get("analysis", "") if stage_1 else ""

        # Find the problem statement associated with this idea
        stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
        problem_statements = stage_2.data.get("problem_statements", []) if stage_2 else []
        problem_id = target_idea.get("problem_id")
        selected_problem = next(
            (p for p in problem_statements if p.get("id") == problem_id),
            {"problem": target_idea.get("idea", ""), "explanation": ""}
        )

        response = await agent_service.generate_json(
            ProjectPrompts.STAGE_3_IDEAS_ITERATION,
            context={
                "problem_domain": project.problem_domain,
                "analysis": analysis,
                "problem_statements": selected_problem,
                "original_idea": f"{target_idea['idea']}\n\n{target_idea['detailed_explanation']}",
                "feedback": feedback,
            }
        )

        try:
            result = response if isinstance(response, dict) else json.loads(response)
            improved = result.get("improved_idea", {})

            if not improved:
                raise HTTPException(status_code=500, detail="No improved idea returned from agent")

            # Preserve the original idea's ID and problem reference
            improved["id"] = idea_id
            improved["problem_id"] = problem_id

            # Ensure image service has database connection
            if image_service.db is None:
                image_service.set_db(db)

            # Delete old image and generate a new one for the improved idea
            old_image_url = target_idea.get("image_url")
            new_image_url = await image_service.regenerate_product_image(
                idea_title=improved["idea"],
                detailed_explanation=improved["detailed_explanation"],
                problem_domain=project.problem_domain,
                project_id=project_id,
                idea_id=idea_id,
                old_image_id=old_image_url,
                feedback=None,
            )
            improved["image_url"] = new_image_url

            # Replace the original idea with the improved one in stage 3
            product_ideas[idea_index] = improved
            await update_stage_3(db, project_id, {"product_ideas": product_ideas})

            logger.info(f"Regenerated idea '{improved['idea']}' for project {project_id}")
            return {
                "idea_id": idea_id,
                "idea": improved,
                "success": True,
            }

        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response format from agent: {str(e)}"
            )

    @staticmethod
    async def delete_project(db: AsyncClient, project_id: str, user_id: str) -> bool:
        """
        Delete a specific project and its associated data.
        
        Args:
            db: Database session
            project_id: Project ID to delete
            user_id: User ID for ownership verification
            
        Returns:
            True if project was deleted successfully
        """
        return await db_delete_project(db, project_id, user_id)

    @staticmethod
    async def delete_all_data(db: AsyncClient) -> Dict[str, int]:
        """
        Delete all documents from both rag_documents and projects collections.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary containing count of deleted documents from each collection
        """
        try:
            # Delete all data from collections
            result = await delete_all_data(db)
            return result
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error deleting data: {str(e)}"
            )

# Create singleton instance
project_service = ProjectService() 
