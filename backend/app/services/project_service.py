from fastapi import HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
import tempfile
import os
from datetime import datetime

from app.database.query.db_project import (
    create_project,
    get_project,
    get_stage,
    update_stage_1
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

                # Ingest PDF using directory reader
                doc_count = await rag_service.ingest_documents_from_directory(temp_dir)
                if doc_count == 0:
                    raise HTTPException(status_code=400, detail="Failed to process PDF")

                # Create query engine and agent tools
                query_engine = rag_service.index.as_query_engine(similarity_top_k=3)
                tools = [
                    agent_service.create_query_engine_tool(
                        query_engine=query_engine,
                        name="document_analysis",
                        description="Analyzes the uploaded document and provides detailed information about its contents."
                    )
                ]

                # Create agent and run analysis
                agent = agent_service.create_agent(tools)
                analysis = await agent_service.run_analysis(
                    agent,
                    ProjectPrompts.STAGE_1_ANALYSIS
                )

                # Update project and get Stage 1 data
                project = await update_stage_1(db, project_id, analysis, file.filename)
                return project.stages[0]  # Return Stage 1 directly from the updated project

            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

# Create singleton instance
project_service = ProjectService() 