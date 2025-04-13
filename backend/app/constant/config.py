import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_MODEL = "gpt-4o-mini"
OPENAI_API_KEY= os.getenv("OPENAI_API_KEY")
SECRET_KEY= os.getenv("SECRET_KEY")
MONGODB_CONNECTION_URL = os.getenv("MONGODB_CONNECTION_URL")
JWT_SECRET_KEY= os.getenv("JWT_SECRET_KEY")