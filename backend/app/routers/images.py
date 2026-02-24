from fastapi import APIRouter, Depends, Path, HTTPException
from fastapi.responses import Response
from google.cloud.firestore_v1.async_client import AsyncClient

from app.database.database import get_db
from app.services.image_service import image_service

router = APIRouter(
    prefix="/images",
    tags=["images"]
)

@router.get("/{image_id}")
async def get_image(
    image_id: str = Path(..., description="Image ID from database"),
    db: AsyncClient = Depends(get_db)
):
    """
    Retrieve an image stored in the database.
    
    This endpoint serves images that were generated and stored in Firestore.
    """
    # Ensure image service has database connection
    if image_service.db is None:
        image_service.set_db(db)
    
    image_data = await image_service.get_image_by_id(image_id)
    
    if not image_data:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return Response(
        content=image_data["image_data"],
        media_type=image_data["content_type"],
        headers={
            "Cache-Control": "public, max-age=31536000",  # Cache for 1 year
            "Content-Disposition": f"inline; filename=\"{image_data.get('idea_title', 'image')}.png\""
        }
    )
