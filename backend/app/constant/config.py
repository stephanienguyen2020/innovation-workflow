import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_MODEL = "gpt-4o-mini"
OPENAI_API_KEY= os.getenv("OPENAI_API_KEY")
SECRET_KEY= os.getenv("SECRET_KEY")
MONGODB_CONNECTION_URL = os.getenv("MONGODB_CONNECTION_URL")
JWT_SECRET= os.getenv("JWT_SECRET")

# Production flag
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

# Host and port for uvicorn server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
