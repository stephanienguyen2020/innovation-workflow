#!/usr/bin/env python3
"""
Minimal auth server for testing email verification
Only includes authentication functionality
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.constant.config import SECRET_KEY
from app.routers import auth
from starlette.middleware.sessions import SessionMiddleware
from app.database.database import session_manager
from contextlib import asynccontextmanager
from app.services.auth_service import AuthService
from app.database.query.db_auth import DBAuth

@asynccontextmanager
async def lifespan(app: FastAPI):  
    # Initialize admin account
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
        
app = FastAPI(title="Auth Server", lifespan=lifespan)

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
    return {"status": "ok", "database": "firestore", "service": "auth-only"}

# Include auth router
app.include_router(auth.router)

if __name__ == "__main__":
    import uvicorn
    print("📧 Verification codes will appear in this console")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
