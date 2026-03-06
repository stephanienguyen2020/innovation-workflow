import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from fastapi import HTTPException, status
import os
from dotenv import load_dotenv

load_dotenv()

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.email_username = os.getenv("EMAIL_USERNAME")
        self.email_password = os.getenv("EMAIL_PASSWORD")
        self.from_email = os.getenv("FROM_EMAIL", self.email_username)
        
        if not self.email_username or not self.email_password:
            print("Warning: Email credentials not configured. Email verification will not work.")

    async def send_verification_email(self, to_email: str, verification_code: str) -> bool:
        """Send verification code email"""
        if not self.email_username or not self.email_password:
            # For development/testing, just log the code instead of sending email
            print("=" * 50)
            print("📧 EMAIL VERIFICATION CODE")
            print("=" * 50)
            print(f"📧 TO: {to_email}")
            print(f"🔢 CODE: {verification_code}")
            print(f"⏰ EXPIRES: 15 minutes from now")
            print("=" * 50)
            return True
        
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = "Email Verification - Innovation Workflow"
            message["From"] = self.from_email
            message["To"] = to_email

            # Create HTML content
            html_content = f"""
            <html>
              <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #001DFA;">Email Verification</h2>
                  <p>Welcome to Innovation Workflow!</p>
                  <p>Please use the following verification code to complete your registration:</p>
                  <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #001DFA; font-size: 36px; margin: 0; letter-spacing: 5px;">{verification_code}</h1>
                  </div>
                  <p>This code will expire in 15 minutes.</p>
                  <p>If you didn't request this verification, please ignore this email.</p>
                  <hr style="margin: 30px 0;">
                  <p style="color: #666; font-size: 14px;">Innovation Workflow Team</p>
                </div>
              </body>
            </html>
            """

            # Create plain text content
            text_content = f"""
            Email Verification - Innovation Workflow
            
            Welcome to Innovation Workflow!
            
            Please use the following verification code to complete your registration:
            
            {verification_code}
            
            This code will expire in 15 minutes.
            
            If you didn't request this verification, please ignore this email.
            
            Innovation Workflow Team
            """

            # Create MIMEText objects
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")

            # Add parts to message
            message.attach(part1)
            message.attach(part2)

            # Send email
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.email_username, self.email_password)
                server.sendmail(self.from_email, to_email, message.as_string())

            print(f"Verification email sent successfully to {to_email}")
            return True

        except Exception as e:
            print(f"Failed to send verification email to {to_email}: {str(e)}")
            # For development, still return True so the flow continues
            # In production, you might want to return False or raise an exception
            if os.getenv("ENVIRONMENT", "development") == "development":
                print(f"DEVELOPMENT MODE - Verification code for {to_email}: {verification_code}")
                return True
            return False

    async def send_password_reset_email(self, to_email: str, reset_code: str) -> bool:
        """Send password reset email with a 6-digit code"""
        if not self.email_username or not self.email_password:
            print("=" * 50)
            print("PASSWORD RESET CODE")
            print("=" * 50)
            print(f"TO: {to_email}")
            print(f"CODE: {reset_code}")
            print(f"EXPIRES: 15 minutes from now")
            print("=" * 50)
            return True

        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = "Password Reset - Innovation Workflow"
            message["From"] = self.from_email
            message["To"] = to_email

            html_content = f"""
            <html>
              <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #001DFA;">Password Reset</h2>
                  <p>You requested a password reset for your Innovation Workflow account.</p>
                  <p>Please use the following code to reset your password:</p>
                  <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #001DFA; font-size: 36px; margin: 0; letter-spacing: 5px;">{reset_code}</h1>
                  </div>
                  <p>This code will expire in 15 minutes.</p>
                  <p>If you didn't request this reset, please ignore this email. Your password will remain unchanged.</p>
                  <hr style="margin: 30px 0;">
                  <p style="color: #666; font-size: 14px;">Innovation Workflow Team</p>
                </div>
              </body>
            </html>
            """

            text_content = f"""
            Password Reset - Innovation Workflow

            You requested a password reset for your Innovation Workflow account.

            Please use the following code to reset your password:

            {reset_code}

            This code will expire in 15 minutes.

            If you didn't request this reset, please ignore this email.

            Innovation Workflow Team
            """

            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)

            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.email_username, self.email_password)
                server.sendmail(self.from_email, to_email, message.as_string())

            print(f"Password reset email sent successfully to {to_email}")
            return True

        except Exception as e:
            print(f"Failed to send password reset email to {to_email}: {str(e)}")
            if os.getenv("ENVIRONMENT", "development") == "development":
                print(f"DEVELOPMENT MODE - Reset code for {to_email}: {reset_code}")
                return True
            return False
