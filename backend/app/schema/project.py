from datetime import datetime
from typing import List, Optional, Dict, Union
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
from app.constant.status import StageStatus, ProjectStatus
import uuid

class ProblemStatement(BaseModel):
    problem: str
    explanation: str
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))  # Required field with default UUID
    is_custom: bool = False  # To identify if this is a user-provided custom problem

class ProductIdea(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))  # Required field with default UUID
    idea: str
    detailed_explanation: str
    problem_id: Optional[str] = None  # Reference to the problem this idea addresses

class Stage1Data(BaseModel):
    analysis: Optional[str] = None

class Stage2Data(BaseModel):
    problem_statements: Optional[List[ProblemStatement]] = None
    custom_problems: Optional[List[ProblemStatement]] = None  # User-provided custom problems

class Stage3Data(BaseModel):
    product_ideas: Optional[List[ProductIdea]] = None  # List of generated product ideas

class Stage4Data(BaseModel):
    chosen_solution: Optional[ProductIdea] = None  # The solution chosen by the user

class Stage(BaseModel):
    stage_number: int
    status: StageStatus = Field(default=StageStatus.NOT_STARTED)
    data: Dict = {}  # Will store the appropriate stage data
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={
            StageStatus: lambda x: x.value
        }
    )

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        if 'status' in d and isinstance(d['status'], StageStatus):
            d['status'] = d['status'].value
        return d

class ProjectCreate(BaseModel):
    problem_domain: str
    
class Project(BaseModel):
    id: ObjectId = Field(alias="_id")
    user_id: ObjectId
    problem_domain: str
    document_id: Optional[str] = None  # Document ID at project level since it's used across stages
    status: ProjectStatus = Field(default=ProjectStatus.IN_PROGRESS)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    stages: List[Stage] = Field(default_factory=lambda: [
        Stage(stage_number=1, data=Stage1Data().dict()),
        Stage(stage_number=2, data=Stage2Data().dict()),
        Stage(stage_number=3, data=Stage3Data().dict()),
        Stage(stage_number=4, data=Stage4Data().dict())
    ])

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str,
            ProjectStatus: lambda x: x.value,
            StageStatus: lambda x: x.value
        },
        populate_by_name=True
    )

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        if 'status' in d and isinstance(d['status'], ProjectStatus):
            d['status'] = d['status'].value
        if 'stages' in d:
            d['stages'] = [
                {**stage, 'status': stage['status'].value if isinstance(stage['status'], StageStatus) else stage['status']}
                for stage in d['stages']
            ]
        return d
