from typing import List, Dict, Optional
from google.cloud.firestore_v1 import ArrayUnion, ArrayRemove
from app.constant.config import ADMIN_EMAIL


class EmailWhitelistValidator:
    def __init__(self):
        """
        Initialize the email validator.
        Database must be set via set_db() before use.
        """
        self.db = None
        self._cache: Optional[Dict] = None
    
    def set_db(self, db):
        """Set the database instance. Must be called before using the validator."""
        self.db = db
        self._cache = None  # Clear cache to force reload from DB
    
    def _ensure_db(self):
        """Ensure database is connected"""
        if self.db is None:
            raise Exception("Database not initialized. Call set_db() first.")
    
    async def _load_from_db(self) -> Dict:
        """Load allowed emails configuration from Firestore"""
        self._ensure_db()
        try:
            doc_ref = self.db.collection("allowed_emails").document("email_whitelist")
            doc = await doc_ref.get()
            if not doc.exists:
                return {"allowed_usernames": [], "allowed_domains": []}
            data = doc.to_dict()
            return {
                "allowed_usernames": data.get("allowed_usernames", []),
                "allowed_domains": data.get("allowed_domains", [])
            }
        except Exception as e:
            print(f"Error loading allowed emails from DB: {e}")
            return {"allowed_usernames": [], "allowed_domains": []}
    
    async def _get_data(self) -> Dict:
        """Get the allowed emails data, from cache or DB"""
        if self._cache is not None:
            return self._cache
        
        self._cache = await self._load_from_db()
        return self._cache
    
    async def is_email_allowed(self, email: str) -> bool:
        """
        Check if an email is in the whitelist
        
        Args:
            email: Email address to validate
            
        Returns:
            bool: True if email is allowed, False otherwise
        """
        if not email or '@' not in email:
            return False
        
        # Allow admin email bypass
        if ADMIN_EMAIL and email.lower() == ADMIN_EMAIL.lower():
            return True
        
        # Split email into username and domain
        username, domain = email.split('@', 1)
        
        data = await self._get_data()
        
        # Check if username is in allowed list
        allowed_usernames = data.get("allowed_usernames", [])
        if username not in allowed_usernames:
            return False
        
        # Check if domain is in allowed list
        allowed_domains = data.get("allowed_domains", [])
        if domain not in allowed_domains:
            return False
        
        return True
    
    async def get_allowed_usernames(self) -> List[str]:
        """Get list of allowed usernames"""
        data = await self._get_data()
        return data.get("allowed_usernames", [])
    
    async def get_allowed_domains(self) -> List[str]:
        """Get list of allowed domains"""
        data = await self._get_data()
        return data.get("allowed_domains", [])
    
    async def get_all_data(self) -> Dict:
        """Get all allowed emails data (usernames and domains)"""
        return await self._get_data()
    
    async def get_validation_error_message(self, email: str) -> str:
        """
        Get a specific error message for why an email is not allowed
        
        Args:
            email: Email address that failed validation
            
        Returns:
            str: Descriptive error message
        """
        if not email or '@' not in email:
            return "Invalid email format"
        
        # Admin email should always be allowed
        if ADMIN_EMAIL and email.lower() == ADMIN_EMAIL.lower():
            return "Admin email is always allowed"
        
        username, domain = email.split('@', 1)
        
        data = await self._get_data()
        allowed_usernames = data.get("allowed_usernames", [])
        allowed_domains = data.get("allowed_domains", [])
        
        if username not in allowed_usernames:
            return f"Email username '{username}' is not authorized for registration"
        
        if domain not in allowed_domains:
            return f"Email domain '{domain}' is not allowed. Please use columbia.edu or barnard.edu"
        
        return "Email is not authorized for registration"

    def is_admin_email(self, email: str) -> bool:
        """Check if the email is the admin email"""
        if not ADMIN_EMAIL:
            return False
        return email.lower() == ADMIN_EMAIL.lower()
    
    async def add_username(self, username: str) -> bool:
        """Add a username to the allowed list"""
        self._ensure_db()
        
        try:
            doc_ref = self.db.collection("allowed_emails").document("email_whitelist")
            await doc_ref.set(
                {"allowed_usernames": ArrayUnion([username])},
                merge=True
            )
            self._cache = None  # Clear cache
            return True
        except Exception as e:
            print(f"Error adding username: {e}")
            return False
    
    async def remove_username(self, username: str) -> bool:
        """Remove a username from the allowed list"""
        self._ensure_db()
        
        try:
            doc_ref = self.db.collection("allowed_emails").document("email_whitelist")
            await doc_ref.set(
                {"allowed_usernames": ArrayRemove([username])},
                merge=True
            )
            self._cache = None  # Clear cache
            return True
        except Exception as e:
            print(f"Error removing username: {e}")
            return False
    
    async def add_domain(self, domain: str) -> bool:
        """Add a domain to the allowed list"""
        self._ensure_db()
        
        try:
            doc_ref = self.db.collection("allowed_emails").document("email_whitelist")
            await doc_ref.set(
                {"allowed_domains": ArrayUnion([domain])},
                merge=True
            )
            self._cache = None  # Clear cache
            return True
        except Exception as e:
            print(f"Error adding domain: {e}")
            return False
    
    async def remove_domain(self, domain: str) -> bool:
        """Remove a domain from the allowed list"""
        self._ensure_db()
        
        try:
            doc_ref = self.db.collection("allowed_emails").document("email_whitelist")
            await doc_ref.set(
                {"allowed_domains": ArrayRemove([domain])},
                merge=True
            )
            self._cache = None  # Clear cache
            return True
        except Exception as e:
            print(f"Error removing domain: {e}")
            return False


email_validator = EmailWhitelistValidator()
