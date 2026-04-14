from fastapi import APIRouter, Depends, HTTPException, status
from google.cloud.firestore_v1.async_client import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter
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


class BulkEmailsRequest(BaseModel):
    emails: List[str]


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
    Accepts either a plain username (e.g., "abc1234") or a full email
    (e.g., "abc1234@columbia.edu"), in which case the domain is also added automatically.
    Admin only.
    """
    value = request.username.strip().lower()
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty"
        )

    domain_added = None
    if "@" in value:
        username, domain = value.split("@", 1)
        domain_to_add = domain
    else:
        username = value
        domain_to_add = None

    # Check for duplicate before adding
    current_usernames = await email_validator.get_allowed_usernames()
    if username in current_usernames:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{username}' is already in the whitelist"
        )

    if domain_to_add:
        await email_validator.add_domain(domain_to_add)
        domain_added = domain_to_add

    success = await email_validator.add_username(username)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add username"
        )

    msg = f"Username '{username}' added successfully"
    if domain_added:
        msg += f" (domain '{domain_added}' also added)"

    return {"message": msg, "username": username, "domain_added": domain_added}


@router.delete("/allowed-emails/usernames/{username}")
async def remove_username(
    username: str,
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Remove a username from the allowed list and delete the associated user
    account and all their data from the database.
    Admin only.
    """
    # Remove from whitelist
    success = await email_validator.remove_username(username)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove username"
        )

    # Find and delete the user account matching this username (email starts with username@)
    deleted_user = False
    deleted_projects = 0
    deleted_files = 0
    deleted_rag_docs = 0
    deleted_images = 0

    users_ref = db.collection("users")
    users_docs = await users_ref.get()

    for doc in users_docs:
        user_data = doc.to_dict()
        user_email = user_data.get("email", "")
        email_username = user_email.split("@")[0].lower() if "@" in user_email else ""

        if email_username == username.lower():
            user_id = doc.id

            # Delete user's projects
            projects_query = db.collection("projects").where(
                filter=FieldFilter("user_id", "==", user_id)
            )
            project_docs = await projects_query.get()
            for project_doc in project_docs:
                await project_doc.reference.delete()
                deleted_projects += 1

            # Delete user's uploaded files
            files_query = db.collection("uploaded_files").where(
                filter=FieldFilter("user_id", "==", user_id)
            )
            file_docs = await files_query.get()
            for file_doc in file_docs:
                await file_doc.reference.delete()
                deleted_files += 1

            # Delete user's RAG documents
            rag_query = db.collection("rag_documents").where(
                filter=FieldFilter("user_id", "==", user_id)
            )
            rag_docs = await rag_query.get()
            for rag_doc in rag_docs:
                await rag_doc.reference.delete()
                deleted_rag_docs += 1

            # Delete user's images
            images_query = db.collection("images").where(
                filter=FieldFilter("user_id", "==", user_id)
            )
            image_docs = await images_query.get()
            for image_doc in image_docs:
                await image_doc.reference.delete()
                deleted_images += 1

            # Delete the user document itself
            await doc.reference.delete()
            deleted_user = True
            break

    message = f"Username '{username}' removed from whitelist"
    if deleted_user:
        message += f". User account and data deleted ({deleted_projects} projects, {deleted_files} files, {deleted_rag_docs} RAG docs, {deleted_images} images)"

    return {
        "message": message,
        "username": username,
        "user_deleted": deleted_user,
        "deleted_projects": deleted_projects,
    }


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


@router.post("/allowed-emails/bulk")
async def bulk_add_emails(
    request: BulkEmailsRequest,
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """
    Bulk add emails/usernames to the whitelist from an uploaded list.
    Accepts full emails (extracts username + domain) or plain usernames.
    Admin only.
    """
    usernames: List[str] = []
    domains: List[str] = []

    for entry in request.emails:
        entry = entry.strip().lower()
        if not entry:
            continue
        if "@" in entry:
            username, domain = entry.split("@", 1)
            if username:
                usernames.append(username)
            if domain:
                domains.append(domain)
        else:
            usernames.append(entry)

    # Deduplicate while preserving order
    usernames = list(dict.fromkeys(usernames))
    domains = list(dict.fromkeys(domains))

    if not usernames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid emails or usernames found in the provided list"
        )

    result = await email_validator.add_usernames_bulk(usernames, domains)

    return {
        "message": f"Bulk upload complete: {len(result['added'])} added, {len(result['skipped'])} skipped",
        "added": result["added"],
        "skipped": result["skipped"],
        "domains_added": result["domains_added"],
        "total_processed": len(usernames),
    }


# ==================== User Management ====================

@router.get("/users")
async def get_all_users(
    admin: UserProfile = Depends(require_admin),
    db: AsyncClient = Depends(get_db)
):
    """Get all registered users with their project counts. Admin only."""
    # Fetch all users from the users collection
    users_ref = db.collection("users")
    users_docs = await users_ref.get()

    users = []
    for doc in users_docs:
        data = doc.to_dict()
        user_id = doc.id

        # Count projects for this user
        projects_query = db.collection("projects").where(
            filter=FieldFilter("user_id", "==", user_id)
        )
        projects_docs = await projects_query.get()

        total_projects = len(projects_docs)
        completed_projects = sum(
            1 for p in projects_docs
            if p.to_dict().get("status") == "completed"
        )

        users.append({
            "id": user_id,
            "name": data.get("name", ""),
            "email": data.get("email", ""),
            "role": data.get("role", "user"),
            "is_email_verified": data.get("is_email_verified", False),
            "created_at": data.get("created_at"),
            "last_login": data.get("last_login"),
            "total_projects": total_projects,
            "completed_projects": completed_projects,
        })

    return users
