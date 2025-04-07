from datetime import datetime
from typing import Dict, List, Optional, Union
from motor.motor_asyncio import AsyncIOMotorClientSession
from bson import ObjectId

# Message types
USER_MESSAGE = "user"
ASSISTANT_MESSAGE = "assistant"
SYSTEM_MESSAGE = "system"

async def add_message(
    session: AsyncIOMotorClientSession,
    session_id: str,
    message: str,
    role: str = USER_MESSAGE,
    metadata: Optional[Dict] = None,
) -> str:
    """
    Add a new message to the chat history.
    
    Args:
        session: MongoDB session
        session_id: Unique identifier for the user's session
        message: Content of the message
        role: Role of the message sender (user, assistant, system)
        metadata: Additional metadata for the message
    
    Returns:
        ID of the inserted message
    """
    collection = session.client.db.messages
    
    # Create message document
    message_doc = {
        "session_id": session_id,
        "content": message,
        "role": role,
        "timestamp": datetime.utcnow(),
        "metadata": metadata or {}
    }
    print(message_doc)
    # Insert the message
    result = await collection.insert_one(message_doc, session=session)
    
    # Update the conversation to include this message
    await update_conversation(session, session_id, str(result.inserted_id))
    
    return str(result.inserted_id)

async def get_messages(
    session: AsyncIOMotorClientSession,
    session_id: str,
    limit: int = 50,
    skip: int = 0,
    role: Optional[str] = None,
) -> List[Dict]:
    """
    Get messages from a chat session.
    
    Args:
        session: MongoDB session
        session_id: Unique identifier for the user's session
        limit: Maximum number of messages to return
        skip: Number of messages to skip
        role: Filter by message role (user, assistant, system)
    
    Returns:
        List of message documents
    """
    collection = session.client.db.messages
    
    # Build query filter
    query = {"session_id": session_id}
    if role:
        query["role"] = role
    
    # Get messages sorted by timestamp
    cursor = collection.find(
        query, 
        session=session
    ).sort("timestamp", 1).skip(skip).limit(limit)
    
    # Convert to list
    messages = await cursor.to_list(length=limit)
    
    # Convert ObjectId to string
    for message in messages:
        message["_id"] = str(message["_id"])
    
    return messages

async def get_conversation_history(
    session: AsyncIOMotorClientSession,
    session_id: str,
) -> List[Dict]:
    """
    Get the complete conversation history formatted for AI context.
    
    Args:
        session: MongoDB session
        session_id: Unique identifier for the user's session
    
    Returns:
        List of message documents formatted for AI context
    """
    messages = await get_messages(session, session_id, limit=100)
    
    # Format messages for AI context
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })
    
    return formatted_messages

async def update_conversation(
    session: AsyncIOMotorClientSession,
    session_id: str,
    message_id: str,
) -> None:
    """
    Update the conversation to include a new message.
    
    Args:
        session: MongoDB session
        session_id: Unique identifier for the user's session
        message_id: ID of the message to add
    """
    collection = session.client.db.conversations
    
    # Check if conversation exists
    conversation = await collection.find_one({"session_id": session_id}, session=session)
    
    if conversation:
        # Update existing conversation
        await collection.update_one(
            {"session_id": session_id},
            {"$push": {"message_ids": message_id}, "$set": {"updated_at": datetime.utcnow()}},
            session=session
        )
    else:
        # Create new conversation
        await collection.insert_one(
            {
                "session_id": session_id,
                "message_ids": [message_id],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            session=session
        )

async def delete_conversation(
    session: AsyncIOMotorClientSession,
    session_id: str,
) -> bool:
    """
    Delete an entire conversation and its messages.
    
    Args:
        session: MongoDB session
        session_id: Unique identifier for the user's session
    
    Returns:
        True if deleted successfully
    """
    # Delete all messages in the session
    messages_collection = session.client.db.messages
    await messages_collection.delete_many({"session_id": session_id}, session=session)
    
    # Delete the conversation record
    conversations_collection = session.client.db.conversations
    result = await conversations_collection.delete_one({"session_id": session_id}, session=session)
    
    return result.deleted_count > 0

async def search_messages(
    session: AsyncIOMotorClientSession,
    session_id: str,
    query: str,
) -> List[Dict]:
    """
    Search for messages containing specific text.
    
    Args:
        session: MongoDB session
        session_id: Unique identifier for the user's session
        query: Text to search for in messages
    
    Returns:
        List of matching message documents
    """
    collection = session.client.db.messages
    
    # Create text search query
    result = await collection.find(
        {
            "session_id": session_id,
            "content": {"$regex": query, "$options": "i"}  # Case-insensitive search
        },
        session=session
    ).sort("timestamp", 1).to_list(length=100)
    
    # Convert ObjectId to string
    for message in result:
        message["_id"] = str(message["_id"])
    
    return result
