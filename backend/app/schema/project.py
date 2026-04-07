from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.constant.status import StageStatus, ProjectStatus
import uuid


class ProblemStatement(BaseModel):
    problem: str
    explanation: str
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_custom: bool = False


class ProductIdea(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    idea: str
    detailed_explanation: str
    problem_id: Optional[str] = None
    image_url: Optional[str] = None


# --- Stage Data Models (5-stage workflow) ---

class Stage1Data(BaseModel):
    """Stage 1: Research - upload only, no analysis."""
    uploaded_documents: Optional[List[Dict]] = None  # [{filename, uploaded_at, document_id}]


class Stage2Data(BaseModel):
    """Stage 2: Understand - AI summarization of research."""
    analysis: Optional[str] = None
    summaries: Optional[List[Dict]] = None  # [{document_id, filename, summary}]


class Stage3Data(BaseModel):
    """Stage 3: Analysis - problem definition."""
    problem_statements: Optional[List[ProblemStatement]] = None
    custom_problems: Optional[List[ProblemStatement]] = None


class Stage4Data(BaseModel):
    """Stage 4: Ideate - generate solutions."""
    product_ideas: Optional[List[ProductIdea]] = None


class Stage5Data(BaseModel):
    """Stage 5: Evaluate - user feedback/critiques."""
    feedback_entries: Optional[List[Dict]] = None  # [{feedback_text, target_stage, timestamp}]
    evaluation_notes: Optional[str] = None
    chosen_solution: Optional[ProductIdea] = None


# --- Iteration & Report Models ---

class IterationSnapshot(BaseModel):
    """Snapshot of all stage data for one iteration. Stored in Firestore subcollection."""
    iteration_number: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    feedback_text: Optional[str] = None
    stages_snapshot: Dict = {}  # {stage_number_str: stage_data_dict}


class StageReport(BaseModel):
    """Per-stage report content."""
    report_content: Optional[str] = None
    generated_at: Optional[datetime] = None


# --- Core Models ---

class Stage(BaseModel):
    stage_number: int
    status: StageStatus = Field(default=StageStatus.NOT_STARTED)
    data: Dict = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )


class ProjectCreate(BaseModel):
    problem_domain: str


class Project(BaseModel):
    id: str
    user_id: str
    problem_domain: str
    document_id: Optional[str] = None
    original_file_id: Optional[str] = None
    original_filename: Optional[str] = None
    status: ProjectStatus = Field(default=ProjectStatus.IN_PROGRESS)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    stages: List[Stage] = Field(default_factory=lambda: [
        Stage(stage_number=1, data=Stage1Data().dict()),
        Stage(stage_number=2, data=Stage2Data().dict()),
        Stage(stage_number=3, data=Stage3Data().dict()),
        Stage(stage_number=4, data=Stage4Data().dict()),
        Stage(stage_number=5, data=Stage5Data().dict()),
    ])
    current_iteration: int = 1
    stage_reports: Dict = Field(default_factory=dict)  # {stage_number_str: StageReport dict}
    feedback_loop_in_progress: bool = False
    iteration_feedback: Optional[Dict] = None  # Feedback type flags and chosen problem/solution from last evaluation

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True,
    )

    @model_validator(mode="before")
    @classmethod
    def migrate_4_to_5_stages(cls, data: Any) -> Any:
        """Auto-migrate old 4-stage projects to 5-stage format when loaded from Firestore."""
        if isinstance(data, dict) and "stages" in data:
            stages = data["stages"]
            if isinstance(stages, list) and len(stages) == 4:
                old_s1 = stages[0].get("data", {}) if isinstance(stages[0], dict) else {}
                old_s2 = stages[1].get("data", {}) if isinstance(stages[1], dict) else {}
                old_s3 = stages[2].get("data", {}) if isinstance(stages[2], dict) else {}
                old_s4 = stages[3].get("data", {}) if isinstance(stages[3], dict) else {}

                s1_status = stages[0].get("status", "not_started") if isinstance(stages[0], dict) else "not_started"
                s2_status = stages[1].get("status", "not_started") if isinstance(stages[1], dict) else "not_started"
                s3_status = stages[2].get("status", "not_started") if isinstance(stages[2], dict) else "not_started"
                s4_status = stages[3].get("status", "not_started") if isinstance(stages[3], dict) else "not_started"

                now = datetime.utcnow().isoformat()

                # New Stage 1 (Research): upload info from old stage 1
                new_s1_data = {}
                if data.get("original_filename"):
                    new_s1_data["uploaded_documents"] = [{
                        "filename": data.get("original_filename"),
                        "uploaded_at": now,
                        "document_id": data.get("document_id"),
                    }]

                # New Stage 2 (Understand): analysis from old stage 1
                new_s2_data = {}
                if old_s1.get("analysis"):
                    new_s2_data["analysis"] = old_s1["analysis"]

                # New Stage 3 (Analysis): problem statements from old stage 2
                new_s3_data = {}
                if old_s2.get("problem_statements"):
                    new_s3_data["problem_statements"] = old_s2["problem_statements"]
                if old_s2.get("custom_problems"):
                    new_s3_data["custom_problems"] = old_s2["custom_problems"]

                # New Stage 4 (Ideate): product ideas from old stage 3
                new_s4_data = {}
                if old_s3.get("product_ideas"):
                    new_s4_data["product_ideas"] = old_s3["product_ideas"]

                # New Stage 5 (Evaluate): chosen_solution from old stage 4
                new_s5_data = {}
                if old_s4.get("chosen_solution"):
                    new_s5_data["chosen_solution"] = old_s4["chosen_solution"]

                data["stages"] = [
                    {"stage_number": 1, "status": s1_status, "data": new_s1_data, "created_at": now, "updated_at": now},
                    {"stage_number": 2, "status": s1_status, "data": new_s2_data, "created_at": now, "updated_at": now},
                    {"stage_number": 3, "status": s2_status, "data": new_s3_data, "created_at": now, "updated_at": now},
                    {"stage_number": 4, "status": s3_status, "data": new_s4_data, "created_at": now, "updated_at": now},
                    {"stage_number": 5, "status": s4_status, "data": new_s5_data, "created_at": now, "updated_at": now},
                ]

                # Set defaults for new fields
                data.setdefault("current_iteration", 1)
                data.setdefault("stage_reports", {})
                data.setdefault("feedback_loop_in_progress", False)

        return data
