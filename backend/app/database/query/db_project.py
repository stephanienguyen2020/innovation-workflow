from datetime import datetime
from typing import Optional
from bson import ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schema.project import Project, Stage, Stage1Data
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

async def get_stage(db: AsyncIOMotorDatabase, project_id: str, stage_number: int) -> Stage:
    if not 1 <= stage_number <= 4:
        raise HTTPException(status_code=400, detail="Invalid stage number. Must be between 1 and 4")
    
    project = await get_project(db, project_id)
    stage = next((stage for stage in project.stages if stage.stage_number == stage_number), None)
    
    if not stage:
        raise HTTPException(status_code=404, detail=f"Stage {stage_number} not found")
    
    return stage
