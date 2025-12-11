from app.middleware.log import APIGatewayMiddleware
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.constant.config import SECRET_KEY
from app.routers import conversation, rag, auth, project, resource_alloc, admin, images
from starlette.middleware.sessions import SessionMiddleware
from app.database.database import session_manager
from contextlib import asynccontextmanager
from app.middleware.auth import get_current_user
from app.services.project_service import project_service

@asynccontextmanager
async def lifespan(app: FastAPI):  
    # Initialize MongoDB collections
    await session_manager.create_collections([
        "rag_documents",    # For RAG document storage with vector embeddings
        "projects",
        "users",
        "allowed_emails",   # For email whitelist storage
        "images",           # For storing generated images
        "uploaded_files"    # For storing original uploaded files (PDFs, documents)
    ])
    
    # Initialize email validator with database
    from app.utils.email_validator import email_validator
    email_validator.set_db(session_manager.db)
    
    # Initialize image service with database
    from app.services.image_service import image_service
    image_service.set_db(session_manager.db)
    
    # Initialize file service with database
    from app.services.file_service import file_service
    file_service.set_db(session_manager.db)
    
    # Initialize RAG service
    from app.services.rag_service import rag_service
    await rag_service.initialize()
    
    # Initialize admin account
    from app.services.auth_service import AuthService
    from app.database.query.db_auth import DBAuth
    try:
        db_auth = DBAuth(session_manager.db)
        auth_service = AuthService(db_auth)
        await auth_service.ensure_admin_account_exists()
    except Exception as e:
        print(f"Warning: Failed to initialize admin account: {str(e)}")
    
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
app.add_middleware(APIGatewayMiddleware)
# Add a basic health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint to verify the API is running."""
    return {"status": "ok", "database": "mongodb"}

@app.delete("/api/data/all", dependencies=[Depends(get_current_user)])
async def delete_all_data():
    """Delete all documents from rag_documents and projects collections."""
    try:
        result = await project_service.delete_all_data(session_manager.db)
        return {
            "status": "success",
            "message": "All data deleted successfully",
            **result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete data: {str(e)}"
        )

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
# Add resource monitoring router
app.include_router(
    resource_alloc.router,
    dependencies=[Depends(get_current_user)]
)
# Add admin router
app.include_router(
    admin.router,
    prefix="/api",
    dependencies=[Depends(get_current_user)]
)

# Add images router (no auth required for serving images)
app.include_router(
    images.router,
    prefix="/api"
)

