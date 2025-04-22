# Create a new file: run.py at the project root
import uvicorn
from app.constant.config import HOST, PORT, IS_PRODUCTION

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=not IS_PRODUCTION
    )