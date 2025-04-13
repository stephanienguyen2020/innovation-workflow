from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.schema.user import UserCreate
from app.database.database import get_db
from app.database.query.db_auth import DBAuth
from app.services.auth_service import AuthService

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
