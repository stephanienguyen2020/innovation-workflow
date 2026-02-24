from datetime import datetime
from typing import Optional, List, Dict
from fastapi import HTTPException
from google.cloud.firestore_v1.async_client import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter
from app.schema.project import Project, Stage, Stage1Data, Stage2Data, Stage3Data, Stage4Data
from app.constant.status import StageStatus

async def create_project(db: AsyncClient, user_id: str, problem_domain: str) -> Project:
    """
    Create a new project.
    
    Args:
        db: Database session
        user_id: User ID
        problem_domain: Domain or area the project will focus on
        
    Returns:
        Newly created project
    """
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
    """
    Get project by ID with optional user validation.
    Handles both ObjectId and String formats for IDs.
    """
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
    """
    Get all projects for a specific user.
    Handles both ObjectId and String formats for user_id.
    """
    query = db.collection("projects").where(filter=FieldFilter("user_id", "==", user_id))
    docs = await query.get()
    projects = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        projects.append(Project(**data))
    return projects

async def update_stage_1(db: AsyncClient, project_id: str, analysis: str) -> Project:
    """
    Update stage 1 with analysis and mark it as completed.
    
    Args:
        db: Database session
        project_id: Project ID
        analysis: Analysis text generated from the document
        
    Returns:
        Updated project
    """
    # Get current project
    project = await get_project(db, project_id)
    
    # Validate document exists
    if not project.document_id:
        raise ValueError("No document found. Please upload a document first.")
    
    # Update stage 1 data with proper structure
    project.stages[0].data = Stage1Data(analysis=analysis).dict()
    project.stages[0].status = StageStatus.COMPLETED
    project.stages[0].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()
    
    # Reset subsequent stages
    for stage in project.stages[1:]:
        stage.status = StageStatus.NOT_STARTED
        stage.data = {}
        stage.updated_at = datetime.utcnow()
    
    # Update project
    await db.collection("projects").document(project_id).update({
        "stages": [stage.dict() for stage in project.stages],
        "updated_at": datetime.utcnow()
    })
    
    return project

async def update_stage_2(
    db: AsyncClient,
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
    await db.collection("projects").document(project_id).update({
        "stages": [stage.dict() for stage in project.stages],
        "updated_at": datetime.utcnow()
    })
    
    return project

async def update_stage_3(
    db: AsyncClient,
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
    await db.collection("projects").document(project_id).update({
        "stages": [stage.dict() for stage in project.stages],
        "updated_at": datetime.utcnow()
    })
    
    return project

async def update_stage_4(
    db: AsyncClient,
    project_id: str, 
    stage_data: Dict
) -> Project:
    """
    Update stage 4 with the chosen solution.
    
    Args:
        db: Database session
        project_id: Project ID
        stage_data: Dictionary containing the chosen solution object
        
    Returns:
        Updated project
    """
    project = await get_project(db, project_id)
    
    # The stage_data should be a dict like {"chosen_solution": {...}}
    if "chosen_solution" not in stage_data or not isinstance(stage_data["chosen_solution"], dict):
        raise ValueError("Invalid data provided for stage 4 update. Expected {'chosen_solution': {...}}.")

    # Update stage 4 data with chosen solution
    project.stages[3].data = Stage4Data(chosen_solution=stage_data["chosen_solution"]).dict()
    project.stages[3].status = StageStatus.COMPLETED
    project.stages[3].updated_at = datetime.utcnow()
    project.updated_at = datetime.utcnow()
    
    # Update project
    await db.collection("projects").document(project_id).update({
        "stages": [stage.dict() for stage in project.stages],
        "updated_at": datetime.utcnow()
    })
    
    return project

async def get_stage(db: AsyncClient, project_id: str, stage_number: int) -> Stage:
    if not 1 <= stage_number <= 4:
        raise HTTPException(status_code=400, detail="Invalid stage number. Must be between 1 and 4")
    
    project = await get_project(db, project_id)
    stage = next((stage for stage in project.stages if stage.stage_number == stage_number), None)
    
    if not stage:
        raise HTTPException(status_code=404, detail=f"Stage {stage_number} not found")
    
    return stage

async def get_project_pdf_data(db: AsyncClient, project_id: str) -> Dict:
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
            "explanation": chosen_solution.get("detailed_explanation", ""),
            "image_url": chosen_solution.get("image_url", None)
        }
    }

async def update_document_id(db: AsyncClient, project_id: str, document_id: str) -> Project:
    """
    Update only the document_id of a project without modifying stage data.
    
    Args:
        db: Database session
        project_id: Project ID
        document_id: New document ID from RAG service
        
    Returns:
        Updated project
    """
    # Get current project
    project = await get_project(db, project_id)
    
    # Update only document_id and timestamp
    await db.collection("projects").document(project_id).update({
        "document_id": document_id,
        "updated_at": datetime.utcnow()
    })
    
    return project

async def update_original_file(
    db: AsyncClient,
    project_id: str, 
    file_id: str,
    filename: str
) -> Project:
    """
    Update the original file info of a project.

    Args:
        db: Database session
        project_id: Project ID
        file_id: ID of the stored file
        filename: Original filename

    Returns:
        Updated project
    """
    # Get current project
    project = await get_project(db, project_id)

    # Update original file info
    await db.collection("projects").document(project_id).update({
        "original_file_id": file_id,
        "original_filename": filename,
        "updated_at": datetime.utcnow()
    })
    
    return project

async def delete_project(db: AsyncClient, project_id: str, user_id: str) -> bool:
    """
    Delete a specific project and its associated data.
    
    Args:
        db: Database session
        project_id: Project ID to delete
        user_id: User ID for ownership verification
        
    Returns:
        True if project was deleted successfully
        
    Raises:
        HTTPException: If project not found or user doesn't own it
    """
    # First verify the project exists and belongs to the user
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

    # Delete associated RAG chunks (keyed by parent_doc_id = project.document_id)
    if document_id:
        rag_docs = await db.collection("rag_documents").where(filter=FieldFilter("parent_doc_id", "==", document_id)).get()
        for rag_doc in rag_docs:
            await db.collection("rag_documents").document(rag_doc.id).delete()

    # Delete associated uploaded files
    file_docs = await db.collection("uploaded_files").where(filter=FieldFilter("project_id", "==", project_id)).get()
    for file_doc in file_docs:
        await db.collection("uploaded_files").document(file_doc.id).delete()

    await project_doc.delete()
    return True


async def delete_all_data(db: AsyncClient) -> Dict[str, int]:
    """
    Delete all documents from both rag_documents and projects collections.
    
    Args:
        db: Database session
        
    Returns:
        Dictionary containing count of deleted documents from each collection
    """
    # Delete all documents from rag_documents collection
    rag_docs = await db.collection("rag_documents").get()
    rag_deleted = 0
    for doc in rag_docs:
        await db.collection("rag_documents").document(doc.id).delete()
        rag_deleted += 1

    project_docs = await db.collection("projects").get()
    project_deleted = 0
    for doc in project_docs:
        await db.collection("projects").document(doc.id).delete()
        project_deleted += 1

    return {
        "rag_documents_deleted": rag_deleted,
        "projects_deleted": project_deleted
    }
