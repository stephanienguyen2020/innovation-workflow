from passlib.context import CryptContext
from app.constant.config import JWT_SECRET
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
import jwt
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Function to hash password
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Function to verify password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# JWT Secret Key and Algorithm
JWT_ALGORITHM = "HS256"

# JWT Token creation
def create_access_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)

# User Models
class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    created_at: datetime = datetime.now(timezone.utc)
    updated_at: datetime = datetime.now(timezone.utc)
    is_active: bool = True

class UserDB(UserBase):
    id: str
    hashed_password: str
    last_login: Optional[datetime] = None
    role: Optional[str] = 'user'

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True

class UserCreate(UserBase):
    password: str  # Add password to the create model
    role: Optional[str] = 'user'

class UserProfile(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool
    role: str

    class Config:
        orm_mode = True
