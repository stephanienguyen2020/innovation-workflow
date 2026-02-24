from fastapi import APIRouter, Depends, HTTPException, status
from google.cloud.firestore_v1.async_client import AsyncClient
from typing import List
from pydantic import BaseModel

from app.database.database import get_db
from app.middleware.auth import get_current_user
from app.schema.user import UserProfile
from app.utils.email_validator import email_validator

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)


class UsernameRequest(BaseModel):
    username: str


class DomainRequest(BaseModel):
    domain: str


class AllowedEmailsResponse(BaseModel):
    allowed_usernames: List[str]
    allowed_domains: List[str]


def require_admin(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Dependency to require admin role"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


# ==================== Allowed Emails Management ====================

@router.get("/allowed-emails", response_model=AllowedEmailsResponse)
async def get_allowed_emails(
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Get all allowed usernames and domains.
    Admin only.
    """
    data = await email_validator.get_all_data()
    return AllowedEmailsResponse(
        allowed_usernames=data.get("allowed_usernames", []),
        allowed_domains=data.get("allowed_domains", [])
    )


@router.get("/allowed-emails/usernames", response_model=List[str])
async def get_allowed_usernames(
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Get list of allowed usernames.
    Admin only.
    """
    return await email_validator.get_allowed_usernames()


@router.post("/allowed-emails/usernames")
async def add_username(
    request: UsernameRequest,
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Add a username to the allowed list.
    Admin only.
    """
    username = request.username.strip().lower()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty"
        )
    
    success = await email_validator.add_username(username)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add username"
        )
    
    return {"message": f"Username '{username}' added successfully", "username": username}


@router.delete("/allowed-emails/usernames/{username}")
async def remove_username(
    username: str,
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Remove a username from the allowed list.
    Admin only.
    """
    success = await email_validator.remove_username(username)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove username"
        )
    
    return {"message": f"Username '{username}' removed successfully", "username": username}


@router.get("/allowed-emails/domains", response_model=List[str])
async def get_allowed_domains(
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Get list of allowed domains.
    Admin only.
    """
    return await email_validator.get_allowed_domains()


@router.post("/allowed-emails/domains")
async def add_domain(
    request: DomainRequest,
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Add a domain to the allowed list.
    Admin only.
    """
    domain = request.domain.strip().lower()
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain cannot be empty"
        )
    
    success = await email_validator.add_domain(domain)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add domain"
        )
    
    return {"message": f"Domain '{domain}' added successfully", "domain": domain}


@router.delete("/allowed-emails/domains/{domain}")
async def remove_domain(
    domain: str,
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Remove a domain from the allowed list.
    Admin only.
    """
    success = await email_validator.remove_domain(domain)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove domain"
        )
    
    return {"message": f"Domain '{domain}' removed successfully", "domain": domain}
