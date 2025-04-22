from fastapi import APIRouter, Depends, UploadFile, File, Path, Query, Body
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, Dict, List

from app.database.database import get_db
from app.schema.project import Project, Stage, ProjectCreate
from app.services.project_service import project_service
from app.middleware.auth import get_current_user
from app.schema.user import UserProfile

router = APIRouter(
    prefix="/projects",
    tags=["projects"]
)

@router.post("/", response_model=Project)
async def create_project(
    project_data: ProjectCreate,
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Project:
    """
    Create a new project.
    
    Args:
        project_data: Project creation data containing problem domain
        user: Current authenticated user from JWT token
        db: Database connection
    
    Returns:
        Newly created project
    """
    return await project_service.create_project(db, user.id, project_data.problem_domain)

@router.get("/", response_model=List[Project])
async def get_user_projects(
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> List[Project]:
    """
    Get all projects belonging to the current authenticated user.
    
    Args:
        user: Current authenticated user from JWT token
        db: Database connection
    
    Returns:
        List of projects belonging to the user
    """
    return await project_service.get_user_projects(db, user.id)

@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Project:
    """
    Get project by ID, validating that it belongs to the current authenticated user.
    
    Args:
        project_id: Project ID
        user: Current authenticated user from JWT token
        db: Database connection
    
    Returns:
        Project if found and belongs to the user
    """
    return await project_service.get_project_by_id(db, project_id, user.id)

@router.get("/{project_id}/stages/{stage_number}", response_model=Stage)
async def get_project_stage(
    project_id: str = Path(..., description="Project ID"),
    stage_number: int = Path(..., ge=1, le=4, description="Stage number (1-4)"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Get specific stage of a project.
    
    Args:
        project_id: Project ID
        stage_number: Stage number (1-4)
        user: Current authenticated user from JWT token
        db: Database connection
    """
    return await project_service.get_stage(db, project_id, stage_number, user.id)

@router.post("/{project_id}/stages/1/upload", response_model=Stage)
async def upload_document(
    file: UploadFile = File(...),
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 1 - Part 1: Upload PDF document.
    
    This endpoint:
    1. Validates user has access to the project
    2. Accepts a PDF file upload
    3. Processes and stores the PDF content
    4. Updates the project with the document ID
    5. Returns the updated Stage 1 data
    """
    return await project_service.upload_document(db, project_id, file, user.id)

@router.post("/{project_id}/stages/1/generate", response_model=Stage)
async def analyze_document(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 1 - Part 2: Generate document analysis.
    
    This endpoint:
    1. Validates user has access to the project
    2. Validates that a document has been uploaded
    3. Processes the PDF content
    4. Generates an analysis using AI
    5. Updates the project with the analysis
    6. Returns the updated Stage 1 data
    """
    return await project_service.analyze_document(db, project_id, user.id)

@router.post("/{project_id}/stages/2/generate", response_model=Stage)
async def generate_problem_statements(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 2: Generate problem statements based on analysis.
    
    This endpoint:
    1. Validates user has access to the project
    2. Validates that Stage 1 is completed
    3. Uses the analysis from Stage 1
    4. Generates 4 problem statements with explanations using AI
    5. Updates the project with the problem statements
    6. Returns the updated Stage 2 data
    """
    return await project_service.process_stage_2(db, project_id, user.id)

@router.post("/{project_id}/stages/3/generate", response_model=Stage)
async def generate_product_ideas(
    project_id: str = Path(..., description="Project ID"),
    selected_problem_id: Optional[str] = Query(None, description="ID of the selected problem from stage 2"),
    custom_problem: Optional[str] = Query(None, description="Custom problem statement text"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Stage:
    """
    Stage 3: Generate product ideas based on a single selected or custom problem statement.
    
    This endpoint:
    1. Validates user has access to the project
    2. Validates that Stages 1 and 2 are completed
    3. Takes either a selected problem ID from stage 2 or a custom problem statement
    4. If custom problem provided, adds it to stage 2's custom problems
    5. Generates product ideas based on the selected/custom problem
    6. Returns the updated Stage 3 data
    
    Note: Must provide either selected_problem_id or custom_problem, but not both
    """
    return await project_service.process_stage_3(
        db, 
        project_id,
        user.id,
        selected_problem_id=selected_problem_id,
        custom_problem=custom_problem
    )

@router.post("/{project_id}/stages/4/generate")
async def generate_final_document(
    project_id: str = Path(..., description="Project ID"),
    chosen_solution_id: str = Query(..., description="ID of the solution chosen by the user"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> Dict:
    """
    Stage 4: Update chosen solution and return formatted data.
    
    This endpoint:
    1. Validates user has access to the project
    2. Validates that all prior stages are completed
    3. Updates stage 4 with the chosen solution
    4. Returns formatted data containing:
       - Analysis from stage 1
       - Chosen problem and its explanation
       - Chosen solution and its explanation
    
    The frontend can use this data to generate a PDF or display it in other formats.
    """
    return await project_service.process_stage_4(
        db, 
        project_id,
        chosen_solution_id,
        user.id
    )
