import os
from dotenv import load_dotenv

dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv(dotenv_path=dotenv_path, override=True)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

APIFY_KEY = os.getenv("APIFY_KEY")
SECRET_KEY= os.getenv("SECRET_KEY")
JWT_SECRET= os.getenv("JWT_SECRET")

GCP_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
FIRESTORE_DATABASE = os.getenv("FIRESTORE_DATABASE")

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

CONFIG_LIST = [
    {
        "model": GEMINI_MODEL,
        "api_key": GEMINI_API_KEY,
        "api_type": "google"
    }
]
