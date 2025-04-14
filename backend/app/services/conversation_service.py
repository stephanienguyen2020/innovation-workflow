from typing import Dict, List, Optional, Any
from uuid import uuid4

from llama_index.core.query_engine.sub_question_query_engine import SubQuestionQueryEngine
from llama_index.core.tools import QueryEngineTool, ToolMetadata

from app.database.database import run_with_session, get_collection
from app.database.query.db_message import (
    add_message,
    get_messages,
    get_conversation_history,
    delete_conversation,
    search_messages,
    USER_MESSAGE,
    ASSISTANT_MESSAGE,
    SYSTEM_MESSAGE
)
from app.schema.conversation import (
    MessageConversation,
    ChatMessageHistory,
    AgentResponse
)
from app.services.rag_service import rag_service

class ChatService:
    def __init__(self):
        self._sub_question_engine = None

    async def _create_sub_question_engine(self):
        """Create a sub-question query engine for complex queries."""
        if self._sub_question_engine is not None:
            return self._sub_question_engine

        # Create base query engine using RAG service
        base_engine = rag_service.index.as_query_engine(similarity_top_k=3)

        # Create query engine tool
        query_engine_tool = QueryEngineTool(
            query_engine=base_engine,
            metadata=ToolMetadata(
                name="document_store",
                description="Provides information from the document store",
            ),
        )

        # Create sub-question query engine
        self._sub_question_engine = SubQuestionQueryEngine.from_defaults(
            query_engine_tools=[query_engine_tool]
        )

        return self._sub_question_engine

    async def process_query(self, session_id: str, query_text: str, use_sub_questions: bool = False) -> str:
        """
        Process a user query using RAG and optionally decompose it into sub-questions.
        
        Args:
            session_id: The session identifier
            query_text: The user's query text
            use_sub_questions: Whether to use sub-question decomposition
            
        Returns:
            The response text
        """
        if use_sub_questions:
            # Use sub-question query engine for complex queries
            sub_question_engine = await self._create_sub_question_engine()
            response = await sub_question_engine.aquery(query_text)
        else:
            # Use regular RAG query
            response = await rag_service.query(query_text)
            response = response["response"]

        # Store the response
        await self.add_assistant_message(session_id, str(response))
        return str(response)

    @staticmethod
    async def create_session() -> str:
        """
        Create a new chat session.
        
        Returns:
            A unique session ID
        """
        session_id = str(uuid4())
        
        # Initialize session with system message
        await run_with_session(
            add_message,
            session_id,
            "I am an AI assistant. How can I help you today?",
            SYSTEM_MESSAGE
        )
        
        return session_id
    
    @staticmethod
    async def add_user_message(session_id: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Add a user message to the conversation.
        
        Args:
            session_id: The session identifier
            message: The user's message text
            metadata: Optional additional data
            
        Returns:
            The message ID
        """
        return await run_with_session(add_message, session_id, message, USER_MESSAGE, metadata)
    
    @staticmethod
    async def add_assistant_message(
        session_id: str, 
        message: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add an assistant response to the conversation.
        
        Args:
            session_id: The session identifier
            message: The assistant's message text
            metadata: Optional additional data
            
        Returns:
            The message ID
        """
        return await run_with_session(add_message, session_id, message, ASSISTANT_MESSAGE, metadata)
    
    @staticmethod
    async def process_agent_response(
        session_id: str, 
        agent_response: AgentResponse
    ) -> List[str]:
        """
        Process and store a complex agent response with multiple messages.
        
        Args:
            session_id: The session identifier
            agent_response: The agent's response object
            
        Returns:
            List of message IDs
        """
        message_ids = []
        
        for message_info in agent_response.messages:
            metadata = {}
            
            message_id = await run_with_session(
                add_message,
                session_id,
                message_info,
                ASSISTANT_MESSAGE,
                metadata
            )
            
            message_ids.append(message_id)
        
        return message_ids
    
    @staticmethod
    async def get_chat_history(session_id: str, limit: int = 50) -> ChatMessageHistory:
        """
        Get the chat history for a session.
        
        Args:
            session_id: The session identifier
            limit: Maximum number of messages to retrieve
            
        Returns:
            ChatMessageHistory object with the messages
        """
        messages_data = await run_with_session(get_messages, session_id, limit)
        
        messages = []
        for msg in messages_data:
            messages.append(
                MessageConversation(
                    role=msg["role"],
                    content=msg["content"],
                    time=msg["timestamp"],
                    metadata=msg["metadata"]
                )
            )
        
        return ChatMessageHistory(
            messages=messages,
            session_id=session_id
        )
    
    @staticmethod
    async def get_ai_context(session_id: str) -> List[Dict[str, str]]:
        """
        Get conversation history formatted for AI context.
        
        Args:
            session_id: The session identifier
            
        Returns:
            List of role/content pairs for AI context
        """
        return await run_with_session(get_conversation_history, session_id)
    
    @staticmethod
    async def delete_chat_session(session_id: str) -> bool:
        """
        Delete a chat session and all its messages.
        
        Args:
            session_id: The session identifier
            
        Returns:
            True if deleted successfully
        """
        return await run_with_session(delete_conversation, session_id)
    
    @staticmethod
    async def search_chat_history(session_id: str, query: str) -> List[MessageConversation]:
        """
        Search for messages in a chat session.
        
        Args:
            session_id: The session identifier
            query: Text to search for
            
        Returns:
            List of matching messages
        """
        messages_data = await run_with_session(search_messages, session_id, query)
        
        messages = []
        for msg in messages_data:
            messages.append(
                MessageConversation(
                    role=msg["role"],
                    content=msg["content"],
                    time=msg["timestamp"],
                    metadata=msg["metadata"]
                )
            )
        
        return messages
    
    @staticmethod
    async def get_active_sessions(limit: int = 100, skip: int = 0) -> List[Dict]:
        """
        Get list of active chat sessions.
        
        Args:
            limit: Maximum number of sessions to retrieve
            skip: Number of sessions to skip
            
        Returns:
            List of session data
        """
        collection = get_collection("conversations")
        
        cursor = collection.find().sort("updated_at", -1).skip(skip).limit(limit)
        sessions = await cursor.to_list(length=limit)
        
        # Convert MongoDB ObjectId to string
        for session in sessions:
            session["_id"] = str(session["_id"])
        
        return sessions
