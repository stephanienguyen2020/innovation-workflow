from fastapi import APIRouter, Depends, UploadFile, File, Path, Query, Body, HTTPException, Request
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
    return await project_service.create_project(db, user.id, project_data.problem_domain)

@router.get("/", response_model=List[Project])
async def get_user_projects(
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
) -> List[Project]:
    return await project_service.get_user_projects(db, user.id)

@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
) -> Project:
    return await project_service.get_project_by_id(db, project_id, user.id)


@router.delete("/{project_id}")
async def delete_project(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
):
    await project_service.delete_project(db, project_id, user.id)
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/document")
async def get_project_document(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
):
    project = await project_service.get_project_by_id(db, project_id, user.id)

    if not project.document_id:
        raise HTTPException(status_code=404, detail="No document found for this project")

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


# =====================================================================
# Stage CRUD
# =====================================================================

@router.get("/{project_id}/stages/{stage_number}", response_model=Stage)
async def get_project_stage(
    project_id: str = Path(..., description="Project ID"),
    stage_number: int = Path(..., ge=1, le=5, description="Stage number (1-5)"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
) -> Stage:
    return await project_service.get_stage(db, project_id, stage_number, user.id)

@router.post("/{project_id}/stages/{stage_number}", response_model=Stage)
async def save_stage_progress(
    project_id: str = Path(..., description="Project ID"),
    stage_number: int = Path(..., ge=1, le=5, description="Stage number (1-5)"),
    body: Dict = Body(...),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Stage:
    return await project_service.save_stage_progress(
        db, project_id, stage_number, body.get("data", {}), body.get("status", "in_progress"), user.id
    )


# =====================================================================
# Stage 1: Research (upload only)
# =====================================================================

@router.post("/{project_id}/stages/1/upload", response_model=Stage)
async def upload_document(
    file: UploadFile = File(...),
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
) -> Stage:
    """Stage 1: Upload PDF document (Research - upload only, no analysis)."""
    return await project_service.upload_document(db, project_id, file, user.id)

@router.post("/{project_id}/stages/1/upload-text", response_model=Stage)
async def upload_text(
    project_id: str = Path(..., description="Project ID"),
    body: Dict = Body(...),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
) -> Stage:
    """Stage 1: Upload plain text content (Research)."""
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text content is required")
    return await project_service.upload_text(db, project_id, text, user.id)


# =====================================================================
# Stage 2: Understand (AI summarization - streaming)
# =====================================================================

@router.post("/{project_id}/stages/2/generate", response_model=Stage)
async def analyze_document(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Stage:
    """Stage 2: Generate document analysis (non-streaming)."""
    return await project_service.analyze_document(db, project_id, user.id)

@router.post("/{project_id}/stages/2/generate/stream")
async def analyze_document_stream(
    request: Request,
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Stage 2: Generate document analysis via SSE streaming."""
    model_id = request.headers.get("X-Model-Type")

    async def event_generator():
        async for event in project_service.analyze_document_stream(db, project_id, user.id, model_id=model_id):
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


# =====================================================================
# Stage 3: Analysis (problem definition)
# =====================================================================

@router.post("/{project_id}/stages/3/generate", response_model=Stage)
async def generate_problem_statements(
    request: Request,
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Stage:
    """Stage 3: Generate problem statements based on Stage 2 analysis."""
    model_id = request.headers.get("X-Model-Type")
    return await project_service.process_stage_3(db, project_id, user.id, model_id=model_id)


# =====================================================================
# Stage 4: Ideate (product ideas)
# =====================================================================

@router.post("/{project_id}/stages/4/generate", response_model=Stage)
async def generate_product_ideas(
    request: Request,
    project_id: str = Path(..., description="Project ID"),
    selected_problem_id: Optional[str] = Query(None, description="ID of the selected problem from Stage 3"),
    custom_problem: Optional[str] = Query(None, description="Custom problem statement text"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Stage:
    """Stage 4: Generate product ideas based on a selected or custom problem."""
    model_id = request.headers.get("X-Model-Type")
    return await project_service.process_stage_4(
        db,
        project_id,
        user.id,
        selected_problem_id=selected_problem_id,
        custom_problem=custom_problem,
        model_id=model_id,
    )


# =====================================================================
# Stage 5: Evaluate (user feedback)
# =====================================================================

@router.post("/{project_id}/stages/5/submit-feedback", response_model=Stage)
async def submit_feedback(
    project_id: str = Path(..., description="Project ID"),
    body: Dict = Body(...),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Stage:
    """Stage 5: Submit user feedback/evaluation and optionally choose a solution."""
    return await project_service.process_stage_5(
        db,
        project_id,
        user.id,
        feedback_entries=body.get("feedback_entries"),
        evaluation_notes=body.get("evaluation_notes"),
        chosen_solution_id=body.get("chosen_solution_id"),
    )


# =====================================================================
# Comprehensive report (replaces old stage 4 report)
# =====================================================================

@router.get("/{project_id}/comprehensive-report")
async def get_comprehensive_report(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Dict:
    """Get formatted report data from all stages for PDF generation."""
    return await project_service.get_comprehensive_report(db, project_id, user.id)

@router.post("/{project_id}/stages/4/generate-report")
async def generate_final_document(
    project_id: str = Path(..., description="Project ID"),
    chosen_solution_id: str = Query(..., description="ID of the solution chosen by the user"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
) -> Dict:
    """Legacy: Choose solution and return formatted report data.
    Sets chosen solution in Stage 5, then returns comprehensive report."""
    # Set the chosen solution in stage 5
    await project_service.process_stage_5(
        db, project_id, user.id,
        chosen_solution_id=chosen_solution_id,
    )
    # Return the comprehensive report
    return await project_service.get_comprehensive_report(db, project_id, user.id)


# =====================================================================
# Feedback loop
# =====================================================================

@router.post("/{project_id}/feedback-loop")
async def trigger_feedback_loop(
    request: Request,
    project_id: str = Path(..., description="Project ID"),
    body: Dict = Body(...),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Trigger the feedback loop: snapshot current state, then re-run stages 2-4 with feedback.
    Returns SSE stream with progress updates."""
    feedback_text = body.get("feedback_text", "").strip()
    if not feedback_text:
        raise HTTPException(status_code=400, detail="Feedback text is required")

    model_id = request.headers.get("X-Model-Type")

    async def event_generator():
        async for event in project_service.trigger_feedback_loop(
            db, project_id, user.id, feedback_text, model_id=model_id
        ):
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


# =====================================================================
# Iteration history
# =====================================================================

@router.get("/{project_id}/iterations")
async def get_iterations(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> List[Dict]:
    """Get all iteration snapshots for a project."""
    return await project_service.get_iteration_history(db, project_id, user.id)

@router.get("/{project_id}/iterations/{iteration_number}")
async def get_iteration(
    project_id: str = Path(..., description="Project ID"),
    iteration_number: int = Path(..., ge=1, description="Iteration number"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Dict:
    """Get a specific iteration snapshot."""
    return await project_service.get_iteration_snapshot(db, project_id, iteration_number, user.id)


# =====================================================================
# Per-stage reports
# =====================================================================

@router.post("/{project_id}/stages/{stage_number}/report")
async def generate_stage_report(
    request: Request,
    project_id: str = Path(..., description="Project ID"),
    stage_number: int = Path(..., ge=1, le=5, description="Stage number (1-5)"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Dict:
    """Generate a standalone report for a specific stage."""
    model_id = request.headers.get("X-Model-Type")
    return await project_service.generate_stage_report(db, project_id, stage_number, user.id, model_id=model_id)

@router.get("/{project_id}/stages/{stage_number}/report")
async def get_stage_report(
    project_id: str = Path(..., description="Project ID"),
    stage_number: int = Path(..., ge=1, le=5, description="Stage number (1-5)"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Dict:
    """Get an existing per-stage report."""
    return await project_service.get_stage_report(db, project_id, stage_number, user.id)


# =====================================================================
# Idea operations
# =====================================================================

@router.post("/{project_id}/ideas/{idea_id}/regenerate-image", response_model=Dict)
async def regenerate_idea_image(
    project_id: str = Path(..., description="Project ID"),
    idea_id: str = Path(..., description="Product Idea ID"),
    feedback: Optional[str] = Body(None, embed=True, description="User feedback on what to change in the visualization"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Dict:
    """Regenerate the concept image for a specific product idea."""
    return await project_service.regenerate_idea_image(db, project_id, idea_id, user.id, feedback)

@router.post("/{project_id}/ideas/{idea_id}/regenerate", response_model=Dict)
async def regenerate_idea(
    request: Request,
    project_id: str = Path(..., description="Project ID"),
    idea_id: str = Path(..., description="Product Idea ID"),
    feedback: str = Body(..., embed=True, description="User feedback on what to improve in the idea"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> Dict:
    """Iterate on a specific product idea using user feedback."""
    model_id = request.headers.get("X-Model-Type")
    return await project_service.regenerate_idea(db, project_id, idea_id, user.id, feedback, model_id=model_id)


# =====================================================================
# Image proxy
# =====================================================================

@router.get("/image-proxy")
async def image_proxy(image_url: str = Query(..., description="The URL of the image to proxy")):
    image_bytes = await project_service.proxy_image(image_url)
    return Response(content=image_bytes, media_type="image/png")


# =====================================================================
# File operations
# =====================================================================

@router.get("/{project_id}/file")
async def get_project_file(
    project_id: str = Path(..., description="Project ID"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncClient = Depends(get_db)
):
    project = await project_service.get_project_by_id(db, project_id, user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not hasattr(project, 'original_file_id') or not project.original_file_id:
        raise HTTPException(status_code=404, detail="No file uploaded for this project")

    file_data = await file_service.get_file(project.original_file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found in storage")

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
    project = await project_service.get_project_by_id(db, project_id, user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

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
