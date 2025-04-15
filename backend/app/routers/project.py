from fastapi import APIRouter, Depends, UploadFile, File, Path, Query, Body
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, Dict
from fastapi import HTTPException

from app.database.database import get_db
from app.schema.project import Project, Stage, ProjectCreate
from app.services.project_service import project_service

router = APIRouter(
    prefix="/projects",
    tags=["projects"]
)

@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify router and auth are working"""
    return {"status": "ok", "message": "Project router is working"}

@router.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    """Test endpoint for file upload only"""
    try:
        content = await file.read()
        return {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "status": "upload successful"
        }
    except Exception as e:
        print(f"Error in test upload: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Test upload failed: {str(e)}")

@router.post("/", response_model=Project)
async def create_project(
    project_data: ProjectCreate,
    user_id: str = Query(..., description="User ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Project:
    """
    Create a new project.
    
    Args:
        project_data: Project creation data containing problem domain
        user_id: ID of the user creating the project (must be a valid ObjectId)
        db: Database connection
    
    Returns:
        Newly created project
    """
    return await project_service.create_project(db, user_id, project_data.problem_domain)

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
async def upload_document(
    file: UploadFile = File(...),
    project_id: str = Path(..., description="Project ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 1 - Part 1: Upload PDF document.
    
    This endpoint:
    1. Accepts a PDF file upload
    2. Processes and stores the PDF content
    3. Updates the project with the document ID
    4. Returns the updated Stage 1 data
    """
    try:
        print(f"Upload document endpoint called for project {project_id}")
        print(f"File: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")
        
        # Process the document using LlamaIndex integration
        return await project_service.upload_document(db, project_id, file)
    except Exception as e:
        print(f"Error in upload_document endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        # Re-raise as HTTP exception with more details
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@router.post("/{project_id}/stages/1/generate", response_model=Stage)
async def analyze_document(
    project_id: str = Path(..., description="Project ID"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 1 - Part 2: Generate document analysis.
    
    This endpoint:
    1. Validates that a document has been uploaded
    2. Processes the PDF content
    3. Generates an analysis using AI
    4. Updates the project with the analysis
    5. Returns the updated Stage 1 data
    """
    return await project_service.analyze_document(db, project_id)

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
    selected_problem_id: Optional[str] = Query(None, description="ID of the selected problem from stage 2"),
    custom_problem: Optional[str] = Query(None, description="Custom problem statement text"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 3: Generate product ideas based on a single selected or custom problem statement.
    
    This endpoint:
    1. Validates that Stages 1 and 2 are completed
    2. Takes either a selected problem ID from stage 2 or a custom problem statement
    3. If custom problem provided, adds it to stage 2's custom problems
    4. Generates product ideas based on the selected/custom problem
    5. Returns the updated Stage 3 data
    
    Note: Must provide either selected_problem_id or custom_problem, but not both
    """
    return await project_service.process_stage_3(
        db, 
        project_id, 
        selected_problem_id=selected_problem_id,
        custom_problem=custom_problem
    )

@router.post("/{project_id}/stages/4/generate")
async def generate_final_document(
    project_id: str = Path(..., description="Project ID"),
    chosen_solution_id: str = Query(..., description="ID of the solution chosen by the user"),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Dict:
    """
    Stage 4: Update chosen solution and return formatted data.
    
    This endpoint:
    1. Validates that all prior stages are completed
    2. Updates stage 4 with the chosen solution
    3. Returns formatted data containing:
       - Analysis from stage 1
       - Chosen problem and its explanation
       - Chosen solution and its explanation
    
    The frontend can use this data to generate a PDF or display it in other formats.
    """
    return await project_service.process_stage_4(
        db, 
        project_id,
        chosen_solution_id
    )
