import json
import os
from typing import List, Dict
from pathlib import Path
from app.constant.config import ADMIN_EMAIL

class EmailWhitelistValidator:
    def __init__(self):
        # Go up to backend directory, then to data folder
        self.data_path = Path(__file__).parent.parent.parent / "data" / "allowed_emails.json"
        self.allowed_emails_data = self._load_allowed_emails()
    
    def _load_allowed_emails(self) -> Dict:
        """Load allowed emails configuration from JSON file"""
        try:
            with open(self.data_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: Allowed emails file not found at {self.data_path}")
            return {"allowed_usernames": [], "allowed_domains": []}
        except json.JSONDecodeError as e:
            print(f"Error parsing allowed emails JSON: {e}")
            return {"allowed_usernames": [], "allowed_domains": []}
    
    def is_email_allowed(self, email: str) -> bool:
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
        if email.lower() == ADMIN_EMAIL.lower():
            return True
        
        # Split email into username and domain
        username, domain = email.split('@', 1)
        
        # Check if username is in allowed list
        allowed_usernames = self.allowed_emails_data.get("allowed_usernames", [])
        if username not in allowed_usernames:
            return False
        
        # Check if domain is in allowed list
        allowed_domains = self.allowed_emails_data.get("allowed_domains", [])
        if domain not in allowed_domains:
            return False
        
        return True
    
    def get_allowed_usernames(self) -> List[str]:
        """Get list of allowed usernames"""
        return self.allowed_emails_data.get("allowed_usernames", [])
    
    def get_allowed_domains(self) -> List[str]:
        """Get list of allowed domains"""
        return self.allowed_emails_data.get("allowed_domains", [])
    
    def get_validation_error_message(self, email: str) -> str:
        """
        Get a specific error message for why an email is not allowed
        
        Args:
            email: Email address that failed validation
            
        Returns:
            str: Descriptive error message
        """
        if not email or '@' not in email:
            return "Invalid email format"
        
        # Admin email should always be allowed (this shouldn't be called for admin)
        if email.lower() == ADMIN_EMAIL.lower():
            return "Admin email is always allowed"
        
        username, domain = email.split('@', 1)
        
        allowed_usernames = self.allowed_emails_data.get("allowed_usernames", [])
        allowed_domains = self.allowed_emails_data.get("allowed_domains", [])
        
        if username not in allowed_usernames:
            return f"Email username '{username}' is not authorized for registration"
        
        if domain not in allowed_domains:
            return f"Email domain '{domain}' is not allowed. Please use columbia.edu or barnard.edu"
        
        return "Email is not authorized for registration"

    def is_admin_email(self, email: str) -> bool:
        """Check if the email is the admin email"""
        return email.lower() == ADMIN_EMAIL.lower()

# Create a global instance
email_validator = EmailWhitelistValidator()
