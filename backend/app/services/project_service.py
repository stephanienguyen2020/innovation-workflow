from fastapi import HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
import tempfile
import os
import json
from datetime import datetime

from app.database.query.db_project import (
    create_project,
    get_project,
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
            updated_project = await update_stage_2(
                db,
                project_id,
                problem_data["problem_statements"]
            )
            return next(stage for stage in updated_project.stages if stage.stage_number == 2)
        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response format from agent: {str(e)}"
            )

    @staticmethod
    async def process_stage_3(db: AsyncIOMotorDatabase, project_id: str) -> Stage:
        """
        Process stage 3: Generate product ideas based on problem statements.
        
        Args:
            db: Database session
            project_id: Project ID
            
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
        problem_statements = stage_2.data.get("problem_statements")
        
        if not analysis or not problem_statements:
            raise HTTPException(status_code=400, detail="Missing required data from prior stages")
            
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
                "problem_statements": problem_statements
            }
        )
        
        try:
            # The response should already be in structured format
            ideas_data = response if isinstance(response, dict) else json.loads(response)
            updated_project = await update_stage_3(
                db,
                project_id,
                ideas_data["product_ideas"]
            )
            return next(stage for stage in updated_project.stages if stage.stage_number == 3)
        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response format from agent: {str(e)}"
            )

    @staticmethod
    async def process_stage_4(db: AsyncIOMotorDatabase, project_id: str) -> Stage:
        """
        Process stage 4: Generate final PDF with all analysis and chosen solutions.
        
        Args:
            db: Database session
            project_id: Project ID
            
        Returns:
            Updated stage 4 data
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
        
        # Get data from all prior stages
        stage_1_data = next(s.data for s in project.stages if s.stage_number == 1)
        stage_2_data = next(s.data for s in project.stages if s.stage_number == 2)
        stage_3_data = next(s.data for s in project.stages if s.stage_number == 3)
        
        # Initialize RAG service and create query engine
        await rag_service.initialize()
        query_engine = await rag_service.create_document_query_engine(project.document_id)
        
        # Create tools and agent
        tools = agent_service.create_document_analysis_tools(query_engine, stage_number=4)
        agent = agent_service.create_agent(tools)
        
        # Generate final document
        response = await agent_service.run_analysis(
            agent,
            ProjectPrompts.STAGE_4_FINAL,
            context={
                "analysis": stage_1_data.get("analysis"),
                "problem_statements": stage_2_data.get("problem_statements"),
                "product_ideas": stage_3_data.get("product_ideas")
            }
        )
        
        try:
            # Parse the response and update project
            final_data = json.loads(response)
            updated_project = await update_stage_4(
                db,
                project_id,
                final_data["final_pdf"]
            )
            return next(stage for stage in updated_project.stages if stage.stage_number == 4)
        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response format from agent: {str(e)}"
            )

# Create singleton instance
project_service = ProjectService() 