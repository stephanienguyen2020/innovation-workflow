# Created: dylannguyen
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

# API Request/Response Models
class ChatRequest(BaseModel):
    text: str
    session_id: Optional[str] = None  # Make session_id optional for backward compatibility
    
class AgentResponse(BaseModel):
    messages: List[str]

# MongoDB Document Models
class MessageBase(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class MessageDB(MessageBase):
    id: str = Field(alias="_id")
    session_id: str

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class MessageCreate(MessageBase):
    pass

class ConversationBase(BaseModel):
    session_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ConversationDB(ConversationBase):
    id: str = Field(alias="_id")
    message_ids: List[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

# Client-Facing Models
class MessageConversation(BaseModel):
    role: str
    content: str
    time: datetime
    metadata: Optional[Dict[str, Any]] = None
    
class ChatMessageHistory(BaseModel):
    messages: List[MessageConversation]
    session_id: str