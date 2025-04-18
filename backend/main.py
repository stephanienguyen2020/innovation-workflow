from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.constant.config import SECRET_KEY
from app.routers import conversation, rag, auth, project
from starlette.middleware.sessions import SessionMiddleware
from app.database.database import session_manager
from contextlib import asynccontextmanager
from app.middleware.auth import get_current_user

@asynccontextmanager
async def lifespan(app: FastAPI):  
    # Initialize MongoDB collections
    await session_manager.create_collections([
        "messages",        # For storing chat messages
        "conversations",   # For tracking conversation metadata
        "sessions",        # For user session information
        "rag_documents"    # For RAG document storage with vector embeddings
    ])
    
    # Initialize RAG service
    from app.services.rag_service import rag_service
    await rag_service.initialize()
    
    yield
    # Close MongoDB connection when app shuts down
    if session_manager.client is not None:
        await session_manager.close()
        
app = FastAPI(lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8000',
        'http://127.0.0.1:8000'
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Add session middleware for managing server-side sessions
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# Add a basic health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint to verify the API is running."""
    return {"status": "ok", "database": "mongodb"}

# Include routers with authentication where needed
app.include_router(auth.router)
app.include_router(
    project.router,
    prefix="/api",
    dependencies=[Depends(get_current_user)]
)
app.include_router(
    conversation.router,
    prefix="/api",
    dependencies=[Depends(get_current_user)]
)
app.include_router(
    rag.router,
    prefix="/api",
    dependencies=[Depends(get_current_user)]
)

    
