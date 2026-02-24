from datetime import datetime
from typing import Dict, List, Optional
from google.cloud.firestore_v1.async_client import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter

# Message types
USER_MESSAGE = "user"
ASSISTANT_MESSAGE = "assistant"
SYSTEM_MESSAGE = "system"

async def add_message(
    db: AsyncClient,
    session_id: str,
    message: str,
    role: str = USER_MESSAGE,
    metadata: Optional[Dict] = None,
) -> str:
    """
    Add a new message to the chat history.
    
    Args:
        session: Firestore session
        session_id: Unique identifier for the user's session
        message: Content of the message
        role: Role of the message sender (user, assistant, system)
        metadata: Additional metadata for the message
    
    Returns:
        ID of the inserted message
    """
    collection = db.collection("messages")
    
    # Create message document
    message_doc = {
        "session_id": session_id,
        "content": message,
        "role": role,
        "timestamp": datetime.utcnow(),
        "metadata": metadata or {}
    }
    doc_ref = collection.document()
    await doc_ref.set(message_doc)
    
    # Update the conversation to include this message
    await update_conversation(db, session_id, doc_ref.id)
    return doc_ref.id

async def get_messages(
    db: AsyncClient,
    session_id: str,
    limit: int = 50,
    skip: int = 0,
    role: Optional[str] = None,
) -> List[Dict]:
    """
    Get messages from a chat session.
    
    Args:
        session: Firestore session
        session_id: Unique identifier for the user's session
        limit: Maximum number of messages to return
        skip: Number of messages to skip
        role: Filter by message role (user, assistant, system)
    
    Returns:
        List of message documents
    """
    collection = db.collection("messages")
    
    query = collection.where(filter=FieldFilter("session_id", "==", session_id)).order_by("timestamp").limit(limit)
    docs = await query.get()
    messages = []
    for doc in docs[skip:]:
        data = doc.to_dict()
        if role and data.get("role") != role:
            continue
        data["id"] = doc.id
        messages.append(data)
    return messages

async def get_conversation_history(
    db: AsyncClient,
    session_id: str,
) -> List[Dict]:
    """
    Get the complete conversation history formatted for AI context.
    
    Args:
        session: Firestore session
        session_id: Unique identifier for the user's session
    
    Returns:
        List of message documents formatted for AI context
    """
    messages = await get_messages(db, session_id, limit=100)
    
    # Format messages for AI context
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })
    
    return formatted_messages

async def update_conversation(
    db: AsyncClient,
    session_id: str,
    message_id: str,
) -> None:
    """
    Update the conversation to include a new message.
    
    Args:
        session: Firestore session
        session_id: Unique identifier for the user's session
        message_id: ID of the message to add
    """
    collection = db.collection("conversations")
    doc_ref = collection.document(session_id)
    doc = await doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        message_ids = data.get("message_ids", [])
        message_ids.append(message_id)
        await doc_ref.update({
            "message_ids": message_ids,
            "updated_at": datetime.utcnow()
        })
    else:
        await doc_ref.set({
            "session_id": session_id,
            "message_ids": [message_id],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

async def delete_conversation(
    db: AsyncClient,
    session_id: str,
) -> bool:
    """
    Delete an entire conversation and its messages.
    
    Args:
        session: Firestore session
        session_id: Unique identifier for the user's session
    
    Returns:
        True if deleted successfully
    """
    messages_collection = db.collection("messages")
    message_docs = await messages_collection.where(filter=FieldFilter("session_id", "==", session_id)).get()
    for doc in message_docs:
        await messages_collection.document(doc.id).delete()

    conversations_collection = db.collection("conversations")
    doc_ref = conversations_collection.document(session_id)
    doc = await doc_ref.get()
    if not doc.exists:
        return False
    await doc_ref.delete()
    return True

async def search_messages(
    db: AsyncClient,
    session_id: str,
    query: str,
) -> List[Dict]:
    """
    Search for messages containing specific text.
    
    Args:
        session: Firestore session
        session_id: Unique identifier for the user's session
        query: Text to search for in messages
    
    Returns:
        List of matching message documents
    """
    collection = db.collection("messages")
    docs = await collection.where(filter=FieldFilter("session_id", "==", session_id)).order_by("timestamp").limit(100).get()
    results = []
    for doc in docs:
        data = doc.to_dict()
        if query.lower() in data.get("content", "").lower():
            data["id"] = doc.id
            results.append(data)
    return results
