from datetime import datetime
from typing import Optional, List, Dict
from fastapi import HTTPException
from google.cloud.firestore_v1.async_client import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter
from app.schema.project import (
    Project, Stage,
    Stage1Data, Stage2Data, Stage3Data, Stage4Data, Stage5Data,
    IterationSnapshot, StageReport,
)
from app.constant.status import StageStatus


async def create_project(db: AsyncClient, user_id: str, problem_domain: str) -> Project:
    project_doc = db.collection("projects").document()
    project = Project(
        id=project_doc.id,
        user_id=user_id,
        problem_domain=problem_domain
    )
    project_dict = project.dict()
    await project_doc.set(project_dict)
    return project


async def get_project(db: AsyncClient, project_id: str, user_id: str = None) -> Optional[Project]:
    project_doc = db.collection("projects").document(project_id)
    doc = await project_doc.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    data = doc.to_dict()
    if user_id and data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Project not found or doesn't belong to you")
    data["id"] = doc.id
    return Project(**data)


async def get_projects_by_user_id(db: AsyncClient, user_id: str) -> List[Project]:
    query = db.collection("projects").where(filter=FieldFilter("user_id", "==", user_id))
    docs = await query.get()
    projects = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        projects.append(Project(**data))
    return projects


# --- Helper to persist stages ---

async def _save_stages(db: AsyncClient, project: Project, project_id: str):
    """Save the stages array and updated_at timestamp to Firestore."""
    await db.collection("projects").document(project_id).update({
        "stages": [stage.dict() for stage in project.stages],
        "updated_at": datetime.utcnow()
    })


def _reset_subsequent_stages(project: Project, from_index: int):
    """Reset all stages after from_index to NOT_STARTED with empty data."""
    for stage in project.stages[from_index:]:
        stage.status = StageStatus.NOT_STARTED
        stage.data = {}
        stage.updated_at = datetime.utcnow()


# --- Stage 1: Research (upload only) ---

async def update_stage_1(db: AsyncClient, project_id: str, uploaded_documents: List[Dict] = None) -> Project:
    """Update stage 1 (Research) with uploaded document info."""
    project = await get_project(db, project_id)

    stage_data = Stage1Data(uploaded_documents=uploaded_documents or []).dict()
    project.stages[0].data = stage_data
    project.stages[0].status = StageStatus.COMPLETED
    project.stages[0].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()

    _reset_subsequent_stages(project, 1)
    await _save_stages(db, project, project_id)
    return project


# --- Stage 2: Understand (AI summarization) ---

async def update_stage_2(db: AsyncClient, project_id: str, analysis: str, summaries: List[Dict] = None) -> Project:
    """Update stage 2 (Understand) with analysis text."""
    project = await get_project(db, project_id)

    project.stages[1].data = Stage2Data(analysis=analysis, summaries=summaries).dict()
    project.stages[1].status = StageStatus.COMPLETED
    project.stages[1].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()

    _reset_subsequent_stages(project, 2)
    await _save_stages(db, project, project_id)
    return project


# --- Stage 3: Analysis (problem definition) ---

async def update_stage_3(db: AsyncClient, project_id: str, stage_data: Dict) -> Project:
    """Update stage 3 (Analysis) with problem statements."""
    project = await get_project(db, project_id)

    if not isinstance(stage_data, dict):
        raise ValueError("Stage data must be a dictionary")
    if "problem_statements" not in stage_data:
        raise ValueError("Stage data must contain 'problem_statements'")
    if not isinstance(stage_data["problem_statements"], list):
        raise ValueError("problem_statements must be a list")

    custom_problems = stage_data.get("custom_problems", [])
    if not isinstance(custom_problems, list):
        raise ValueError("custom_problems must be a list")

    project.stages[2].data = Stage3Data(
        problem_statements=stage_data["problem_statements"],
        custom_problems=custom_problems
    ).dict()
    project.stages[2].status = StageStatus.COMPLETED
    project.stages[2].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()

    _reset_subsequent_stages(project, 3)
    await _save_stages(db, project, project_id)
    return project


# --- Stage 4: Ideate (product ideas) ---

async def update_stage_4(db: AsyncClient, project_id: str, stage_data: Dict) -> Project:
    """Update stage 4 (Ideate) with product ideas."""
    project = await get_project(db, project_id)

    if not isinstance(stage_data, dict) or "product_ideas" not in stage_data:
        raise ValueError("Invalid stage data format")

    project.stages[3].data = Stage4Data(
        product_ideas=stage_data["product_ideas"]
    ).dict()
    project.stages[3].status = StageStatus.COMPLETED
    project.stages[3].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()

    _reset_subsequent_stages(project, 4)
    await _save_stages(db, project, project_id)
    return project


# --- Stage 5: Evaluate (user feedback) ---

async def update_stage_5(db: AsyncClient, project_id: str, stage_data: Dict) -> Project:
    """Update stage 5 (Evaluate) with feedback entries and/or chosen solution."""
    project = await get_project(db, project_id)

    project.stages[4].data = Stage5Data(
        feedback_entries=stage_data.get("feedback_entries"),
        evaluation_notes=stage_data.get("evaluation_notes"),
        chosen_solution=stage_data.get("chosen_solution"),
    ).dict()
    project.stages[4].status = StageStatus.COMPLETED
    project.stages[4].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()

    await _save_stages(db, project, project_id)
    return project


# --- Stage getter ---

async def get_stage(db: AsyncClient, project_id: str, stage_number: int) -> Stage:
    if not 1 <= stage_number <= 5:
        raise HTTPException(status_code=400, detail="Invalid stage number. Must be between 1 and 5")

    project = await get_project(db, project_id)
    stage = next((stage for stage in project.stages if stage.stage_number == stage_number), None)

    if not stage:
        raise HTTPException(status_code=404, detail=f"Stage {stage_number} not found")

    return stage


# --- Iteration snapshots (stored as subcollection) ---

async def save_iteration_snapshot(
    db: AsyncClient, project_id: str, feedback_text: str
) -> int:
    """Snapshot all current stage data as an iteration, increment current_iteration.
    Returns the new iteration number."""
    project = await get_project(db, project_id)

    snapshot = IterationSnapshot(
        iteration_number=project.current_iteration,
        feedback_text=feedback_text,
        stages_snapshot={
            str(s.stage_number): s.data for s in project.stages
        }
    )

    # Save to subcollection
    await (
        db.collection("projects")
        .document(project_id)
        .collection("iterations")
        .document(str(project.current_iteration))
        .set(snapshot.dict())
    )

    # Increment iteration counter
    new_iteration = project.current_iteration + 1
    await db.collection("projects").document(project_id).update({
        "current_iteration": new_iteration,
        "updated_at": datetime.utcnow()
    })

    return new_iteration


async def get_iteration_history(db: AsyncClient, project_id: str) -> List[Dict]:
    """Retrieve all iteration snapshots for a project."""
    iterations_ref = (
        db.collection("projects")
        .document(project_id)
        .collection("iterations")
    )
    docs = await iterations_ref.order_by("iteration_number").get()
    return [doc.to_dict() for doc in docs]


async def get_iteration_snapshot(db: AsyncClient, project_id: str, iteration_number: int) -> Optional[Dict]:
    """Retrieve a specific iteration snapshot."""
    doc = await (
        db.collection("projects")
        .document(project_id)
        .collection("iterations")
        .document(str(iteration_number))
        .get()
    )
    return doc.to_dict() if doc.exists else None


# --- Per-stage reports ---

async def save_stage_report(
    db: AsyncClient, project_id: str, stage_number: int, report_content: str
) -> StageReport:
    """Save a per-stage report."""
    report = StageReport(
        report_content=report_content,
        generated_at=datetime.utcnow()
    )

    await db.collection("projects").document(project_id).update({
        f"stage_reports.{stage_number}": report.dict(),
        "updated_at": datetime.utcnow()
    })

    return report


async def get_stage_report(db: AsyncClient, project_id: str, stage_number: int) -> Optional[Dict]:
    """Retrieve a per-stage report."""
    project = await get_project(db, project_id)
    return project.stage_reports.get(str(stage_number))


# --- Feedback loop helpers ---

async def set_feedback_loop_status(db: AsyncClient, project_id: str, in_progress: bool):
    """Set the feedback_loop_in_progress flag."""
    await db.collection("projects").document(project_id).update({
        "feedback_loop_in_progress": in_progress,
        "updated_at": datetime.utcnow()
    })


async def reset_stages_for_feedback_loop(db: AsyncClient, project_id: str) -> Project:
    """Reset stages 2-5 for a new feedback loop iteration (keep stage 1 research intact)."""
    project = await get_project(db, project_id)

    for stage in project.stages[1:]:  # stages 2-5
        stage.status = StageStatus.NOT_STARTED
        stage.data = {}
        stage.updated_at = datetime.utcnow()

    project.updated_at = datetime.utcnow()
    await _save_stages(db, project, project_id)
    return project


# --- PDF data ---

async def get_project_pdf_data(db: AsyncClient, project_id: str) -> Dict:
    """Get project data formatted for PDF generation (maps to new 5-stage layout)."""
    project = await get_project(db, project_id)

    stage_2 = next((s for s in project.stages if s.stage_number == 2), None)
    stage_3 = next((s for s in project.stages if s.stage_number == 3), None)
    stage_4 = next((s for s in project.stages if s.stage_number == 4), None)
    stage_5 = next((s for s in project.stages if s.stage_number == 5), None)

    if not all([stage_2, stage_3, stage_4]):
        raise ValueError("Missing required stage data")

    chosen_solution = None
    if stage_5 and stage_5.data.get("chosen_solution"):
        chosen_solution = stage_5.data["chosen_solution"]
    elif stage_4 and stage_4.data.get("product_ideas"):
        chosen_solution = stage_4.data["product_ideas"][0]  # fallback to first idea

    if not chosen_solution:
        raise ValueError("No chosen solution found")

    all_problems = stage_3.data.get("problem_statements", []) + stage_3.data.get("custom_problems", [])
    chosen_problem = next(
        (p for p in all_problems if p.get("id") == chosen_solution.get("problem_id")),
        None
    )

    if not chosen_problem:
        raise ValueError("Chosen problem not found")

    return {
        "title": "Innovation Workflow Analysis",
        "analysis": stage_2.data.get("analysis", ""),
        "chosen_problem": {
            "statement": chosen_problem.get("problem", ""),
            "explanation": chosen_problem.get("explanation", "")
        },
        "chosen_solution": {
            "idea": chosen_solution.get("idea", ""),
            "explanation": chosen_solution.get("detailed_explanation", ""),
            "image_url": chosen_solution.get("image_url", None)
        }
    }


# --- Document ID & file helpers ---

async def update_document_id(db: AsyncClient, project_id: str, document_id: str) -> Project:
    project = await get_project(db, project_id)
    await db.collection("projects").document(project_id).update({
        "document_id": document_id,
        "updated_at": datetime.utcnow()
    })
    return project


async def update_original_file(
    db: AsyncClient, project_id: str, file_id: str, filename: str
) -> Project:
    project = await get_project(db, project_id)
    await db.collection("projects").document(project_id).update({
        "original_file_id": file_id,
        "original_filename": filename,
        "updated_at": datetime.utcnow()
    })
    return project


# --- Delete operations ---

async def delete_project(db: AsyncClient, project_id: str, user_id: str) -> bool:
    project_doc = db.collection("projects").document(project_id)
    doc = await project_doc.get()
    if not doc.exists or doc.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Project not found or you don't have permission to delete it")

    project_data = doc.to_dict()
    document_id = project_data.get("document_id")

    # Delete associated images
    images_docs = await db.collection("images").where(filter=FieldFilter("project_id", "==", project_id)).get()
    for image_doc in images_docs:
        await db.collection("images").document(image_doc.id).delete()

    # Delete associated RAG chunks
    if document_id:
        rag_docs = await db.collection("rag_documents").where(filter=FieldFilter("parent_doc_id", "==", document_id)).get()
        for rag_doc in rag_docs:
            await db.collection("rag_documents").document(rag_doc.id).delete()

    # Delete associated uploaded files
    file_docs = await db.collection("uploaded_files").where(filter=FieldFilter("project_id", "==", project_id)).get()
    for file_doc in file_docs:
        await db.collection("uploaded_files").document(file_doc.id).delete()

    # Delete iteration subcollection
    iter_docs = await project_doc.collection("iterations").get()
    for iter_doc in iter_docs:
        await project_doc.collection("iterations").document(iter_doc.id).delete()

    await project_doc.delete()
    return True


async def delete_all_data(db: AsyncClient) -> Dict[str, int]:
    rag_docs = await db.collection("rag_documents").get()
    rag_deleted = 0
    for doc in rag_docs:
        await db.collection("rag_documents").document(doc.id).delete()
        rag_deleted += 1

    project_docs = await db.collection("projects").get()
    project_deleted = 0
    for doc in project_docs:
        # Also delete iteration subcollections
        iter_docs = await db.collection("projects").document(doc.id).collection("iterations").get()
        for iter_doc in iter_docs:
            await db.collection("projects").document(doc.id).collection("iterations").document(iter_doc.id).delete()
        await db.collection("projects").document(doc.id).delete()
        project_deleted += 1

    return {
        "rag_documents_deleted": rag_deleted,
        "projects_deleted": project_deleted
    }
