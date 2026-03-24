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
    update_stage_5,
    update_document_id,
    update_original_file,
    delete_all_data,
    delete_project as db_delete_project,
    save_iteration_snapshot,
    get_iteration_history as db_get_iteration_history,
    get_iteration_snapshot as db_get_iteration_snapshot,
    save_stage_report,
    get_stage_report as db_get_stage_report,
    set_feedback_loop_status,
    reset_stages_for_feedback_loop,
)
from app.schema.project import Project, Stage, Stage1Data
from app.services.rag_service import rag_service
from app.services.agent_service import agent_service
from app.services.image_service import image_service
from app.services.file_service import file_service
from app.constant.status import StageStatus
from app.prompts.assistant import ProjectPrompts

logger = logging.getLogger(__name__)


class DocumentAnalysis(BaseModel):
    content: str = Field(..., description="Concise analysis paragraph about the document")


class AnalysisResponse(BaseModel):
    analysis: DocumentAnalysis


STAGE_NAMES = {1: "Research", 2: "Understand", 3: "Analysis", 4: "Ideate", 5: "Evaluate"}


class ProjectService:
    @staticmethod
    async def create_project(db: AsyncClient, user_id: str, problem_domain: str) -> Project:
        return await create_project(db, user_id, problem_domain)

    @staticmethod
    async def get_user_projects(db: AsyncClient, user_id: str) -> List[Project]:
        return await get_projects_by_user_id(db, user_id)

    @staticmethod
    async def get_project_by_id(db: AsyncClient, project_id: str, user_id: str = None) -> Project:
        return await db_get_project(db, project_id, user_id)

    @staticmethod
    async def get_stage(db: AsyncClient, project_id: str, stage_number: int, user_id: str) -> Stage:
        project = await db_get_project(db, project_id, user_id)
        return next((stage for stage in project.stages if stage.stage_number == stage_number), None)

    @staticmethod
    async def save_stage_progress(
        db: AsyncClient, project_id: str, stage_number: int, data: dict, status: str, user_id: str
    ) -> Stage:
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        stage = next((s for s in project.stages if s.stage_number == stage_number), None)
        if not stage:
            raise HTTPException(status_code=404, detail="Stage not found")

        if data:
            stage.data = {**stage.data, **data} if stage.data else data
        if status in ("completed", "in_progress", "not_started"):
            stage.status = StageStatus(status)
        stage.updated_at = datetime.utcnow()
        project.updated_at = datetime.utcnow()

        doc_ref = db.collection("projects").document(project_id)
        stages_data = [s.dict() for s in project.stages]
        await doc_ref.update({"stages": stages_data, "updated_at": project.updated_at})

        return stage

    # =====================================================================
    # Stage 1: Research - Upload documents (no analysis)
    # =====================================================================

    @staticmethod
    async def upload_document(db: AsyncClient, project_id: str, file: UploadFile, user_id: str) -> Stage:
        """Stage 1: Upload PDF and store document ID."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        content = await file.read()

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = os.path.join(temp_dir, file.filename)
            with open(pdf_path, 'wb') as temp_file:
                temp_file.write(content)

            try:
                original_file_id = await file_service.store_file(
                    file_data=content,
                    filename=file.filename,
                    content_type="application/pdf",
                    project_id=project_id,
                    user_id=user_id
                )
                await update_original_file(db, project_id, original_file_id, file.filename)

                parent_doc_id = await rag_service.ingest_documents_from_directory(
                    temp_dir, filename=file.filename
                )
                project = await update_document_id(db, project_id, parent_doc_id)

                # Update stage 1 with uploaded document info
                uploaded_docs = project.stages[0].data.get("uploaded_documents", []) or []
                uploaded_docs.append({
                    "filename": file.filename,
                    "uploaded_at": datetime.utcnow().isoformat(),
                    "document_id": parent_doc_id,
                })

                updated_project = await update_stage_1(db, project_id, uploaded_documents=uploaded_docs)
                return updated_project.stages[0]

            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

    @staticmethod
    async def upload_text(db: AsyncClient, project_id: str, text: str, user_id: str) -> Stage:
        """Stage 1 (alt): Upload plain text."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        try:
            doc_id = await rag_service.ingest_text(
                text,
                metadata={
                    "project_id": project_id,
                    "source": "pasted_text",
                    "filename": "pasted_text.txt",
                }
            )
            project = await update_document_id(db, project_id, doc_id)

            uploaded_docs = project.stages[0].data.get("uploaded_documents", []) or []
            uploaded_docs.append({
                "filename": "pasted_text.txt",
                "uploaded_at": datetime.utcnow().isoformat(),
                "document_id": doc_id,
            })

            updated_project = await update_stage_1(db, project_id, uploaded_documents=uploaded_docs)
            return updated_project.stages[0]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error uploading text: {str(e)}")

    # =====================================================================
    # Stage 2: Understand - AI summarization/analysis
    # =====================================================================

    @staticmethod
    async def analyze_document(db: AsyncClient, project_id: str, user_id: str) -> Stage:
        """Stage 2: Generate analysis (non-streaming)."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if not project.document_id:
            raise HTTPException(status_code=400, detail="No document uploaded. Please upload a document first.")

        try:
            query_engine = await rag_service.create_document_query_engine(project.document_id)
            tools = agent_service.create_document_analysis_tools(query_engine, stage_number=2)
            agent = agent_service.create_agent(tools)
            response = await agent_service.run_analysis(
                agent,
                ProjectPrompts.STAGE_2_UNDERSTAND,
                context={"problem_domain": project.problem_domain}
            )

            try:
                if isinstance(response, str):
                    response_dict = json.loads(response)
                else:
                    response_dict = response

                analysis_response = AnalysisResponse(**response_dict)
                updated_project = await update_stage_2(
                    db, project_id, analysis=analysis_response.analysis.content
                )
                return updated_project.stages[1]

            except (json.JSONDecodeError, ValueError) as e:
                raise HTTPException(status_code=500, detail=f"Invalid response format from agent: {str(e)}")

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error analyzing document: {str(e)}")

    @staticmethod
    async def analyze_document_stream(
        db: AsyncClient, project_id: str, user_id: str, model_id: str = None,
        feedback_context: str = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stage 2: Generate analysis via SSE streaming."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            yield {"event": "error", "data": {"message": "Project not found"}}
            return

        if not project.document_id:
            yield {"event": "error", "data": {"message": "No document uploaded. Please upload a document first."}}
            return

        try:
            yield {"event": "status", "data": {"message": "Reading document content..."}}
            doc_content = await rag_service.get_document_text(project.document_id)

            if not doc_content.strip():
                yield {"event": "error", "data": {"message": "Document content is empty."}}
                return

            yield {"event": "status", "data": {"message": "Generating analysis..."}}

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

            # Inject feedback context if this is a feedback loop iteration
            if feedback_context:
                streaming_prompt = feedback_context + "\n\n" + streaming_prompt

            full_text = ""
            try:
                async for chunk_text in agent_service.generate_text_stream(streaming_prompt, model_id=model_id):
                    full_text += chunk_text
                    yield {"event": "chunk", "data": {"text": chunk_text}}
            except Exception as e:
                print(f"Streaming failed: {type(e).__name__}: {e}")
                await asyncio.sleep(3)
                try:
                    from app.constant.config import GEMINI_MODEL
                    response = agent_service.native_client.models.generate_content(
                        model=GEMINI_MODEL,
                        contents=streaming_prompt,
                    )
                    full_text = response.text
                    yield {"event": "chunk", "data": {"text": full_text}}
                except Exception as fallback_err:
                    print(f"Fallback also failed: {fallback_err}")
                    yield {"event": "error", "data": {"message": "AI service is temporarily unavailable. Please try again in a moment."}}
                    return

            cleaned_text = full_text.strip()
            if cleaned_text.startswith('"') and cleaned_text.endswith('"'):
                cleaned_text = cleaned_text[1:-1]

            yield {"event": "done", "data": {"analysis": cleaned_text}}

            if cleaned_text:
                await update_stage_2(db, project_id, analysis=cleaned_text)

        except Exception as e:
            logger.error(f"Error in streaming analysis: {e}", exc_info=True)
            yield {"event": "error", "data": {"message": f"Error analyzing document: {str(e)}"}}

    # =====================================================================
    # Stage 3: Analysis - Problem definition (was Stage 2)
    # =====================================================================

    @staticmethod
    async def process_stage_3(db: AsyncClient, project_id: str, user_id: str, model_id: str = None) -> Stage:
        """Stage 3: Generate problem statements based on analysis."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Validate Stage 2 (Understand) is completed
        stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
        if not stage_2 or stage_2.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 2 (Understand) must be completed first")

        analysis = stage_2.data.get("analysis")
        if not analysis:
            raise HTTPException(status_code=400, detail="Stage 2 analysis is missing")

        doc_text = await rag_service.get_document_text(project.document_id)

        enriched_prompt = ProjectPrompts.STAGE_3_ANALYSIS + (
            f"\n\nORIGINAL DOCUMENT CONTENT (for reference):\n{doc_text}" if doc_text else ""
        )
        response = await agent_service.generate_json(
            enriched_prompt,
            context={
                "analysis": analysis,
                "problem_domain": project.problem_domain
            },
            model_id=model_id,
        )

        try:
            if not response or (isinstance(response, str) and not response.strip()):
                raise HTTPException(status_code=500, detail="Agent returned empty response.")

            if isinstance(response, str) and "Sorry, I can't assist with that" in response:
                raise HTTPException(status_code=500, detail="Failed to generate problem statements")

            if isinstance(response, dict):
                problem_data = response
            else:
                response_str = str(response).strip()
                if not response_str:
                    raise HTTPException(status_code=500, detail="Agent returned empty string response")
                problem_data = json.loads(response_str)

            if not problem_data.get("problem_statements") or not isinstance(problem_data["problem_statements"], list):
                raise HTTPException(status_code=500, detail="Invalid problem statements format received from agent")

            stage_data = {
                "problem_statements": problem_data["problem_statements"],
                "custom_problems": []
            }

            updated_project = await update_stage_3(db, project_id, stage_data)
            return next(s for s in updated_project.stages if s.stage_number == 3)

        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(status_code=500, detail=f"Invalid response format from agent: {str(e)}")

    # Keep old name as alias
    process_stage_2 = process_stage_3

    # =====================================================================
    # Stage 4: Ideate - Generate product ideas (was Stage 3)
    # =====================================================================

    @staticmethod
    async def process_stage_4(
        db: AsyncClient,
        project_id: str,
        user_id: str,
        selected_problem_id: Optional[str] = None,
        custom_problem: Optional[str] = None,
        model_id: str = None,
    ) -> Stage:
        """Stage 4: Generate product ideas based on a selected or custom problem."""
        logger.info(f"Starting process_stage_4 for project {project_id}")
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Validate prior stages (2=Understand, 3=Analysis)
        stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
        stage_3 = next((s for s in project.stages if s.stage_number == 3), None)

        if not stage_2 or stage_2.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 2 (Understand) must be completed first")
        if not stage_3 or stage_3.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 3 (Analysis) must be completed first")

        analysis = stage_2.data.get("analysis")
        all_problem_statements = stage_3.data.get("problem_statements", [])

        if selected_problem_id and custom_problem:
            raise HTTPException(status_code=400, detail="Cannot provide both selected_problem_id and custom_problem")
        if not selected_problem_id and not custom_problem:
            raise HTTPException(status_code=400, detail="Must provide either selected_problem_id or custom_problem")

        selected_problem = None

        if selected_problem_id:
            selected_problem = next(
                (p for p in all_problem_statements if p.get("id") == selected_problem_id), None
            )
            if not selected_problem:
                raise HTTPException(status_code=400, detail=f"Problem with ID {selected_problem_id} not found")

        if custom_problem:
            if not isinstance(custom_problem, str) or not custom_problem.strip():
                raise HTTPException(status_code=400, detail="Custom problem must be a non-empty string")

            custom_problem_id = str(uuid.uuid4())
            selected_problem = {
                "id": custom_problem_id,
                "problem": custom_problem,
                "explanation": custom_problem,
                "is_custom": True
            }

            stage_data = {
                "problem_statements": all_problem_statements,
                "custom_problems": stage_3.data.get("custom_problems", []) + [selected_problem]
            }
            await update_stage_3(db, project_id, stage_data)

        doc_text = await rag_service.get_document_text(project.document_id)

        enriched_prompt = ProjectPrompts.STAGE_4_IDEATE + (
            f"\n\nORIGINAL DOCUMENT CONTENT (for reference):\n{doc_text}" if doc_text else ""
        )
        response = await agent_service.generate_json(
            enriched_prompt,
            context={
                "analysis": analysis,
                "problem_statements": [selected_problem],
                "problem_domain": project.problem_domain
            },
            model_id=model_id,
        )

        try:
            ideas_data = response if isinstance(response, dict) else json.loads(response)
            logger.info(f"Parsed ideas data, found {len(ideas_data.get('product_ideas', []))} ideas")

            if image_service.db is None:
                image_service.set_db(db)

            for idea in ideas_data["product_ideas"]:
                idea["problem_id"] = selected_problem["id"]
                idea["id"] = idea.get("id", str(uuid.uuid4()))

            async def generate_image_for_idea(idea):
                try:
                    image_url = await image_service.generate_product_image(
                        idea_title=idea["idea"],
                        detailed_explanation=idea["detailed_explanation"],
                        problem_domain=project.problem_domain,
                        project_id=project_id,
                        idea_id=idea["id"],
                    )
                    idea["image_url"] = image_url
                except Exception as e:
                    logger.error(f"Failed to generate image for idea '{idea['idea']}': {str(e)}")
                    idea["image_url"] = None

            await asyncio.gather(
                *[generate_image_for_idea(idea) for idea in ideas_data["product_ideas"]]
            )

            updated_project = await update_stage_4(
                db, project_id, {"product_ideas": ideas_data["product_ideas"]}
            )
            return next(s for s in updated_project.stages if s.stage_number == 4)
        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(status_code=500, detail=f"Invalid response format from agent: {str(e)}")

    # Keep old name as alias
    process_stage_3 = process_stage_4

    # =====================================================================
    # Stage 5: Evaluate - User feedback + chosen solution
    # =====================================================================

    @staticmethod
    async def process_stage_5(
        db: AsyncClient,
        project_id: str,
        user_id: str,
        feedback_entries: List[Dict] = None,
        evaluation_notes: str = None,
        chosen_solution_id: str = None,
    ) -> Stage:
        """Stage 5: Save user feedback/evaluation and optionally set chosen solution."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        stage_data = {}

        if feedback_entries:
            stage_data["feedback_entries"] = feedback_entries
        if evaluation_notes:
            stage_data["evaluation_notes"] = evaluation_notes

        # If a solution is chosen, find it from stage 4
        if chosen_solution_id:
            stage_4 = next((s for s in project.stages if s.stage_number == 4), None)
            if not stage_4 or stage_4.status != StageStatus.COMPLETED:
                raise HTTPException(status_code=400, detail="Stage 4 (Ideate) must be completed first")

            product_ideas = stage_4.data.get("product_ideas", [])
            chosen = next((i for i in product_ideas if i.get("id") == chosen_solution_id), None)
            if not chosen:
                raise HTTPException(status_code=404, detail=f"Solution with ID {chosen_solution_id} not found")
            stage_data["chosen_solution"] = chosen

        updated_project = await update_stage_5(db, project_id, stage_data)
        return next(s for s in updated_project.stages if s.stage_number == 5)

    # =====================================================================
    # Comprehensive report (replaces old process_stage_4 report)
    # =====================================================================

    @staticmethod
    async def get_comprehensive_report(
        db: AsyncClient, project_id: str, user_id: str
    ) -> Dict:
        """Generate the comprehensive report data from all stages."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
        stage_3 = next((s for s in project.stages if s.stage_number == 3), None)
        stage_4 = next((s for s in project.stages if s.stage_number == 4), None)
        stage_5 = next((s for s in project.stages if s.stage_number == 5), None)

        # Find the chosen solution (from stage 5 or fallback to first idea in stage 4)
        chosen_solution = None
        if stage_5 and stage_5.data.get("chosen_solution"):
            chosen_solution = stage_5.data["chosen_solution"]
        elif stage_4 and stage_4.data.get("product_ideas"):
            chosen_solution = stage_4.data["product_ideas"][0]

        if not chosen_solution:
            raise HTTPException(status_code=400, detail="No chosen solution found. Please select an idea first.")

        # Find chosen problem
        all_problems = (stage_3.data.get("problem_statements", []) if stage_3 else []) + \
                       (stage_3.data.get("custom_problems", []) if stage_3 else [])
        chosen_problem = next(
            (p for p in all_problems if p.get("id") == chosen_solution.get("problem_id")),
            None
        )

        return {
            "title": f"Innovation Report for {project.problem_domain}",
            "analysis": stage_2.data.get("analysis", "") if stage_2 else "",
            "chosen_problem": {
                "statement": chosen_problem.get("problem", "Problem not found") if chosen_problem else "Problem not found",
                "explanation": chosen_problem.get("explanation", "") if chosen_problem else ""
            },
            "chosen_solution": {
                "idea": chosen_solution.get("idea"),
                "explanation": chosen_solution.get("detailed_explanation"),
                "image_url": chosen_solution.get("image_url")
            },
            "iteration": project.current_iteration,
        }

    # =====================================================================
    # Feedback loop
    # =====================================================================

    @staticmethod
    async def trigger_feedback_loop(
        db: AsyncClient,
        project_id: str,
        user_id: str,
        feedback_text: str,
        model_id: str = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Trigger the feedback loop: snapshot -> re-run stages 2-4 with feedback.
        Yields SSE events for progress tracking."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            yield {"event": "error", "data": {"message": "Project not found"}}
            return

        if project.feedback_loop_in_progress:
            yield {"event": "error", "data": {"message": "A feedback loop is already in progress."}}
            return

        try:
            await set_feedback_loop_status(db, project_id, True)

            # 1. Save current state as iteration snapshot
            yield {"event": "progress", "data": {"stage": "snapshot", "message": "Saving current iteration..."}}
            new_iteration = await save_iteration_snapshot(db, project_id, feedback_text)
            yield {"event": "progress", "data": {"stage": "snapshot", "message": f"Saved as iteration {new_iteration - 1}. Starting iteration {new_iteration}..."}}

            # 2. Get previous outputs for context
            prev_stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
            prev_analysis = prev_stage_2.data.get("analysis", "") if prev_stage_2 else ""

            # 3. Reset stages 2-5
            await reset_stages_for_feedback_loop(db, project_id)

            # 4. Re-run Stage 2 (Understand) with feedback context
            yield {"event": "progress", "data": {"stage": "understand", "message": "Re-generating understanding with feedback..."}}

            feedback_context = ProjectPrompts.FEEDBACK_LOOP_CONTEXT.format(
                iteration_number=new_iteration,
                feedback_text=feedback_text,
                previous_output=prev_analysis,
            )

            # Use streaming for stage 2
            full_analysis = ""
            async for event in ProjectService.analyze_document_stream(
                db, project_id, user_id, model_id=model_id,
                feedback_context=feedback_context,
            ):
                if event["event"] == "chunk":
                    full_analysis += event["data"].get("text", "")
                elif event["event"] == "error":
                    yield event
                    await set_feedback_loop_status(db, project_id, False)
                    return

            yield {"event": "progress", "data": {"stage": "understand", "message": "Understanding complete."}}

            # 5. Re-run Stage 3 (Analysis) with feedback
            yield {"event": "progress", "data": {"stage": "analysis", "message": "Re-generating problem statements..."}}
            try:
                await ProjectService.process_stage_3(db, project_id, user_id, model_id=model_id)
                yield {"event": "progress", "data": {"stage": "analysis", "message": "Problem statements generated."}}
            except Exception as e:
                yield {"event": "error", "data": {"message": f"Error in Analysis stage: {str(e)}"}}
                await set_feedback_loop_status(db, project_id, False)
                return

            # 6. Re-run Stage 4 (Ideate) - auto-select first problem
            yield {"event": "progress", "data": {"stage": "ideate", "message": "Re-generating product ideas..."}}
            try:
                refreshed = await db_get_project(db, project_id, user_id)
                stage_3 = next((s for s in refreshed.stages if s.stage_number == 3), None)
                problems = stage_3.data.get("problem_statements", []) if stage_3 else []
                first_problem_id = problems[0].get("id") if problems else None

                if first_problem_id:
                    await ProjectService.process_stage_4(
                        db, project_id, user_id,
                        selected_problem_id=first_problem_id,
                        model_id=model_id,
                    )
                yield {"event": "progress", "data": {"stage": "ideate", "message": "Product ideas generated."}}
            except Exception as e:
                yield {"event": "error", "data": {"message": f"Error in Ideate stage: {str(e)}"}}
                await set_feedback_loop_status(db, project_id, False)
                return

            await set_feedback_loop_status(db, project_id, False)
            yield {"event": "done", "data": {"message": f"Feedback loop complete. Now on iteration {new_iteration}.", "iteration": new_iteration}}

        except Exception as e:
            logger.error(f"Error in feedback loop: {e}", exc_info=True)
            await set_feedback_loop_status(db, project_id, False)
            yield {"event": "error", "data": {"message": f"Feedback loop failed: {str(e)}"}}

    # =====================================================================
    # Iteration history
    # =====================================================================

    @staticmethod
    async def get_iteration_history(db: AsyncClient, project_id: str, user_id: str) -> List[Dict]:
        await db_get_project(db, project_id, user_id)  # validate access
        return await db_get_iteration_history(db, project_id)

    @staticmethod
    async def get_iteration_snapshot(db: AsyncClient, project_id: str, iteration_number: int, user_id: str) -> Dict:
        await db_get_project(db, project_id, user_id)
        snapshot = await db_get_iteration_snapshot(db, project_id, iteration_number)
        if not snapshot:
            raise HTTPException(status_code=404, detail=f"Iteration {iteration_number} not found")
        return snapshot

    # =====================================================================
    # Per-stage reports
    # =====================================================================

    @staticmethod
    async def generate_stage_report(
        db: AsyncClient, project_id: str, stage_number: int, user_id: str, model_id: str = None
    ) -> Dict:
        """Generate a standalone report for a specific stage."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        stage = next((s for s in project.stages if s.stage_number == stage_number), None)
        if not stage:
            raise HTTPException(status_code=404, detail=f"Stage {stage_number} not found")

        stage_name = STAGE_NAMES.get(stage_number, f"Stage {stage_number}")

        prompt = ProjectPrompts.STAGE_REPORT_TEMPLATE.format(
            stage_name=stage_name,
            stage_number=stage_number,
            problem_domain=project.problem_domain,
            iteration_number=project.current_iteration,
            stage_data=json.dumps(stage.data, indent=2, default=str),
        )

        report_text = await agent_service.generate_text(prompt, model_id=model_id)
        report = await save_stage_report(db, project_id, stage_number, report_text)

        return {
            "stage_number": stage_number,
            "stage_name": stage_name,
            "report_content": report.report_content,
            "generated_at": report.generated_at.isoformat() if report.generated_at else None,
        }

    @staticmethod
    async def get_stage_report(db: AsyncClient, project_id: str, stage_number: int, user_id: str) -> Dict:
        await db_get_project(db, project_id, user_id)
        report = await db_get_stage_report(db, project_id, stage_number)
        if not report:
            raise HTTPException(status_code=404, detail=f"No report found for stage {stage_number}")
        return {
            "stage_number": stage_number,
            "stage_name": STAGE_NAMES.get(stage_number, f"Stage {stage_number}"),
            **report,
        }

    # =====================================================================
    # Image operations
    # =====================================================================

    @staticmethod
    async def proxy_image(image_url: str) -> bytes:
        image_bytes = image_service.download_image(image_url)
        if not image_bytes:
            raise HTTPException(status_code=404, detail="Image not found or could not be downloaded")
        return image_bytes

    @staticmethod
    async def get_project_pdf(db: AsyncClient, project_id: str) -> bytes:
        try:
            pdf_data = await get_project_pdf_data(db, project_id)
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
            raise HTTPException(status_code=400, detail=str(e))

    @staticmethod
    async def regenerate_idea_image(
        db: AsyncClient, project_id: str, idea_id: str, user_id: str, feedback: str = None
    ) -> Dict:
        """Regenerate image for a specific product idea (in stage 4)."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        stage_4 = next((s for s in project.stages if s.stage_number == 4), None)
        if not stage_4 or stage_4.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 4 must be completed first")

        product_ideas = stage_4.data.get("product_ideas", [])
        idea_index = None
        target_idea = None
        for i, idea in enumerate(product_ideas):
            if idea.get("id") == idea_id:
                idea_index = i
                target_idea = idea
                break

        if target_idea is None:
            raise HTTPException(status_code=404, detail="Idea not found")

        if image_service.db is None:
            image_service.set_db(db)

        try:
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

            product_ideas[idea_index]["image_url"] = new_image_url
            await update_stage_4(db, project_id, {"product_ideas": product_ideas})

            return {"idea_id": idea_id, "image_url": new_image_url, "success": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to regenerate image: {str(e)}")

    @staticmethod
    async def regenerate_idea(
        db: AsyncClient, project_id: str, idea_id: str, user_id: str,
        feedback: str, model_id: str = None,
    ) -> Dict:
        """Iterate on a specific product idea using user feedback."""
        project = await db_get_project(db, project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
        stage_4 = next((s for s in project.stages if s.stage_number == 4), None)

        if not stage_4 or stage_4.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 4 must be completed first")

        product_ideas = stage_4.data.get("product_ideas", [])
        idea_index = None
        target_idea = None
        for i, idea in enumerate(product_ideas):
            if idea.get("id") == idea_id:
                idea_index = i
                target_idea = idea
                break

        if target_idea is None:
            raise HTTPException(status_code=404, detail="Idea not found")

        analysis = stage_2.data.get("analysis", "") if stage_2 else ""

        stage_3 = next((s for s in project.stages if s.stage_number == 3), None)
        problem_statements = stage_3.data.get("problem_statements", []) if stage_3 else []
        problem_id = target_idea.get("problem_id")
        selected_problem = next(
            (p for p in problem_statements if p.get("id") == problem_id),
            {"problem": target_idea.get("idea", ""), "explanation": ""}
        )

        response = await agent_service.generate_json(
            ProjectPrompts.STAGE_4_IDEATE_ITERATION,
            context={
                "problem_domain": project.problem_domain,
                "analysis": analysis,
                "problem_statements": selected_problem,
                "original_idea": f"{target_idea['idea']}\n\n{target_idea['detailed_explanation']}",
                "feedback": feedback,
            },
            model_id=model_id,
        )

        try:
            result = response if isinstance(response, dict) else json.loads(response)
            improved = result.get("improved_idea", {})

            if not improved:
                raise HTTPException(status_code=500, detail="No improved idea returned from agent")

            improved["id"] = idea_id
            improved["problem_id"] = problem_id

            if image_service.db is None:
                image_service.set_db(db)

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

            product_ideas[idea_index] = improved
            await update_stage_4(db, project_id, {"product_ideas": product_ideas})

            return {"idea_id": idea_id, "idea": improved, "success": True}

        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(status_code=500, detail=f"Invalid response format from agent: {str(e)}")

    # =====================================================================
    # Delete operations
    # =====================================================================

    @staticmethod
    async def delete_project(db: AsyncClient, project_id: str, user_id: str) -> bool:
        return await db_delete_project(db, project_id, user_id)

    @staticmethod
    async def delete_all_data(db: AsyncClient) -> Dict[str, int]:
        try:
            return await delete_all_data(db)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error deleting data: {str(e)}")


project_service = ProjectService()
