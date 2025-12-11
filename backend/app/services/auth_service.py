from datetime import datetime, timezone
from typing import Dict, Optional
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from app.database.query.db_auth import DBAuth
from app.schema.user import (
    UserCreate, UserDB, create_access_token, hash_password, verify_password,
    generate_verification_code, create_verification_code_expiry,
    EmailVerificationRequest, EmailVerificationCode, ResendVerificationCode
)
from app.services.email_service import EmailService
from app.utils.email_validator import email_validator
from app.constant.config import ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME
from bson import ObjectId

class AuthService:
    def __init__(self, db_auth: DBAuth):
        self.db_auth = db_auth
        self.email_service = EmailService()

    def _serialize_response(self, obj: Dict) -> Dict:
        """Convert datetime and ObjectId objects to strings"""
        serialized = {}
        for key, value in obj.items():
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, ObjectId):
                serialized[key] = str(value)
            elif isinstance(value, dict):
                serialized[key] = self._serialize_response(value)
            else:
                serialized[key] = value
        return serialized

    async def signup(self, user: UserCreate) -> JSONResponse:
        """Handle user signup with email whitelist validation and email verification"""
        try:
            # Validate email against whitelist
            if not await email_validator.is_email_allowed(user.email):
                error_message = await email_validator.get_validation_error_message(user.email)
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "statusCode": 400,
                        "message": error_message,
                        "errorCode": "EMAIL_NOT_AUTHORIZED",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                )
            
            # Check if email exists
            if await self.db_auth.check_email_exists(user.email):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "statusCode": 400,
                        "message": "Email already registered",
                        "errorCode": "EMAIL_TAKEN",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                )
            
            # Check if this is admin account signup
            is_admin = email_validator.is_admin_email(user.email)
            
            # Generate verification code (not needed for admin but keep consistent structure)
            verification_code = generate_verification_code()
            verification_expires = create_verification_code_expiry()
            
            # Prepare user data with email verification fields
            hashed_password = hash_password(user.password)
            db_user = {
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "hashed_password": hashed_password,
                "role": "admin" if is_admin else user.role,
                "is_email_verified": True if is_admin else False,  # Admin is auto-verified
                "email_verification_code": None if is_admin else verification_code,
                "email_verification_expires": None if is_admin else verification_expires,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            # Create user in database
            created_user = await self.db_auth.create_user(db_user)
            
            # Handle admin vs regular user response
            if is_admin:
                return JSONResponse(
                    content={
                        "message": "Admin account created successfully. You can log in immediately.",
                        "email": user.email,
                        "requires_verification": False,
                        "is_admin": True
                    },
                    status_code=status.HTTP_201_CREATED
                )
            else:
                # Send verification email for regular users
                email_sent = await self.email_service.send_verification_email(
                    user.email, verification_code
                )
                
                if not email_sent:
                    # In production, you might want to delete the created user if email fails
                    print(f"Warning: Failed to send verification email to {user.email}")
                
                # Return success response without sensitive data
                return JSONResponse(
                    content={
                        "message": "Account created successfully. Please check your email for verification code.",
                        "email": user.email,
                        "requires_verification": True
                    },
                    status_code=status.HTTP_201_CREATED
                )
        except HTTPException as e:
            # Re-raise HTTP exceptions as they are already properly formatted
            raise e
        except Exception as e:
            # Handle any other exceptions
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Signup failed: {str(e)}"
            )

    async def login(self, form_data: OAuth2PasswordRequestForm) -> JSONResponse:
        """Handle user login"""
        try:
            # Find user by email
            user = await self.db_auth.find_user_by_email(form_data.username)
            if not user or not verify_password(form_data.password, user["hashed_password"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            # Check if email is verified (skip for admin)
            is_admin = email_validator.is_admin_email(user["email"])
            if not is_admin and not user.get("is_email_verified", False):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "statusCode": 403,
                        "message": "Email not verified. Please verify your email before logging in.",
                        "errorCode": "EMAIL_NOT_VERIFIED",
                        "email": user["email"],
                        "requires_verification": True
                    }
                )
            
            # Update last login
            await self.db_auth.update_last_login(str(user["_id"]))
            
            # Create access token
            access_token = create_access_token(data={"sub": user["email"]})
            
            # Prepare response
            response_data = {
                "access_token": access_token,
                "user": {
                    "userId": str(user["_id"]),
                    "username": user["email"],
                    "priviledge": user.get("role", "user")
                }
            }
            
            # Create response with cookie
            response = JSONResponse(content=response_data)
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=True,
                samesite="Strict"
            )
            
            return response
        except HTTPException as e:
            raise e
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Login failed: {str(e)}"
            )

    async def logout(self) -> JSONResponse:
        """Handle user logout"""
        try:
            response = JSONResponse(content={"message": "Logged out successfully"})
            response.delete_cookie("access_token")
            return response
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Logout failed: {str(e)}"
            )

    async def verify_email(self, verification_data: EmailVerificationCode) -> JSONResponse:
        """Verify email using verification code"""
        try:
            # Verify the code and mark email as verified
            verification_success = await self.db_auth.verify_email_code(
                verification_data.email, 
                verification_data.verification_code
            )
            
            if not verification_success:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "statusCode": 400,
                        "message": "Invalid or expired verification code",
                        "errorCode": "INVALID_VERIFICATION_CODE"
                    }
                )
            
            return JSONResponse(
                content={
                    "message": "Email verified successfully! You can now log in.",
                    "email": verification_data.email,
                    "verified": True
                },
                status_code=status.HTTP_200_OK
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Email verification failed: {str(e)}"
            )

    async def resend_verification_code(self, resend_data: ResendVerificationCode) -> JSONResponse:
        """Resend verification code to user's email"""
        try:
            # Check if user exists and is unverified
            user = await self.db_auth.find_unverified_user_by_email(resend_data.email)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={
                        "statusCode": 404,
                        "message": "User not found or email already verified",
                        "errorCode": "USER_NOT_FOUND_OR_VERIFIED"
                    }
                )
            
            # Generate new verification code
            verification_code = generate_verification_code()
            verification_expires = create_verification_code_expiry()
            
            # Update verification code in database
            update_success = await self.db_auth.update_email_verification_code(
                resend_data.email, 
                verification_code, 
                verification_expires
            )
            
            if not update_success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update verification code"
                )
            
            # Send new verification email
            email_sent = await self.email_service.send_verification_email(
                resend_data.email, 
                verification_code
            )
            
            if not email_sent:
                print(f"Warning: Failed to send verification email to {resend_data.email}")
            
            return JSONResponse(
                content={
                    "message": "Verification code resent successfully. Please check your email.",
                    "email": resend_data.email
                },
                status_code=status.HTTP_200_OK
            )
            
        except HTTPException as e:
            raise e
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to resend verification code: {str(e)}"
            )

    async def ensure_admin_account_exists(self) -> bool:
        """Ensure admin account exists, create if it doesn't"""
        try:
            # Check if admin account already exists
            existing_admin = await self.db_auth.find_user_by_email(ADMIN_EMAIL)
            if existing_admin:
                print(f"Admin account already exists: {ADMIN_EMAIL}")
                return True

            # Create admin account
            hashed_password = hash_password(ADMIN_PASSWORD)
            admin_user = {
                "first_name": ADMIN_FIRST_NAME,
                "last_name": ADMIN_LAST_NAME,
                "email": ADMIN_EMAIL,
                "hashed_password": hashed_password,
                "role": "admin",
                "is_email_verified": True,  # Admin is auto-verified
                "email_verification_code": None,
                "email_verification_expires": None,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }

            # Create admin user in database
            created_admin = await self.db_auth.create_user(admin_user)
            print(f"Admin account created successfully: {ADMIN_EMAIL}")
            return True

        except Exception as e:
            print(f"Failed to create admin account: {str(e)}")
            return False
