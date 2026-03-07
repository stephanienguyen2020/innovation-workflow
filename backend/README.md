# Innovation Workflow - Backend

FastAPI application powering the Innovation Workflow platform with AI-driven analysis, idea generation, and image creation.

## Getting Started

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and configure required variables (see below)

# Run the server
python run.py                   # Starts on http://127.0.0.1:8000
```

### Required Environment Variables

```
# ---- LLM API Keys ----
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
CLAUDE_API_KEY=
OPENAI_API_KEY=

# ---- Google Cloud ----
GOOGLE_CLOUD_PROJECT=
FIRESTORE_DATABASE=(default)

# ---- Auth / Security ----
JWT_SECRET=
SECRET_KEY=

# ---- Admin Account ----
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User

# ---- Email (SMTP / Gmail) ----
EMAIL_USERNAME=
EMAIL_PASSWORD=
FROM_EMAIL=

# ---- Runtime ----
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=http://localhost:3000

# ---- Optional ----
APIFY_KEY=
```

## Project Structure

```
main.py                        # FastAPI app entry point with all routers
run.py                         # Uvicorn startup script

app/
  routers/
    auth.py                    # Signup, login, logout, email verification, password reset
    project.py                 # Project CRUD, stage uploads, AI generation endpoints
    conversation.py            # Chat sessions
    rag.py                     # Document ingestion and querying
    admin.py                   # Email whitelist management
    resource_alloc.py          # System monitoring
    images.py                  # Image retrieval

  services/
    auth_service.py            # Auth business logic
    project_service.py         # Project lifecycle & 4-stage workflow
    agent_service.py           # Gemini LLM interactions (analysis, ideas)
    image_service.py           # Gemini image generation & Firestore storage
    rag_service.py             # LlamaIndex RAG (document ingestion/querying)
    email_service.py           # SMTP email sending
    file_service.py            # File storage (base64 in Firestore)
    conversation_service.py    # Chat session management

  database/
    database.py                # Firestore async client setup
    query/
      db_auth.py               # User CRUD & verification queries
      db_project.py            # Project & stage queries

  schema/
    user.py                    # Pydantic models for users & JWT
    project.py                 # Pydantic models for projects & stages

  middleware/
    auth.py                    # JWT verification, get_current_user dependency
    log.py                     # Request/response logging

  utils/
    email_validator.py         # Whitelist validation (Firestore-backed)

  prompts/
    assistant.py               # LLM prompt templates for all stages

  constant/
    config.py                  # Environment variable loading
    status.py                  # Stage & project status enums
```

## Tech Stack

- **Framework**: FastAPI 0.111, Uvicorn
- **Database**: Google Cloud Firestore (async)
- **AI/LLM**: Google Gemini (configurable model)
- **RAG**: LlamaIndex with Firestore-backed document store
- **Auth**: JWT (HS256) + bcrypt password hashing
- **Email**: SMTP (Gmail)
