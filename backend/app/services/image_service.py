import requests
from typing import Optional
import logging
import base64
from datetime import datetime
from io import BytesIO
from PIL import Image as PILImage
from google import genai
from google.cloud.firestore_v1.async_client import AsyncClient
from app.constant.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

class ImageGenerationService:
    def __init__(self, db: AsyncClient = None):
        """Initialize the image generation service with Gemini client"""
        self.db = db
        self._genai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
    
    def set_db(self, db: AsyncClient):
        """Set the database instance"""
        self.db = db
    
    def create_image_prompt(self, idea_title: str, detailed_explanation: str, problem_domain: str, feedback: str = None) -> str:
        """
        Create a professional concept image prompt for the product idea.

        Follows the professor's recommended two-step approach:
        4(a) Generate a prompt starting with 'create an image of' to render the product in an image generator.
        4(b) The returned prompt is then used directly as input to the image generator (Gemini).

        Args:
            idea_title: The product idea title
            detailed_explanation: The detailed explanation of the product
            problem_domain: The problem domain context
            feedback: Optional user feedback on what to change in the visualization

        Returns:
            Image generation prompt starting with 'create an image of'
        """
        # Step 4(a): Generate a prompt for the image generator starting with 'create an image of'
        prompt = f"""create an image of a product concept called "{idea_title}" designed for the {problem_domain} domain. """

        # Adapt visual style based on product type inferred from the description
        description_lower = detailed_explanation.lower()
        if any(word in description_lower for word in ["app", "platform", "software", "dashboard", "interface", "website", "digital", "mobile", "web"]):
            prompt += "Render this as a clean, professional UI/UX mockup or app interface screenshot showing the key screens and features. "
        elif any(word in description_lower for word in ["device", "hardware", "wearable", "physical", "robot", "sensor", "gadget"]):
            prompt += "Render this as a photorealistic 3D product render with professional studio lighting and a clean background. "
        else:
            prompt += "If it is a digital product, create a UI/UX mockup of the key interface; if it is a physical product, create a 3D render; if it is a hybrid, create a combined visualization showing both the interface and physical elements. "

        prompt += f"""The image should be landscape orientation (16:9), with a clean and modern background, strategically showcasing the product's key features and value proposition.

Product details: {detailed_explanation}

Style: Professional product visualization. High quality, modern design aesthetic appropriate for a {problem_domain} product presentation."""

        # Add user feedback if provided (for regeneration/iteration)
        if feedback:
            prompt += f"\n\nUser requested changes to the visualization: {feedback}"

        # Step 4(b): This prompt is returned and used directly as input to Gemini (the image generator)
        return prompt
    
    async def generate_product_image(
        self,
        idea_title: str,
        detailed_explanation: str,
        problem_domain: str,
        project_id: str = None,
        idea_id: str = None,
        feedback: str = None,
    ) -> Optional[str]:
        """
        Generate an image for a product idea using Gemini and save to database

        Args:
            idea_title: The product idea title
            detailed_explanation: The detailed explanation of the product
            problem_domain: The problem domain context
            project_id: Optional project ID for organizing images
            idea_id: Optional idea ID for reference
            feedback: Optional user feedback on what to change in the visualization

        Returns:
            Image ID in database (for retrieval via /api/images/{id}) or None if generation fails
        """
        try:
            prompt = self.create_image_prompt(idea_title, detailed_explanation, problem_domain, feedback)

            logger.info(f"Generating image for idea: {idea_title}")
            logger.info(f"Using prompt: {prompt[:200]}...")

            if not self._genai_client:
                logger.error("GEMINI_API_KEY is not set")
                return None

            try:
                response = self._genai_client.models.generate_content(
                    model="gemini-2.5-flash-image",
                    contents=[prompt],
                )

                # Extract image from response parts
                image_bytes = None
                content_type = "image/png"
                for part in response.parts:
                    if part.inline_data is not None:
                        image_bytes = part.inline_data.data
                        content_type = part.inline_data.mime_type or "image/png"
                        break

                if image_bytes is None:
                    logger.error("No image data returned from Gemini")
                    return None

                # Compress image to stay under Firestore's 1MB field limit
                img = PILImage.open(BytesIO(image_bytes))
                img.thumbnail((1024, 1024), PILImage.LANCZOS)
                buf = BytesIO()
                img.save(buf, format="JPEG", quality=82)
                image_bytes = buf.getvalue()
                content_type = "image/jpeg"
                logger.info(f"Compressed image to {len(image_bytes)} bytes")

                if self.db is not None:
                    collection = self.db.collection("images")
                    image_base64 = base64.b64encode(image_bytes).decode('utf-8')

                    doc = {
                        "image_data": image_base64,
                        "content_type": content_type,
                        "idea_title": idea_title,
                        "project_id": project_id,
                        "idea_id": idea_id,
                        "original_url": "generated_by_gemini",
                        "created_at": datetime.utcnow(),
                        "size_bytes": len(image_bytes),
                        "model": "gemini-2.5-flash-image"
                    }

                    doc_ref = collection.document()
                    await doc_ref.set(doc)
                    image_id = doc_ref.id
                    logger.info(f"Stored Gemini image in database with ID: {image_id}")
                    return f"/api/images/{image_id}"
                else:
                    logger.warning("Database not available to store image bytes")
                    return None

            except Exception as e:
                logger.error(f"Gemini image generation failed: {e}")
                return None

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
        Download image from URL and store in Firestore
        
        Returns:
            The stored image ID or None if storage fails
        """
        try:
            # Download the image
            image_bytes = self.download_image(image_url)
            if not image_bytes:
                logger.error("Failed to download image for storage")
                return None
            
            collection = self.db.collection("images")
            
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
            
            doc_ref = collection.document()
            await doc_ref.set(doc)
            image_id = doc_ref.id
            
            logger.info(f"Stored image in database with ID: {image_id}")
            return image_id
            
        except Exception as e:
            logger.error(f"Failed to store image in database: {str(e)}")
            return None
    
    async def get_image_by_id(self, image_id: str) -> Optional[dict]:
        """
        Retrieve an image from the database by ID
        
        Args:
            image_id: The Firestore document ID of the image
            
        Returns:
            Dictionary with image_data (bytes) and content_type, or None if not found
        """
        if self.db is None:
            return None
            
        try:
            collection = self.db.collection("images")
            doc_ref = collection.document(image_id)
            doc = await doc_ref.get()
            if not doc.exists:
                return None
            data = doc.to_dict()
            # Decode base64 back to bytes
            image_bytes = base64.b64decode(data["image_data"])
            
            return {
                "image_data": image_bytes,
                "content_type": data.get("content_type", "image/png"),
                "idea_title": data.get("idea_title"),
                "created_at": data.get("created_at")
            }
            
        except Exception as e:
            logger.error(f"Failed to retrieve image {image_id}: {str(e)}")
            return None
    
    async def delete_image(self, image_id: str) -> bool:
        """
        Delete an image from the database
        
        Args:
            image_id: The Firestore document ID of the image
            
        Returns:
            True if deleted, False otherwise
        """
        if self.db is None:
            return False
            
        try:
            collection = self.db.collection("images")
            doc_ref = collection.document(image_id)
            doc = await doc_ref.get()
            if not doc.exists:
                return False
            await doc_ref.delete()
            return True
            
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
        old_image_id: str = None,
        feedback: str = None,
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
            feedback: Optional user feedback on what to change in the visualization

        Returns:
            New image ID/URL or None if generation fails
        """
        logger.info(f"Regenerating image for idea: {idea_title}" + (f" with feedback: {feedback}" if feedback else ""))

        new_image = await self.generate_product_image(
            idea_title=idea_title,
            detailed_explanation=detailed_explanation,
            problem_domain=problem_domain,
            project_id=project_id,
            idea_id=idea_id,
            feedback=feedback,
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
