from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.schema.user import UserCreate
from app.database.database import get_db
from app.database.query.db_auth import DBAuth
from app.services.auth_service import AuthService
from app.middleware.auth import create_access_token
from datetime import timedelta

router = APIRouter()

@router.post("/signup")
async def signup(user: UserCreate, db=Depends(get_db)):
    db_auth = DBAuth(db)
    auth_service = AuthService(db_auth)
    return await auth_service.signup(user)

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    db_auth = DBAuth(db)
    auth_service = AuthService(db_auth)
    return await auth_service.login(form_data)

@router.post("/logout")
async def logout(db=Depends(get_db)):
    db_auth = DBAuth(db)
    auth_service = AuthService(db_auth)
    return await auth_service.logout()

@router.get("/dev-token")
async def get_dev_token():
    """
    Development-only endpoint to generate a valid JWT token.
    This should be disabled in production.
    """
    # Create a test user data
    user_data = {"sub": "test-user", "id": "dev-user-123", "email": "dev@example.com"}
    # Generate token with 30 day expiration
    access_token = create_access_token(
        data=user_data, 
        expires_delta=timedelta(days=30)
    )
    return {"access_token": access_token, "token_type": "bearer"}
