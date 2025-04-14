from fastapi import APIRouter, Depends, UploadFile, File, Path, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.database.database import get_db
from app.schema.project import Project, Stage
from app.services.project_service import project_service

router = APIRouter(
    prefix="/projects",
    tags=["projects"]
)

@router.post("/", response_model=Project)
async def create_project(
    user_id: str = Query(..., description="User ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Project:
    """Create a new project."""
    return await project_service.create_project(db, user_id)

@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: str = Path(..., description="Project ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Project:
    """Get project by ID."""
    return await project_service.get_project(db, project_id)

@router.get("/{project_id}/stages/{stage_number}", response_model=Stage)
async def get_project_stage(
    project_id: str = Path(..., description="Project ID"),
    stage_number: int = Path(..., ge=1, le=4, description="Stage number (1-4)"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """Get specific stage of a project."""
    return await project_service.get_stage(db, project_id, stage_number)

@router.post("/{project_id}/stages/1/upload", response_model=Stage)
async def upload_and_analyze(
    file: UploadFile = File(...),
    project_id: str = Path(..., description="Project ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 1: Upload PDF and generate analysis.
    
    This endpoint:
    1. Accepts a PDF file upload
    2. Processes the PDF content
    3. Generates an analysis using AI
    4. Updates the project with the analysis and document ID
    5. Returns the updated Stage 1 data
    """
    return await project_service.process_stage_1(db, project_id, file)

@router.post("/{project_id}/stages/2/generate", response_model=Stage)
async def generate_problem_statements(
    project_id: str = Path(..., description="Project ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 2: Generate problem statements based on analysis.
    
    This endpoint:
    1. Validates that Stage 1 is completed
    2. Uses the analysis from Stage 1
    3. Generates 4 problem statements with explanations using AI
    4. Updates the project with the problem statements
    5. Returns the updated Stage 2 data
    """
    return await project_service.process_stage_2(db, project_id)

@router.post("/{project_id}/stages/3/generate", response_model=Stage)
async def generate_product_ideas(
    project_id: str = Path(..., description="Project ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 3: Generate product ideas based on problem statements.
    
    This endpoint:
    1. Validates that Stages 1 and 2 are completed
    2. Uses the analysis and problem statements from prior stages
    3. Generates 3 product ideas with detailed explanations using AI
    4. Updates the project with the product ideas
    5. Returns the updated Stage 3 data
    """
    return await project_service.process_stage_3(db, project_id)

@router.post("/{project_id}/stages/4/generate", response_model=Stage)
async def generate_final_document(
    project_id: str = Path(..., description="Project ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 4: Generate final PDF with all analysis and chosen solutions.
    
    This endpoint:
    1. Validates that all prior stages are completed
    2. Combines data from all prior stages
    3. Generates a comprehensive final document using AI
    4. Updates the project with the final document
    5. Returns the updated Stage 4 data
    """
    return await project_service.process_stage_4(db, project_id)
