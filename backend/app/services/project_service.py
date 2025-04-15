from fastapi import HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
import tempfile
import os
import json
from datetime import datetime
from typing import List, Optional, Dict
import uuid

from app.database.query.db_project import (
    create_project,
    get_project,
    get_project_pdf_data,
    get_stage,
    update_stage_1,
    update_stage_2,
    update_stage_3,
    update_stage_4
)
from app.schema.project import Project, Stage, Stage1Data
from app.services.rag_service import rag_service
from app.services.agent_service import agent_service
from app.constant.status import StageStatus
from app.prompts.assistant import ProjectPrompts

class ProjectService:
    @staticmethod
    async def create_project(db: AsyncIOMotorDatabase, user_id: str) -> Project:
        """Create a new project."""
        return await create_project(db, user_id)

    @staticmethod
    async def get_project(db: AsyncIOMotorDatabase, project_id: str) -> Project:
        """Get project by ID."""
        return await get_project(db, project_id)

    @staticmethod
    async def get_stage(db: AsyncIOMotorDatabase, project_id: str, stage_number: int) -> Stage:
        """Get specific stage of a project."""
        return await get_stage(db, project_id, stage_number)

    @staticmethod
    async def process_stage_1(db: AsyncIOMotorDatabase, project_id: str, file: UploadFile) -> Stage:
        """
        Process stage 1: Upload PDF and generate analysis.
        
        Args:
            db: Database session
            project_id: Project ID
            file: Uploaded PDF file
            
        Returns:
            Stage 1 data with analysis
        """
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        # Create temporary directory for file processing
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = os.path.join(temp_dir, file.filename)
            
            # Save uploaded file
            with open(pdf_path, 'wb') as temp_file:
                content = await file.read()
                temp_file.write(content)

            try:
                # Initialize RAG service
                await rag_service.initialize()

                # Ingest PDF using directory reader and get document ID
                parent_doc_id = await rag_service.ingest_documents_from_directory(
                    temp_dir,
                    filename=file.filename
                )
                
                # Create query engine for the document
                query_engine = await rag_service.create_document_query_engine(parent_doc_id)
                
                # Create tools for the agent
                tools = agent_service.create_document_analysis_tools(query_engine, stage_number=1)

                # Create agent and run analysis
                agent = agent_service.create_agent(tools)
                analysis = await agent_service.run_analysis(
                    agent,
                    ProjectPrompts.STAGE_1_ANALYSIS
                )

                # Update project with document IDs and analysis
                project = await update_stage_1(
                    db, 
                    project_id, 
                    analysis, 
                    document_id=parent_doc_id
                )
                return project.stages[0]

            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

    @staticmethod
    async def process_stage_2(db: AsyncIOMotorDatabase, project_id: str) -> Stage:
        """
        Process stage 2: Generate problem statements based on analysis.
        
        Args:
            db: Database session
            project_id: Project ID
            
        Returns:
            Updated stage 2 data
        """
        # Get project and validate stage 1
        project = await get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        stage_1 = next((stage for stage in project.stages if stage.stage_number == 1), None)
        if not stage_1 or stage_1.status != StageStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Stage 1 must be completed first")
            
        analysis = stage_1.data.get("analysis")
        if not analysis:
            raise HTTPException(status_code=400, detail="Stage 1 analysis is missing")
            
        # Initialize RAG service and create query engine with stage-specific parser
        await rag_service.initialize()
        query_engine = await rag_service.create_document_query_engine(
            project.document_id,
            stage_number=2
        )
        
        # Create tools and agent
        tools = agent_service.create_document_analysis_tools(query_engine, stage_number=2)
        agent = agent_service.create_agent(tools)
        
        # Generate problem statements with structured output
        response = await agent_service.run_analysis(
            agent,
            ProjectPrompts.STAGE_2_PROBLEMS,
            context={"analysis": analysis}
        )
        
        try:
            # The response should already be in structured format
            problem_data = response if isinstance(response, dict) else json.loads(response)
            
            # Format stage data properly with problem_statements
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
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response format from agent: {str(e)}"
            )

    @staticmethod
    async def process_stage_3(
        db: AsyncIOMotorDatabase, 
        project_id: str,
        selected_problem_id: Optional[str] = None,
        custom_problem: Optional[str] = None
    ) -> Stage:
        """
        Process stage 3: Generate product ideas based on a single selected or custom problem statement.
        
        Args:
            db: Database session
            project_id: Project ID
            selected_problem_id: ID of a problem selected from stage 2 (mutually exclusive with custom_problem)
            custom_problem: New problem statement as string (mutually exclusive with selected_problem_id)
            
        Returns:
            Updated stage 3 data
        """
        # Get project and validate prior stages
        project = await get_project(db, project_id)
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
            
        # Initialize RAG service and create query engine with stage-specific parser
        await rag_service.initialize()
        query_engine = await rag_service.create_document_query_engine(
            project.document_id,
            stage_number=3
        )
        
        # Create tools and agent
        tools = agent_service.create_document_analysis_tools(query_engine, stage_number=3)
        agent = agent_service.create_agent(tools)
        
        # Generate product ideas with structured output
        response = await agent_service.run_analysis(
            agent,
            ProjectPrompts.STAGE_3_IDEAS,
            context={
                "analysis": analysis,
                "problem_statement": selected_problem  # Pass single selected problem
            }
        )
        
        try:
            # The response should already be in structured format
            ideas_data = response if isinstance(response, dict) else json.loads(response)
            
            # Add problem reference to all ideas
            for idea in ideas_data["product_ideas"]:
                idea["problem_id"] = selected_problem["id"]
            
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
        db: AsyncIOMotorDatabase, 
        project_id: str,
        chosen_solution_id: str
    ) -> Dict:
        """
        Process stage 4: Update chosen solution and return formatted data.
        
        Args:
            db: Database session
            project_id: Project ID
            chosen_solution_id: ID of the solution chosen by the user
            
        Returns:
            Dictionary containing formatted project data
        """
        # Get project and validate all prior stages
        project = await get_project(db, project_id)
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
            # Update stage 4 with chosen solution
            await update_stage_4(db, project_id, chosen_solution_id)
            
            # Get and return formatted data
            return await get_project_pdf_data(db, project_id)
            
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )
            
    @staticmethod
    async def get_project_pdf(db: AsyncIOMotorDatabase, project_id: str) -> bytes:
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

# Create singleton instance
project_service = ProjectService() 