from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.constant.config import SECRET_KEY
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager
import motor.motor_asyncio
import os

# MongoDB connection
MONGODB_CONNECTION_URL = os.getenv("MONGODB_CONNECTION_URL", "mongodb://localhost:27017/chatapp")

# Create a MongoDB client
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_CONNECTION_URL)
db = client.get_database()

@asynccontextmanager
async def lifespan(app: FastAPI):  
    # Create collections if they don't exist
    collections = ["messages", "conversations", "sessions"]
    existing_collections = await db.list_collection_names()
    for collection in collections:
        if collection not in existing_collections:
            await db.create_collection(collection)
    
    yield
    # Close MongoDB connection when app shuts down
    if client is not None:
        client.close()
        
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'], #  allows requests from any origin 
    allow_credentials=True,
    allow_methods=['*'], # allows all HTTP methods
    allow_headers=['*'], # allows all headers
)
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# Add a basic health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint to verify the API is running."""
    return {"status": "ok", "database": "mongodb"}

# Simple Chat API routes
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from uuid import uuid4
from datetime import datetime

# Schema definitions
class ChatRequest(BaseModel):
    text: str

class ChatResponse(BaseModel):
    messages: List[str]

class MessageBase(BaseModel):
    role: str
    content: str
    timestamp: datetime = datetime.utcnow()
    metadata: Optional[Dict[str, Any]] = {}

class ChatHistory(BaseModel):
    messages: List[Dict[str, Any]]
    session_id: str

# Message types
USER_MESSAGE = "user"
ASSISTANT_MESSAGE = "assistant"
SYSTEM_MESSAGE = "system"

router = APIRouter(tags=["conversation"])

@router.post("/chat/new")
async def create_chat_session():
    """
    Create a new chat session and return the session ID.
    """
    session_id = str(uuid4())
    
    # Initialize session with system message
    message_doc = {
        "session_id": session_id,
        "content": "I am an AI assistant. How can I help you today?",
        "role": SYSTEM_MESSAGE,
        "timestamp": datetime.utcnow(),
        "metadata": {}
    }
    
    # Insert the message
    messages_collection = db.messages
    result = await messages_collection.insert_one(message_doc)
    message_id = str(result.inserted_id)
    
    # Create conversation record
    conversations_collection = db.conversations
    await conversations_collection.insert_one({
        "session_id": session_id,
        "message_ids": [message_id],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    return {"session_id": session_id}

@router.post("/chat/{session_id}/message")
async def add_message(
    session_id: str,
    chat_request: ChatRequest,
):
    """
    Add a message to an existing chat session and get a response.
    """
    # Check if session exists
    conversations_collection = db.conversations
    conversation = await conversations_collection.find_one({"session_id": session_id})
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found"
        )
    
    # Add the user message to the database
    messages_collection = db.messages
    user_message = {
        "session_id": session_id,
        "content": chat_request.text,
        "role": USER_MESSAGE,
        "timestamp": datetime.utcnow(),
        "metadata": {}
    }
    
    user_result = await messages_collection.insert_one(user_message)
    user_message_id = str(user_result.inserted_id)
    
    # Update conversation with user message
    await conversations_collection.update_one(
        {"session_id": session_id},
        {
            "$push": {"message_ids": user_message_id},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Generate a simple response 
    response_text = f"You said: {chat_request.text}"
    
    # Store the assistant's response
    assistant_message = {
        "session_id": session_id,
        "content": response_text,
        "role": ASSISTANT_MESSAGE,
        "timestamp": datetime.utcnow(),
        "metadata": {}
    }
    
    assistant_result = await messages_collection.insert_one(assistant_message)
    assistant_message_id = str(assistant_result.inserted_id)
    
    # Update conversation with assistant message
    await conversations_collection.update_one(
        {"session_id": session_id},
        {
            "$push": {"message_ids": assistant_message_id},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return ChatResponse(messages=[response_text])

@router.get("/chat/{session_id}/history")
async def get_chat_history(
    session_id: str,
    limit: int = 50,
):
    """
    Get the chat history for a session.
    """
    # Check if session exists
    conversations_collection = db.conversations
    conversation = await conversations_collection.find_one({"session_id": session_id})
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found"
        )
    
    # Get messages
    messages_collection = db.messages
    cursor = messages_collection.find(
        {"session_id": session_id}
    ).sort("timestamp", 1).limit(limit)
    
    messages = await cursor.to_list(length=limit)
    
    # Format messages
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": msg["content"],
            "time": msg["timestamp"],
            "metadata": msg.get("metadata", {})
        })
    
    return ChatHistory(messages=formatted_messages, session_id=session_id)

@router.delete("/chat/{session_id}")
async def delete_chat_session(
    session_id: str,
):
    """
    Delete a chat session and all its messages.
    """
    # Delete all messages in the session
    messages_collection = db.messages
    await messages_collection.delete_many({"session_id": session_id})
    
    # Delete the conversation record
    conversations_collection = db.conversations
    result = await conversations_collection.delete_one({"session_id": session_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found"
        )
    
    return {"status": "success", "message": f"Session {session_id} deleted"}

# Include the router
app.include_router(router)
    
