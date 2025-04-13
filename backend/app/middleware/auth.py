# app/middleware/auth.py

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Dict

# Load your JWT secret key from environment variables
from app.constant.config import JWT_SECRET_KEY

# OAuth2PasswordBearer is used to extract the JWT token from the Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") 

# Function to verify JWT token and return the decoded information
def verify_jwt_token(token: str = Depends(oauth2_scheme)) -> Dict:
    try:
        # Decode and validate the token
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        return payload  # The payload will contain the user info or the subject ('sub')
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )
