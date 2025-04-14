from enum import Enum

class StageStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class ProjectStatus(Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed" 