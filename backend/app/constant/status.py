from enum import Enum

class StageStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class ProjectStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed" 