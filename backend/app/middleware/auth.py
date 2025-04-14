# app/middleware/auth.py

import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from typing import Dict, Optional

# Load your JWT secret key from environment variables
from app.constant.config import JWT_SECRET

class CookieOrHeaderToken:
    def __init__(self, token_url: str = "login"):
        self.oauth2_scheme = OAuth2PasswordBearer(tokenUrl=token_url, auto_error=False)

    async def __call__(self, request: Request) -> Optional[str]:
        # First try to get token from cookie
        token = request.cookies.get("access_token")
        print("cookie", token)
        if not token:
            # If no cookie, try to get from Authorization header
            try:
                token = await self.oauth2_scheme(request)
            except:
                token = None
        print("header", token)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        print("final", token)
        return token

# Create token extractor instance
token_extractor = CookieOrHeaderToken()

async def get_current_user(token: str = Depends(token_extractor)) -> Dict:
    """
    Verify JWT token and return user info.
    Supports both cookie-based and header-based authentication.
    """
    try:
        #print("token middleware", token)
        # Decode and validate the token
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
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
