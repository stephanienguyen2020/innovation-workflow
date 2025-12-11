"""
File Service - Handles storing and retrieving original uploaded files (PDFs, documents)
"""
import base64
from typing import Optional, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FileService:
    """Service for managing uploaded files in MongoDB."""
    
    def __init__(self):
        self.db: Optional[AsyncIOMotorDatabase] = None
        self.collection_name = "uploaded_files"
    
    def set_db(self, db: AsyncIOMotorDatabase):
        """Set the database connection."""
        self.db = db
    
    async def store_file(
        self,
        file_data: bytes,
        filename: str,
        content_type: str,
        project_id: str,
        user_id: str
    ) -> str:
        """
        Store a file in the database.
        
        Args:
            file_data: The raw bytes of the file
            filename: Original filename
            content_type: MIME type of the file
            project_id: Associated project ID
            user_id: Owner user ID
            
        Returns:
            The ID of the stored file
        """
        if self.db is None:
            raise ValueError("Database connection not initialized")
        
        collection = self.db[self.collection_name]
        
        # Encode the file data as base64 for storage
        encoded_data = base64.b64encode(file_data).decode('utf-8')
        
        document = {
            "filename": filename,
            "content_type": content_type,
            "file_data": encoded_data,
            "project_id": project_id,
            "user_id": user_id,
            "uploaded_at": datetime.utcnow(),
            "file_size": len(file_data)
        }
        
        result = await collection.insert_one(document)
        file_id = str(result.inserted_id)
        
        logger.info(f"Stored file '{filename}' with ID: {file_id}")
        return file_id
    
    async def get_file(self, file_id: str) -> Optional[Dict]:
        """
        Retrieve a file from the database.
        
        Args:
            file_id: The ID of the file to retrieve
            
        Returns:
            Dictionary with file_data (bytes), filename, and content_type, or None if not found
        """
        if self.db is None:
            return None
        
        try:
            collection = self.db[self.collection_name]
            doc = await collection.find_one({"_id": ObjectId(file_id)})
            
            if not doc:
                return None
            
            # Decode the base64 data back to bytes
            file_bytes = base64.b64decode(doc["file_data"])
            
            return {
                "file_data": file_bytes,
                "filename": doc["filename"],
                "content_type": doc["content_type"],
                "file_size": doc.get("file_size", len(file_bytes)),
                "uploaded_at": doc.get("uploaded_at")
            }
        except Exception as e:
            logger.error(f"Error retrieving file {file_id}: {str(e)}")
            return None
    
    async def delete_file(self, file_id: str) -> bool:
        """
        Delete a file from the database.
        
        Args:
            file_id: The ID of the file to delete
            
        Returns:
            True if deleted, False otherwise
        """
        if self.db is None:
            return False
        
        try:
            collection = self.db[self.collection_name]
            result = await collection.delete_one({"_id": ObjectId(file_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {str(e)}")
            return False
    
    async def get_file_by_project(self, project_id: str) -> Optional[Dict]:
        """
        Retrieve a file associated with a project.
        
        Args:
            project_id: The project ID
            
        Returns:
            Dictionary with file info, or None if not found
        """
        if self.db is None:
            return None
        
        try:
            collection = self.db[self.collection_name]
            doc = await collection.find_one({"project_id": project_id})
            
            if not doc:
                return None
            
            # Decode the base64 data back to bytes
            file_bytes = base64.b64decode(doc["file_data"])
            
            return {
                "file_id": str(doc["_id"]),
                "file_data": file_bytes,
                "filename": doc["filename"],
                "content_type": doc["content_type"],
                "file_size": doc.get("file_size", len(file_bytes)),
                "uploaded_at": doc.get("uploaded_at")
            }
        except Exception as e:
            logger.error(f"Error retrieving file for project {project_id}: {str(e)}")
            return None


# Singleton instance
file_service = FileService()
