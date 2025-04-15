from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schema.project import Project, Stage, Stage1Data, Stage2Data, Stage3Data, Stage4Data
from app.constant.status import StageStatus

async def create_project(db: AsyncIOMotorDatabase, user_id: str) -> Project:
    # Create a new ObjectId for the project
    project_id = ObjectId()
    
    # Create project with required id
    project = Project(_id=project_id, user_id=ObjectId(user_id))
    
    # Insert into database
    await db.projects.insert_one(project.dict(by_alias=True))
    return project

async def get_project(db: AsyncIOMotorDatabase, project_id: str) -> Optional[Project]:
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**project)

async def update_stage_1(db: AsyncIOMotorDatabase, project_id: str, analysis: str, document_id: str) -> Project:
    # Get current project
    project = await get_project(db, project_id)
    
    # Update stage 1 data with proper structure
    project.stages[0].data = Stage1Data(analysis=analysis).dict()
    project.document_id = document_id
    project.stages[0].status = StageStatus.COMPLETED
    project.stages[0].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()
    
    # Update project
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$set": {
                "stages": [stage.dict() for stage in project.stages],
                "document_id": document_id,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return project

async def update_stage_2(
    db: AsyncIOMotorDatabase, 
    project_id: str, 
    stage_data: Dict
) -> Project:
    """
    Update stage 2 with problem statements and custom problems.
    
    Args:
        db: Database session
        project_id: Project ID
        stage_data: Dictionary containing problem_statements and optional custom_problems
        
    Returns:
        Updated project
    """
    project = await get_project(db, project_id)
    
    # Validate stage data
    if not isinstance(stage_data, dict):
        raise ValueError("Stage data must be a dictionary")
    
    if "problem_statements" not in stage_data:
        raise ValueError("Stage data must contain 'problem_statements'")
        
    if not isinstance(stage_data["problem_statements"], list):
        raise ValueError("problem_statements must be a list")
        
    # Ensure custom_problems is a list if provided
    custom_problems = stage_data.get("custom_problems", [])
    if not isinstance(custom_problems, list):
        raise ValueError("custom_problems must be a list")
    
    # Update stage 2 data with proper structure
    project.stages[1].data = Stage2Data(
        problem_statements=stage_data["problem_statements"],
        custom_problems=custom_problems
    ).dict()
    project.stages[1].status = StageStatus.COMPLETED
    project.stages[1].updated_at = datetime.utcnow()
    
    # Reset subsequent stages
    for stage in project.stages[2:]:
        stage.status = StageStatus.NOT_STARTED
        stage.data = {}
        stage.updated_at = datetime.utcnow()
    
    project.updated_at = datetime.utcnow()
    
    # Update project
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$set": {
                "stages": [stage.dict() for stage in project.stages],
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return project

async def update_stage_3(
    db: AsyncIOMotorDatabase,
    project_id: str,
    stage_data: Dict
) -> Project:
    """
    Update stage 3 with product ideas.
    
    Args:
        db: Database session
        project_id: Project ID
        stage_data: Dictionary containing product_ideas
        
    Returns:
        Updated project
    """
    project = await get_project(db, project_id)
    
    # Validate stage data
    if not isinstance(stage_data, dict) or 'product_ideas' not in stage_data:
        raise ValueError("Invalid stage data format")

    # Update stage 3 data with proper structure using Pydantic model
    project.stages[2].data = Stage3Data(
        product_ideas=stage_data["product_ideas"]
    ).dict()
    project.stages[2].status = StageStatus.COMPLETED
    project.stages[2].updated_at = datetime.utcnow()
    
    # Reset stage 4
    project.stages[3].status = StageStatus.NOT_STARTED
    project.stages[3].data = {}
    project.stages[3].updated_at = datetime.utcnow()
    
    project.updated_at = datetime.utcnow()
    
    # Update project
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$set": {
                "stages": [stage.dict() for stage in project.stages],
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return project

async def update_stage_4(
    db: AsyncIOMotorDatabase, 
    project_id: str, 
    chosen_solution_id: str
) -> Project:
    """
    Update stage 4 with the chosen solution.
    
    Args:
        db: Database session
        project_id: Project ID
        chosen_solution_id: ID of the chosen solution from stage 3
        
    Returns:
        Updated project
    """
    project = await get_project(db, project_id)
    
    # Get the chosen solution from stage 3
    stage_3 = next((stage for stage in project.stages if stage.stage_number == 3), None)
    if not stage_3 or not stage_3.data.get("product_ideas"):
        raise ValueError("Stage 3 data missing or incomplete")
        
    chosen_solution = next(
        (idea for idea in stage_3.data["product_ideas"] 
         if idea.get("id") == chosen_solution_id),
        None
    )
    if not chosen_solution:
        raise ValueError(f"Solution with ID {chosen_solution_id} not found")
    
    # Update stage 4 data with chosen solution
    project.stages[3].data = Stage4Data(chosen_solution=chosen_solution).dict()
    project.stages[3].status = StageStatus.COMPLETED
    project.stages[3].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()
    
    # Update project
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$set": {
                "stages": [stage.dict() for stage in project.stages],
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return project

async def get_stage(db: AsyncIOMotorDatabase, project_id: str, stage_number: int) -> Stage:
    if not 1 <= stage_number <= 4:
        raise HTTPException(status_code=400, detail="Invalid stage number. Must be between 1 and 4")
    
    project = await get_project(db, project_id)
    stage = next((stage for stage in project.stages if stage.stage_number == stage_number), None)
    
    if not stage:
        raise HTTPException(status_code=404, detail=f"Stage {stage_number} not found")
    
    return stage

async def get_project_pdf_data(db: AsyncIOMotorDatabase, project_id: str) -> Dict:
    """
    Get project data formatted for PDF generation.
    
    Args:
        db: Database session
        project_id: Project ID
        
    Returns:
        Dictionary containing formatted project data for PDF
    """
    project = await get_project(db, project_id)
    
    # Get data from relevant stages
    stage_1 = next((s for s in project.stages if s.stage_number == 1), None)
    stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
    stage_3 = next((s for s in project.stages if s.stage_number == 3), None)
    stage_4 = next((s for s in project.stages if s.stage_number == 4), None)
    
    if not all([stage_1, stage_2, stage_3, stage_4]):
        raise ValueError("Missing required stage data")
        
    if not stage_4.data.get("chosen_solution"):
        raise ValueError("No chosen solution found in stage 4")
        
    chosen_solution = stage_4.data["chosen_solution"]
    chosen_problem = next(
        (p for p in stage_2.data.get("problem_statements", []) + stage_2.data.get("custom_problems", [])
         if p.get("id") == chosen_solution.get("problem_id")),
        None
    )
    
    if not chosen_problem:
        raise ValueError("Chosen problem not found")
    
    return {
        "title": "Innovation Workflow Analysis",
        "analysis": stage_1.data.get("analysis", ""),
        "chosen_problem": {
            "statement": chosen_problem.get("problem", ""),
            "explanation": chosen_problem.get("explanation", "")
        },
        "chosen_solution": {
            "idea": chosen_solution.get("idea", ""),
            "explanation": chosen_solution.get("detailed_explanation", "")
        }
    }
