from fastapi import APIRouter, Depends, UploadFile, File, Path, Query, Body, HTTPException
from fastapi.responses import Response, StreamingResponse
from google.cloud.firestore_v1.async_client import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter
from typing import Optional, Dict, List
import json

from app.database.database import get_db
from app.schema.project import Project, Stage, ProjectCreate
from app.services.project_service import project_service
from app.services.image_service import image_service
from app.services.file_service import file_service
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
    db: AsyncClient = Depends(get_db)
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
    db: AsyncClient = Depends(get_db)
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
    db: AsyncClient = Depends(get_db)
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


@router.delete("/{project_id}")
async def delete_project(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
):
    """
    Delete a project by ID, validating that it belongs to the current authenticated user.
    
    Args:
        project_id: Project ID
        user: Current authenticated user from JWT token
        db: Database connection
    
    Returns:
        Success message if project was deleted
    """
    await project_service.delete_project(db, project_id, user.id)
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/document")
async def get_project_document(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
):
    """
    Get the original document content for a project.
    
    Args:
        project_id: Project ID
        user: Current authenticated user from JWT token
        db: Database connection
    
    Returns:
        Document text content if available
    """
    # Get the project to verify ownership and get document_id
    project = await project_service.get_project_by_id(db, project_id, user.id)
    
    if not project.document_id:
        raise HTTPException(status_code=404, detail="No document found for this project")
    
    # Get the document from rag_documents collection
    rag_collection = db.collection("rag_documents")
    doc_ref = rag_collection.document(project.document_id)
    document = await doc_ref.get()
    if not document.exists:
        docs = await rag_collection.where(filter=FieldFilter("parent_doc_id", "==", project.document_id)).limit(1).get()
        document = docs[0] if docs else None
    if not document:
        raise HTTPException(status_code=404, detail="Document content not found")
    
    return {
        "text": document.to_dict().get("text", ""),
        "metadata": document.to_dict().get("metadata", {})
    }


@router.get("/{project_id}/stages/{stage_number}", response_model=Stage)
async def get_project_stage(
    project_id: str = Path(..., description="Project ID"),
    stage_number: int = Path(..., ge=1, le=4, description="Stage number (1-4)"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
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

@router.post("/{project_id}/stages/{stage_number}", response_model=Stage)
async def save_stage_progress(
    project_id: str = Path(..., description="Project ID"),
    stage_number: int = Path(..., ge=1, le=4, description="Stage number (1-4)"),
    body: Dict = Body(...),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Stage:
    """Save progress for a specific stage."""
    return await project_service.save_stage_progress(
        db, project_id, stage_number, body.get("data", {}), body.get("status", "in_progress"), user.id
    )

@router.post("/{project_id}/stages/1/upload", response_model=Stage)
async def upload_document(
    file: UploadFile = File(...),
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
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

@router.post("/{project_id}/stages/1/upload-text", response_model=Stage)
async def upload_text(
    project_id: str = Path(..., description="Project ID"),
    body: Dict = Body(...),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
) -> Stage:
    """
    Stage 1 - Part 1 (alt): Upload plain text content instead of PDF.
    """
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text content is required")
    return await project_service.upload_text(db, project_id, text, user.id)

@router.post("/{project_id}/stages/1/generate", response_model=Stage)
async def analyze_document(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
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

@router.post("/{project_id}/stages/1/generate/stream")
async def analyze_document_stream(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    print(f"DEBUG ROUTER: Stream endpoint hit for project {project_id}, user {user.id}")

    async def event_generator():
        async for event in project_service.analyze_document_stream(db, project_id, user.id):
            event_type = event["event"]
            event_data = json.dumps(event["data"])
            yield f"event: {event_type}\ndata: {event_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.post("/{project_id}/stages/2/generate", response_model=Stage)
async def generate_problem_statements(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
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
    db: AsyncClient = Depends(get_db),
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
        custom_problem=custom_problem,
    )

@router.post("/{project_id}/stages/4/generate")
async def generate_final_document(
    project_id: str = Path(..., description="Project ID"),
    chosen_solution_id: str = Query(..., description="ID of the solution chosen by the user"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
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

@router.post("/{project_id}/ideas/{idea_id}/regenerate-image", response_model=Dict)
async def regenerate_idea_image(
    project_id: str = Path(..., description="Project ID"),
    idea_id: str = Path(..., description="Product Idea ID"),
    feedback: Optional[str] = Body(None, embed=True, description="User feedback on what to change in the visualization"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Dict:
    """
    Regenerate the concept image for a specific product idea.
    Optionally accepts user feedback to customize the regeneration.
    """
    return await project_service.regenerate_idea_image(db, project_id, idea_id, user.id, feedback)

@router.post("/{project_id}/ideas/{idea_id}/regenerate", response_model=Dict)
async def regenerate_idea(
    project_id: str = Path(..., description="Project ID"),
    idea_id: str = Path(..., description="Product Idea ID"),
    feedback: str = Body(..., embed=True, description="User feedback on what to improve in the idea"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Dict:
    """
    Iterate on a specific product idea using user feedback (professor's Prompt 3).

    Takes user feedback on an existing idea and generates one improved idea that
    directly addresses the feedback while still solving the original problem.
    Also regenerates the concept image for the improved idea.

    Returns the updated idea with improved content and a new image URL.
    """
    return await project_service.regenerate_idea(db, project_id, idea_id, user.id, feedback)

@router.get("/image-proxy")
async def image_proxy(image_url: str = Query(..., description="The URL of the image to proxy")):
    """
    Proxy an image from an external URL to avoid CORS issues in the frontend.
    """
    image_bytes = await project_service.proxy_image(image_url)
    return Response(content=image_bytes, media_type="image/png")

@router.get("/{project_id}/file")
async def get_project_file(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
):
    """
    Get the original uploaded file (PDF/document) for a project.
    
    Returns the file as a binary response with appropriate content type.
    """
    # First verify the user has access to this project
    project = await project_service.get_project_by_id(db, project_id, user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if project has an original file
    if not hasattr(project, 'original_file_id') or not project.original_file_id:
        raise HTTPException(status_code=404, detail="No file uploaded for this project")
    
    # Get the file from the file service
    file_data = await file_service.get_file(project.original_file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found in storage")
    
    # Return the file with appropriate headers
    return Response(
        content=file_data["file_data"],
        media_type=file_data["content_type"],
        headers={
            "Content-Disposition": f'inline; filename="{file_data["filename"]}"',
            "Content-Length": str(file_data["file_size"])
        }
    )

@router.get("/{project_id}/file/info")
async def get_project_file_info(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
):
    """
    Get metadata about the original uploaded file for a project.
    
    Returns file info without the actual file content.
    """
    # First verify the user has access to this project
    project = await project_service.get_project_by_id(db, project_id, user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if project has an original file
    if not hasattr(project, 'original_file_id') or not project.original_file_id:
        return {
            "has_file": False,
            "filename": None,
            "file_id": None
        }
    
    return {
        "has_file": True,
        "filename": getattr(project, 'original_filename', None),
        "file_id": project.original_file_id
    }
