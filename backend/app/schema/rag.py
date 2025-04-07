from typing import Dict, List, Optional, Any
from pydantic import BaseModel

# Request models
class TextIngestRequest(BaseModel):
    text: str
    metadata: Optional[Dict[str, Any]] = None

class DoclingIngestRequest(BaseModel):
    project_id: str
    api_key: str

class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3
    similarity_threshold: Optional[float] = 0.7

# Response models
class IngestResponse(BaseModel):
    success: bool
    message: str
    document_count: Optional[int] = None
    document_id: Optional[str] = None

class QueryResponse(BaseModel):
    query: str
    response: str
    source_nodes: List[Dict[str, Any]]

class DocumentListResponse(BaseModel):
    documents: List[Dict[str, Any]]
    total: int