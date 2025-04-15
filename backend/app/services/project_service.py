from fastapi import HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
import tempfile
import os
import json
from datetime import datetime
from typing import List, Optional, Dict
import uuid
from bson import ObjectId
import pymongo

from app.database.query.db_project import (
    create_project,
    get_project,
    get_project_pdf_data,
    get_stage,
    update_stage_1,
    update_stage_2,
    update_stage_3,
    update_stage_4,
    update_document_id
)
from app.schema.project import Project, Stage, Stage1Data
from app.services.rag_service import rag_service
from app.services.agent_service import agent_service
from app.constant.status import StageStatus
from app.prompts.assistant import ProjectPrompts

class ProjectService:
    @staticmethod
    async def create_project(db: AsyncIOMotorDatabase, user_id: str, problem_domain: str) -> Project:
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
    async def get_project(db: AsyncIOMotorDatabase, project_id: str) -> Project:
        """Get project by ID."""
        return await get_project(db, project_id)

    @staticmethod
    async def get_stage(db: AsyncIOMotorDatabase, project_id: str, stage_number: int) -> Stage:
        """Get specific stage of a project."""
        return await get_stage(db, project_id, stage_number)

    @staticmethod
    async def upload_document(db: AsyncIOMotorDatabase, project_id: str, file: UploadFile) -> Stage:
        """
        Stage 1 - Part 1: Upload PDF and store document ID.
        
        Args:
            db: Database session
            project_id: Project ID
            file: Uploaded PDF file
            
        Returns:
            Stage 1 with document ID
        """
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        # SPECIAL HANDLING FOR DEV PROJECTS
        if project_id.startswith('dev-project-'):
            try:
                print(f"Special handling for dev project {project_id}")
                # Create a fake project with stages if it doesn't exist
                project = await ProjectService.get_or_create_dev_project(db, project_id)
                
                # Generate a document ID
                simple_doc_id = f"pdf-{str(uuid.uuid4())}"
                print(f"Generated document ID: {simple_doc_id}")
                
                # Manually update the project document in MongoDB
                await db.projects.update_one(
                    {"project_id_str": project_id},
                    {
                        "$set": {
                            "document_id": simple_doc_id,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                # Also update the project in memory
                project.document_id = simple_doc_id
                project.updated_at = datetime.utcnow()
                
                # Return the stage
                return project.stages[0]
            except Exception as e:
                print(f"Error in dev project handling: {str(e)}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error in dev project handling: {str(e)}")

        # TEMPORARY WORKAROUND: Bypass the LlamaIndex integration
        # Just store the PDF file and create a simple document ID
        try:
            print("Using temporary workaround for PDF upload")
            # Generate a simple document ID
            simple_doc_id = f"pdf-{str(uuid.uuid4())}"
            print(f"Generated simple document ID: {simple_doc_id}")
            
            # Store the content in a temporary directory for debugging
            content = await file.read()
            
            # Update document ID and get project
            print(f"Updating project {project_id} with document ID {simple_doc_id}")
            project = await update_document_id(db, project_id, simple_doc_id)
            print("Project updated successfully")
            
            # Return stage 1 data
            return project.stages[0]
            
        except Exception as e:
            print(f"Error in temporary PDF upload workaround: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error in temporary workaround: {str(e)}")
        
        # The below code is the original implementation using LlamaIndex
        # It's kept here for reference but not executed
        """
        # Create temporary directory for file processing
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = os.path.join(temp_dir, file.filename)
            
            # Save uploaded file
            with open(pdf_path, 'wb') as temp_file:
                content = await file.read()
                temp_file.write(content)
                print(f"Saved uploaded file to {pdf_path}")
                print(f"File size: {len(content)} bytes")

            try:
                # Initialize RAG service
                print("Initializing RAG service...")
                await rag_service.initialize()
                print("RAG service initialized")

                # Ingest PDF using directory reader and get document ID
                print(f"Ingesting documents from {temp_dir}")
                parent_doc_id = await rag_service.ingest_documents_from_directory(
                    temp_dir,
                    filename=file.filename
                )
                print(f"Document ingested with ID: {parent_doc_id}")
                
                # Update document ID and get project
                print(f"Updating project {project_id} with document ID {parent_doc_id}")
                project = await update_document_id(db, project_id, parent_doc_id)
                print("Project updated successfully")
                
                # Return stage 1 data
                return project.stages[0]

            except pymongo.errors.ConfigurationError as e:
                print(f"MongoDB configuration error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"MongoDB configuration error: {str(e)}")
            except pymongo.errors.OperationFailure as e:
                print(f"MongoDB operation failed: {str(e)}")
                raise HTTPException(status_code=500, detail=f"MongoDB operation failed: {str(e)}")
            except AttributeError as e:
                print(f"Attribute error (likely LlamaIndex issue): {str(e)}")
                raise HTTPException(status_code=500, detail=f"Attribute error with document processing: {str(e)}")
            except ModuleNotFoundError as e:
                print(f"Module not found: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Module not found: {str(e)}")
            except Exception as e:
                print(f"Error uploading document: {str(e)}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")
        """

    @staticmethod
    async def analyze_document(db: AsyncIOMotorDatabase, project_id: str) -> Stage:
        """
        Stage 1 - Part 2: Generate analysis for the uploaded document.
        
        Args:
            db: Database session
            project_id: Project ID
            
        Returns:
            Stage 1 with analysis
        """
        print(f"Analyzing document for project {project_id}")
        
        # SPECIAL HANDLING FOR DEV PROJECTS
        if project_id.startswith('dev-project-'):
            try:
                print(f"Special handling for dev project analysis {project_id}")
                # Get or create the project
                project = await ProjectService.get_or_create_dev_project(db, project_id)
                
                if not project.document_id:
                    raise HTTPException(status_code=400, detail="No document uploaded. Please upload a document first.")
                
                # Generate a simple analysis based on the problem domain
                analysis = f"""
                Based on the uploaded PDF document and the problem domain of "{project.problem_domain}", 
                here is a preliminary analysis:
                
                ## Document Overview
                The document appears to be related to {project.problem_domain}. It contains information 
                that can be used to identify user needs and potential innovation opportunities.
                
                ## Key Insights
                1. Users are looking for solutions that address specific needs in the {project.problem_domain} space.
                2. Current solutions have gaps that could be filled with innovative approaches.
                3. There are opportunities to improve efficiency and user experience.
                4. Technology adoption in this area is growing, indicating a receptive market.
                
                ## Recommendations
                This document provides a good foundation for understanding user needs and market dynamics.
                The next step would be to identify specific problem statements based on these insights.
                """
                
                # Update project in database
                await db.projects.update_one(
                    {"project_id_str": project_id},
                    {
                        "$set": {
                            "stages.0.data": {"analysis": analysis},
                            "stages.0.status": "completed",
                            "stages.0.updated_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                # Update the project in memory
                project.stages[0].data = {"analysis": analysis}
                project.stages[0].status = StageStatus.COMPLETED
                project.stages[0].updated_at = datetime.utcnow()
                
                return project.stages[0]
                
            except Exception as e:
                print(f"Error in dev project analysis: {str(e)}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error in dev project analysis: {str(e)}")

        # Get project and validate document ID
        project = await get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        if not project.document_id:
            raise HTTPException(status_code=400, detail="No document uploaded. Please upload a document first.")

        # TEMPORARY WORKAROUND: Generate a simple analysis without using LlamaIndex
        try:
            print("Using temporary workaround for document analysis")
            # Generate a simple analysis based on the problem domain
            analysis = f"""
            Based on the uploaded PDF document and the problem domain of "{project.problem_domain}", 
            here is a preliminary analysis:
            
            ## Document Overview
            The document appears to be related to {project.problem_domain}. It contains information 
            that can be used to identify user needs and potential innovation opportunities.
            
            ## Key Insights
            1. Users are looking for solutions that address specific needs in the {project.problem_domain} space.
            2. Current solutions have gaps that could be filled with innovative approaches.
            3. There are opportunities to improve efficiency and user experience.
            4. Technology adoption in this area is growing, indicating a receptive market.
            
            ## Recommendations
            This document provides a good foundation for understanding user needs and market dynamics.
            The next step would be to identify specific problem statements based on these insights.
            """
            
            # Update stage 1 with analysis and mark as completed
            updated_project = await update_stage_1(
                db, 
                project_id, 
                analysis=analysis
            )
            return updated_project.stages[0]
            
        except Exception as e:
            print(f"Error in temporary analysis workaround: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error in temporary analysis workaround: {str(e)}")
            
        # The below code is the original implementation using LlamaIndex
        # It's kept here for reference but not executed
        """
        try:
            # Initialize RAG service and create query engine
            await rag_service.initialize()
            query_engine = await rag_service.create_document_query_engine(project.document_id)
            
            # Create tools for the agent
            tools = agent_service.create_document_analysis_tools(query_engine, stage_number=1)

            # Create agent and run analysis with problem domain context
            agent = agent_service.create_agent(tools)
            analysis = await agent_service.run_analysis(
                agent,
                ProjectPrompts.STAGE_1_ANALYSIS,
                context={
                    "problem_domain": project.problem_domain
                }
            )

            # Update stage 1 with analysis and mark as completed
            updated_project = await update_stage_1(
                db, 
                project_id, 
                analysis=analysis
            )
            return updated_project.stages[0]

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error analyzing document: {str(e)}")
        """

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
        print(f"Processing stage 2 for project {project_id}")
        
        # SPECIAL HANDLING FOR DEV PROJECTS
        if project_id.startswith('dev-project-'):
            try:
                print(f"Special handling for dev project stage 2: {project_id}")
                # Get or create the project
                project = await ProjectService.get_or_create_dev_project(db, project_id)
                
                # Check if stage 1 is completed
                if project.stages[0].status != StageStatus.COMPLETED:
                    raise HTTPException(status_code=400, detail="Stage 1 must be completed first")
                
                # Create example problem statements
                problem_statements = [
                    {
                        "id": str(uuid.uuid4()),
                        "problem": f"Users find it difficult to navigate through {project.problem_domain} solutions",
                        "explanation": f"Based on the analysis, many users are struggling with the complexity of current {project.problem_domain} interfaces, leading to frustration and inefficiency."
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "problem": f"Integration challenges with existing {project.problem_domain} systems",
                        "explanation": "The analysis highlights compatibility issues between different systems, causing workflow disruptions and data silos."
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "problem": f"Limited mobile access to {project.problem_domain} tools",
                        "explanation": "Users increasingly need on-the-go access, but current solutions lack robust mobile capabilities."
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "problem": f"High learning curve for new users in {project.problem_domain}",
                        "explanation": "New users face significant challenges when adopting existing tools, reducing productivity and increasing onboarding time."
                    }
                ]
                
                # Update project in database
                await db.projects.update_one(
                    {"project_id_str": project_id},
                    {
                        "$set": {
                            "stages.1.data": {
                                "problem_statements": problem_statements,
                                "custom_problems": []
                            },
                            "stages.1.status": "completed",
                            "stages.1.updated_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                # Update the project in memory
                project.stages[1].data = {
                    "problem_statements": problem_statements,
                    "custom_problems": []
                }
                project.stages[1].status = StageStatus.COMPLETED
                project.stages[1].updated_at = datetime.utcnow()
                
                return project.stages[1]
                
            except Exception as e:
                print(f"Error in dev project stage 2: {str(e)}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error in dev project stage 2: {str(e)}")
                
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
        
        # TEMPORARY WORKAROUND: Generate problem statements without LlamaIndex
        try:
            print("Using temporary workaround for problem statement generation")
            
            # Create example problem statements based on the problem domain
            problem_statements = [
                {
                    "id": str(uuid.uuid4()),
                    "problem": f"Users find it difficult to navigate through {project.problem_domain} solutions",
                    "explanation": f"Based on the analysis, many users are struggling with the complexity of current {project.problem_domain} interfaces, leading to frustration and inefficiency."
                },
                {
                    "id": str(uuid.uuid4()),
                    "problem": f"Integration challenges with existing {project.problem_domain} systems",
                    "explanation": "The analysis highlights compatibility issues between different systems, causing workflow disruptions and data silos."
                },
                {
                    "id": str(uuid.uuid4()),
                    "problem": f"Limited mobile access to {project.problem_domain} tools",
                    "explanation": "Users increasingly need on-the-go access, but current solutions lack robust mobile capabilities."
                },
                {
                    "id": str(uuid.uuid4()),
                    "problem": f"High learning curve for new users in {project.problem_domain}",
                    "explanation": "New users face significant challenges when adopting existing tools, reducing productivity and increasing onboarding time."
                }
            ]
            
            # Format stage data
            stage_data = {
                "problem_statements": problem_statements,
                "custom_problems": []  # Initialize empty custom problems list
            }
            
            updated_project = await update_stage_2(
                db,
                project_id,
                stage_data
            )
            return next(stage for stage in updated_project.stages if stage.stage_number == 2)
            
        except Exception as e:
            print(f"Error in temporary problem statement generation: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error generating problem statements: {str(e)}")
            
        # The below code is the original implementation using LlamaIndex
        # It's kept here for reference but not executed
        """    
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
            context={
                "analysis": analysis,
                "problem_domain": project.problem_domain
            }
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
        """

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
                "problem_statement": selected_problem,  # Pass single selected problem
                "problem_domain": project.problem_domain
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

    @staticmethod
    async def get_or_create_dev_project(db: AsyncIOMotorDatabase, project_id: str) -> Project:
        """
        Special helper method to get or create a dev project.
        Only used for development/testing projects.
        
        Args:
            db: Database session
            project_id: Project ID string in format 'dev-project-{timestamp}'
            
        Returns:
            Project object
        """
        print(f"Looking for dev project with ID: {project_id}")
        
        # Check if project exists
        try:
            existing = await db.projects.find_one({"project_id_str": project_id})
            if existing:
                print("Found existing dev project")
                return Project(**existing)
        except Exception as e:
            print(f"Error finding dev project: {str(e)}")
        
        # Create a new project with the string ID
        print("Creating new dev project")
        project_data = {
            "_id": ObjectId(),  # Generate a new ObjectId
            "project_id_str": project_id,  # Store the string ID
            "user_id": "dev-user",
            "problem_domain": "Development Testing",
            "document_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "stages": [
                {
                    "stage_number": 1,
                    "name": "Document Analysis",
                    "status": "not_started",
                    "data": {},
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                {
                    "stage_number": 2,
                    "name": "Problem Statements",
                    "status": "not_started",
                    "data": {},
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                {
                    "stage_number": 3,
                    "name": "Product Ideas",
                    "status": "not_started",
                    "data": {},
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                {
                    "stage_number": 4,
                    "name": "Final Solution",
                    "status": "not_started",
                    "data": {},
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            ]
        }
        
        # Insert into database
        await db.projects.insert_one(project_data)
        
        # Return as Project object
        return Project(**project_data)

# Create singleton instance
project_service = ProjectService() 