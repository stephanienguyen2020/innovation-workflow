from datetime import datetime, timezone
from typing import Optional, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClientSession
from fastapi import HTTPException, status
from bson import ObjectId

class DBAuth:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["users"]

    async def _execute_in_transaction(self, operation, *args, **kwargs):
        """Execute an operation within a transaction"""
        async with await self.db.client.start_session() as session:
            async with session.start_transaction():
                try:
                    result = await operation(*args, **kwargs)
                    return result
                except Exception as e:
                    await session.abort_transaction()
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Database operation failed: {str(e)}"
                    )

    async def find_user_by_email(self, email: str) -> Optional[Dict]:
        """Find a user by email"""
        return await self._execute_in_transaction(
            self.collection.find_one,
            {"email": email}
        )

    async def create_user(self, user_data: Dict) -> Dict:
        """Create a new user"""
        async def _create():
            user_data["created_at"] = datetime.now(timezone.utc)
            user_data["updated_at"] = datetime.now(timezone.utc)
            
            result = await self.collection.insert_one(user_data)
            user_data["id"] = str(result.inserted_id)
            return user_data

        return await self._execute_in_transaction(_create)

    async def update_last_login(self, user_id: str) -> None:
        """Update the last login time for a user"""
        async def _update():
            await self.collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"last_login": datetime.now(timezone.utc)}}
            )

        await self._execute_in_transaction(_update)

    async def check_email_exists(self, email: str) -> bool:
        """Check if an email already exists in the database"""
        existing_user = await self.find_user_by_email(email)
        return existing_user is not None

    async def update_email_verification_code(self, email: str, verification_code: str, expires_at: datetime) -> bool:
        """Update or set email verification code for a user"""
        async def _update():
            result = await self.collection.update_one(
                {"email": email},
                {
                    "$set": {
                        "email_verification_code": verification_code,
                        "email_verification_expires": expires_at,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            return result.modified_count > 0

        return await self._execute_in_transaction(_update)

    async def verify_email_code(self, email: str, verification_code: str) -> bool:
        """Verify email verification code and mark email as verified"""
        async def _verify():
            # First check if the code is valid and not expired
            user = await self.collection.find_one({
                "email": email,
                "email_verification_code": verification_code,
                "email_verification_expires": {"$gt": datetime.now(timezone.utc)}
            })
            
            if not user:
                return False
            
            # Mark email as verified and clear verification code
            result = await self.collection.update_one(
                {"email": email},
                {
                    "$set": {
                        "is_email_verified": True,
                        "updated_at": datetime.now(timezone.utc)
                    },
                    "$unset": {
                        "email_verification_code": "",
                        "email_verification_expires": ""
                    }
                }
            )
            
            return result.modified_count > 0

        return await self._execute_in_transaction(_verify)

    async def find_user_by_verification_code(self, email: str, verification_code: str) -> Optional[Dict]:
        """Find user by email and verification code (for validation)"""
        return await self._execute_in_transaction(
            self.collection.find_one,
            {
                "email": email,
                "email_verification_code": verification_code,
                "email_verification_expires": {"$gt": datetime.now(timezone.utc)}
            }
        )

    async def is_email_verified(self, email: str) -> bool:
        """Check if a user's email is verified"""
        user = await self.find_user_by_email(email)
        return user.get("is_email_verified", False) if user else False

    async def find_unverified_user_by_email(self, email: str) -> Optional[Dict]:
        """Find unverified user by email"""
        return await self._execute_in_transaction(
            self.collection.find_one,
            {"email": email, "is_email_verified": False}
        )
