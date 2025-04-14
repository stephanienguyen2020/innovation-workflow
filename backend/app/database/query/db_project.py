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
    Update stage 3 with selected problem and product ideas.
    
    Args:
        db: Database session
        project_id: Project ID
        stage_data: Dictionary containing selected_problem and product_ideas
        
    Returns:
        Updated project
    """
    project_id_obj = ObjectId(project_id)
    
    # Validate stage data
    if not isinstance(stage_data, dict) or \
       'selected_problem' not in stage_data or \
       'product_ideas' not in stage_data:
        raise ValueError("Invalid stage data format")

    update_result = await db.projects.update_one(
        {"_id": project_id_obj},
        {
            "$set": {
                # Update stage 3
                "stages.$[stage3].data.selected_problem": stage_data["selected_problem"],
                "stages.$[stage3].data.product_ideas": stage_data["product_ideas"],
                "stages.$[stage3].status": StageStatus.COMPLETED.value,
                "stages.$[stage3].updated_at": datetime.utcnow(),
                
                # Reset stage 4
                "stages.$[stage4].data": {},
                "stages.$[stage4].status": StageStatus.NOT_STARTED.value,
                "stages.$[stage4].updated_at": datetime.utcnow(),
                
                # Update project timestamp
                "updated_at": datetime.utcnow()
            }
        },
        array_filters=[
            {"stage3.stage_number": 3},
            {"stage4.stage_number": 4}
        ]
    )
    
    if update_result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Project not found or stage not updated")
        
    return await get_project(db, project_id)

async def update_stage_4(db: AsyncIOMotorDatabase, project_id: str, final_pdf: Dict[str, Any]) -> Project:
    """Update stage 4 with final PDF data."""
    project = await get_project(db, project_id)
    
    # Update stage 4 data
    project.stages[3].data = Stage4Data(final_pdf=final_pdf).dict()
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
