import json
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from typing import Dict, List, Optional

from app.schema.conversation import ChatRequest, ChatMessageHistory, AgentResponse
from app.services.conversation_service import ChatService

router = APIRouter(tags=["conversation"])

@router.post("/chat/new")
async def create_chat_session():
    """
    Create a new chat session and return the session ID.
    """
    session_id = await ChatService.create_session()
    return {"session_id": session_id}

@router.post("/chat/{session_id}/message")
async def add_message(
    session_id: str,
    chat_request: ChatRequest,
):
    """
    Add a message to an existing chat session and get a response.
    """
    # Validate session exists - this will throw an error if session doesn't exist
    # by attempting to access the conversation
    history = await ChatService.get_chat_history(session_id)
    
    # Add the user message to the database
    await ChatService.add_user_message(session_id, chat_request.text)
    
    # Get AI context from chat history
    ai_context = await ChatService.get_ai_context(session_id)
    
    # TODO: Replace this with your actual AI agent call, this is a placeholder response
    agent_response = AgentResponse(messages=[f"You said: {chat_request.text}"])
    
    # Store the assistant's response in the database
    message_ids = await ChatService.process_agent_response(session_id, agent_response)
    
    return agent_response

@router.get("/chat/{session_id}/history")
async def get_chat_history(
    session_id: str,
    limit: int = 50,
):
    """
    Get the chat history for a session.
    """
    try:
        history = await ChatService.get_chat_history(session_id, limit)
        return history
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found"
        )

@router.delete("/chat/{session_id}")
async def delete_chat_session(
    session_id: str,
):
    """
    Delete a chat session and all its messages.
    """
    success = await ChatService.delete_chat_session(session_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found"
        )
    return {"status": "success", "message": f"Session {session_id} deleted"}