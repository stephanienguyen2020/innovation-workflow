from datetime import datetime, timezone
from typing import Optional, Dict
from fastapi import HTTPException, status
from google.cloud.firestore_v1.async_client import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter

class DBAuth:
    def __init__(self, db: AsyncClient):
        self.db = db
        self.collection = db.collection("users")

    async def _execute(self, operation, *args, **kwargs):
        try:
            return await operation(*args, **kwargs)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database operation failed: {str(e)}"
            )

    def _doc_to_dict(self, doc) -> Optional[Dict]:
        data = doc.to_dict()
        if not data:
            return None
        data["id"] = doc.id
        return data

    async def find_user_by_email(self, email: str) -> Optional[Dict]:
        """Find a user by email"""
        async def _find():
            docs = await self.collection.where(filter=FieldFilter("email", "==", email)).limit(1).get()
            if not docs:
                return None
            return self._doc_to_dict(docs[0])

        return await self._execute(_find)

    async def create_user(self, user_data: Dict) -> Dict:
        """Create a new user"""
        async def _create():
            user_data["created_at"] = datetime.now(timezone.utc)
            user_data["updated_at"] = datetime.now(timezone.utc)
            doc_ref = self.collection.document()
            await doc_ref.set(user_data)
            user_data["id"] = doc_ref.id
            return user_data

        return await self._execute(_create)

    async def update_last_login(self, user_id: str) -> None:
        """Update the last login time for a user"""
        async def _update():
            doc_ref = self.collection.document(user_id)
            await doc_ref.update({"last_login": datetime.now(timezone.utc)})

        await self._execute(_update)

    async def check_email_exists(self, email: str) -> bool:
        """Check if an email already exists in the database"""
        existing_user = await self.find_user_by_email(email)
        return existing_user is not None

    async def update_email_verification_code(self, email: str, verification_code: str, expires_at: datetime) -> bool:
        """Update or set email verification code for a user"""
        async def _update():
            docs = await self.collection.where(filter=FieldFilter("email", "==", email)).limit(1).get()
            if not docs:
                return False
            doc_ref = self.collection.document(docs[0].id)
            await doc_ref.update({
                "email_verification_code": verification_code,
                "email_verification_expires": expires_at,
                "updated_at": datetime.now(timezone.utc)
            })
            return True

        return await self._execute(_update)

    async def verify_email_code(self, email: str, verification_code: str) -> bool:
        """Verify email verification code and mark email as verified"""
        async def _verify():
            docs = await self.collection.where(filter=FieldFilter("email", "==", email)).where(
                filter=FieldFilter("email_verification_code", "==", verification_code)
            ).where(
                filter=FieldFilter("email_verification_expires", ">", datetime.now(timezone.utc))
            ).limit(1).get()
            if not docs:
                return False
            doc_ref = self.collection.document(docs[0].id)
            await doc_ref.update({
                "is_email_verified": True,
                "updated_at": datetime.now(timezone.utc),
                "email_verification_code": None,
                "email_verification_expires": None
            })
            return True

        return await self._execute(_verify)

    async def find_user_by_verification_code(self, email: str, verification_code: str) -> Optional[Dict]:
        """Find user by email and verification code (for validation)"""
        async def _find():
            docs = await self.collection.where(filter=FieldFilter("email", "==", email)).where(
                filter=FieldFilter("email_verification_code", "==", verification_code)
            ).where(
                filter=FieldFilter("email_verification_expires", ">", datetime.now(timezone.utc))
            ).limit(1).get()
            if not docs:
                return None
            return self._doc_to_dict(docs[0])

        return await self._execute(_find)

    async def is_email_verified(self, email: str) -> bool:
        """Check if a user's email is verified"""
        user = await self.find_user_by_email(email)
        return user.get("is_email_verified", False) if user else False

    async def find_unverified_user_by_email(self, email: str) -> Optional[Dict]:
        """Find unverified user by email"""
        async def _find():
            docs = await self.collection.where(filter=FieldFilter("email", "==", email)).where(
                filter=FieldFilter("is_email_verified", "==", False)
            ).limit(1).get()
            if not docs:
                return None
            return self._doc_to_dict(docs[0])

        return await self._execute(_find)
