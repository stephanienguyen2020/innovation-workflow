from openai import OpenAI
import requests
from typing import Optional
import logging
import base64
from bson import ObjectId
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.constant.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

class ImageGenerationService:
    def __init__(self, db: AsyncIOMotorDatabase = None):
        """Initialize the image generation service with OpenAI client"""
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.db = db
    
    def set_db(self, db: AsyncIOMotorDatabase):
        """Set the database instance"""
        self.db = db
    
    def create_image_prompt(self, idea_title: str, detailed_explanation: str, problem_domain: str) -> str:
        """
        Create a professional, high-fidelity concept image prompt based on the product idea
        
        Args:
            idea_title: The product idea title
            detailed_explanation: The detailed explanation of the product
            problem_domain: The problem domain context
            
        Returns:
            Optimized prompt for DALL-E image generation using professional template
        """
        # Build the professional high-fidelity prompt (concise version)
        prompt = f"""Prototype for "{idea_title}". If it's a physical product, create a 3D render. If it's a digital product, create a UI/UX mockup of the landing page. If it's a hybrid product, create a hybrid interface.
Domain: {problem_domain}.
Composition: Strategic perspective showcasing key features. Clean, modern workspace background. Landscape (16:9).

Based on the product details below, create the most appropriate visual representation (digital app, physical device, or hybrid).

Product Details: {detailed_explanation}
"""

        return prompt
    
    async def generate_product_image(
        self, 
        idea_title: str, 
        detailed_explanation: str, 
        problem_domain: str,
        project_id: str = None,
        idea_id: str = None
    ) -> Optional[str]:
        """
        Generate an image for a product idea using DALL-E and save to database
        
        Args:
            idea_title: The product idea title
            detailed_explanation: The detailed explanation of the product
            problem_domain: The problem domain context
            project_id: Optional project ID for organizing images
            idea_id: Optional idea ID for reference
            
        Returns:
            Image ID in database (for retrieval via /api/images/{id}) or original URL if DB not available
        """
        try:
            # Create optimized prompt
            prompt = self.create_image_prompt(idea_title, detailed_explanation, problem_domain)
            
            logger.info(f"Generating image for idea: {idea_title}")
            logger.info(f"Using prompt: {prompt[:200]}...")
            
            # Generate image using DALL-E 3
            response = self.client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1792x1024",  # Landscape format good for presentations
                quality="standard",
                n=1,
            )
            
            # Extract the image URL
            image_url = response.data[0].url
            logger.info(f"Successfully generated image from DALL-E: {image_url}")
            
            # If database is available, download and store the image
            if self.db is not None:
                stored_id = await self._store_image_from_url(
                    image_url=image_url,
                    idea_title=idea_title,
                    project_id=project_id,
                    idea_id=idea_id
                )
                if stored_id:
                    # Return the internal image URL
                    return f"/api/images/{stored_id}"
            
            # Fallback to returning the original URL
            return image_url
            
        except Exception as e:
            logger.error(f"Failed to generate image for idea '{idea_title}': {str(e)}")
            return None
    
    async def _store_image_from_url(
        self, 
        image_url: str, 
        idea_title: str,
        project_id: str = None,
        idea_id: str = None
    ) -> Optional[str]:
        """
        Download image from URL and store in MongoDB
        
        Returns:
            The stored image ID or None if storage fails
        """
        try:
            # Download the image
            image_bytes = self.download_image(image_url)
            if not image_bytes:
                logger.error("Failed to download image for storage")
                return None
            
            # Store in MongoDB
            collection = self.db["images"]
            
            # Convert to base64 for storage (simpler than GridFS for moderate-sized images)
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            doc = {
                "image_data": image_base64,
                "content_type": "image/png",
                "idea_title": idea_title,
                "project_id": project_id,
                "idea_id": idea_id,
                "original_url": image_url,
                "created_at": datetime.utcnow(),
                "size_bytes": len(image_bytes)
            }
            
            result = await collection.insert_one(doc)
            image_id = str(result.inserted_id)
            
            logger.info(f"Stored image in database with ID: {image_id}")
            return image_id
            
        except Exception as e:
            logger.error(f"Failed to store image in database: {str(e)}")
            return None
    
    async def get_image_by_id(self, image_id: str) -> Optional[dict]:
        """
        Retrieve an image from the database by ID
        
        Args:
            image_id: The MongoDB ObjectId of the image
            
        Returns:
            Dictionary with image_data (bytes) and content_type, or None if not found
        """
        if self.db is None:
            return None
            
        try:
            collection = self.db["images"]
            doc = await collection.find_one({"_id": ObjectId(image_id)})
            
            if not doc:
                return None
            
            # Decode base64 back to bytes
            image_bytes = base64.b64decode(doc["image_data"])
            
            return {
                "image_data": image_bytes,
                "content_type": doc.get("content_type", "image/png"),
                "idea_title": doc.get("idea_title"),
                "created_at": doc.get("created_at")
            }
            
        except Exception as e:
            logger.error(f"Failed to retrieve image {image_id}: {str(e)}")
            return None
    
    async def delete_image(self, image_id: str) -> bool:
        """
        Delete an image from the database
        
        Args:
            image_id: The MongoDB ObjectId of the image
            
        Returns:
            True if deleted, False otherwise
        """
        if self.db is None:
            return False
            
        try:
            collection = self.db["images"]
            result = await collection.delete_one({"_id": ObjectId(image_id)})
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"Failed to delete image {image_id}: {str(e)}")
            return False
    
    async def regenerate_product_image(
        self, 
        idea_title: str, 
        detailed_explanation: str, 
        problem_domain: str,
        project_id: str = None,
        idea_id: str = None,
        old_image_id: str = None
    ) -> Optional[str]:
        """
        Regenerate an image for a product idea
        
        Args:
            idea_title: The product idea title
            detailed_explanation: The detailed explanation of the product
            problem_domain: The problem domain context
            project_id: Optional project ID
            idea_id: Optional idea ID
            old_image_id: Optional old image ID to delete after regeneration
            
        Returns:
            New image ID/URL or None if generation fails
        """
        logger.info(f"Regenerating image for idea: {idea_title}")
        
        # Generate new image
        new_image = await self.generate_product_image(
            idea_title=idea_title,
            detailed_explanation=detailed_explanation,
            problem_domain=problem_domain,
            project_id=project_id,
            idea_id=idea_id
        )
        
        # Delete old image if successful and old_image_id provided
        if new_image and old_image_id and old_image_id.startswith("/api/images/"):
            old_id = old_image_id.replace("/api/images/", "")
            await self.delete_image(old_id)
            logger.info(f"Deleted old image: {old_id}")
        
        return new_image
    
    def download_image(self, image_url: str) -> Optional[bytes]:
        """
        Download image content from URL for storage or report generation
        
        Args:
            image_url: URL of the image to download
            
        Returns:
            Image content as bytes or None if download fails
        """
        try:
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error(f"Failed to download image from {image_url}: {str(e)}")
            return None


# Singleton instance (will be initialized with DB in main.py)
image_service = ImageGenerationService()
