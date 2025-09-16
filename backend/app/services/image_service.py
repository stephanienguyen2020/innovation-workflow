from openai import OpenAI
import requests
from typing import Optional
import logging
from app.constant.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

class ImageGenerationService:
    def __init__(self):
        """Initialize the image generation service with OpenAI client"""
        self.client = OpenAI(api_key=OPENAI_API_KEY)
    
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
    
    async def generate_product_image(self, idea_title: str, detailed_explanation: str, problem_domain: str) -> Optional[str]:
        """
        Generate an image for a product idea using DALL-E
        
        Args:
            idea_title: The product idea title
            detailed_explanation: The detailed explanation of the product
            problem_domain: The problem domain context
            
        Returns:
            URL of the generated image or None if generation fails
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
            logger.info(f"Successfully generated image: {image_url}")
            
            return image_url
            
        except Exception as e:
            logger.error(f"Failed to generate image for idea '{idea_title}': {str(e)}")
            return None
    
    async def regenerate_product_image(self, idea_title: str, detailed_explanation: str, problem_domain: str) -> Optional[str]:
        """
        Regenerate an image for a product idea (same as generate but with different logging)
        
        Args:
            idea_title: The product idea title
            detailed_explanation: The detailed explanation of the product
            problem_domain: The problem domain context
            
        Returns:
            URL of the regenerated image or None if generation fails
        """
        logger.info(f"Regenerating image for idea: {idea_title}")
        return await self.generate_product_image(idea_title, detailed_explanation, problem_domain)
    
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
