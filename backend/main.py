import passlib.context
import bcrypt

# Monkey patch bcrypt.checkpw to fix compatibility with passlib
# passlib calls bcrypt.__about__ which was removed in bcrypt 4.0.0
if not hasattr(bcrypt, '__about__'):
    bcrypt.__about__ = type('about', (object,), {'__version__': bcrypt.__version__})

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
    # Initialize email validator with database
    from app.utils.email_validator import email_validator
    email_validator.set_db(session_manager.client)
    
    # Initialize image service with database
    from app.services.image_service import image_service
    image_service.set_db(session_manager.client)
    
    # Initialize file service with database
    from app.services.file_service import file_service
    file_service.set_db(session_manager.client)
    
    # Initialize admin account
    from app.services.auth_service import AuthService
    from app.database.query.db_auth import DBAuth
    try:
        db_auth = DBAuth(session_manager.client)
        auth_service = AuthService(db_auth)
        await auth_service.ensure_admin_account_exists()
    except Exception as e:
        print(f"Warning: Failed to initialize admin account: {str(e)}")
    
    yield
    # Close Firestore connection when app shuts down
    if session_manager.client is not None:
        await session_manager.close()
        
app = FastAPI(lifespan=lifespan)

# Configure CORS - supports both development and production origins
import os
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000'
]
# Add production origins from environment variable
if allowed_origins_env:
    allowed_origins.extend([origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Add session middleware for managing server-side sessions
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)
app.add_middleware(APIGatewayMiddleware)
# Add a basic health check endpoint
@app.get("/")
async def root():
    """Root endpoint to verify the API is running."""
    return {"message": "Innovation Workflow Backend is running", "docs_url": "/docs"}

@app.get("/health")
async def health_check():
    """Health check endpoint to verify the API is running."""
    return {"status": "ok", "database": "firestore"}

@app.delete("/api/data/all", dependencies=[Depends(get_current_user)])
async def delete_all_data():
    """Delete all documents from rag_documents and projects collections."""
    try:
        result = await project_service.delete_all_data(session_manager.client)
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

