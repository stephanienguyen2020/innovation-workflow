import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_MODEL = "gpt-4o-mini"
OPENAI_API_KEY= os.getenv("OPENAI_API_KEY") 

APIFY_KEY = os.getenv("APIFY_KEY")
SECRET_KEY= os.getenv("SECRET_KEY")
MONGODB_CONNECTION_URL = os.getenv("MONGODB_CONNECTION_URL")
JWT_SECRET= os.getenv("JWT_SECRET")

# Production flag
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

# Host and port for uvicorn server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# Admin account configuration
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
ADMIN_FIRST_NAME = os.getenv("ADMIN_FIRST_NAME")
ADMIN_LAST_NAME = os.getenv("ADMIN_LAST_NAME")
