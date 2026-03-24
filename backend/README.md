# Innovation Workflow - Backend

FastAPI application powering the Innovation Workflow platform with AI-driven analysis, idea generation, image creation, and iterative feedback loops.

## Getting Started

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.sample .env
# Edit .env and configure required variables (see below)

# Run the server
python run.py                   # Starts on http://127.0.0.1:8000
```

### Required Environment Variables

```
# ---- LLM API Keys ----
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
CLAUDE_API_KEY=                  # Optional (multi-provider fallback)
OPENAI_API_KEY=                  # Optional (multi-provider fallback)

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

## 5-Stage Workflow

The backend implements a 5-stage innovation workflow:

| Stage | Name | Description |
|-------|------|-------------|
| 1 | **Research** | Upload PDF or text. Stores documents, no AI processing. |
| 2 | **Understand** | AI analyzes uploaded research via SSE streaming. |
| 3 | **Analysis** | AI generates problem statements from the analysis. |
| 4 | **Ideate** | AI generates product ideas with concept images for a selected problem. |
| 5 | **Evaluate** | User reviews ideas, submits feedback, optionally triggers feedback loop. |

### Feedback Loop

From Stage 5, users can submit feedback that triggers an SSE-streamed feedback loop:
1. Current state is saved as a versioned iteration snapshot (Firestore subcollection)
2. Stages 2-4 are reset and re-run with the feedback injected into LLM prompts
3. Progress events are streamed to the frontend in real-time

### Key API Endpoints

```
POST   /api/projects/                              # Create project
GET    /api/projects/{id}                           # Get project
DELETE /api/projects/{id}                           # Delete project

POST   /api/projects/{id}/stages/1/upload           # Upload PDF
POST   /api/projects/{id}/stages/1/upload-text      # Upload text
POST   /api/projects/{id}/stages/2/generate/stream  # SSE: generate analysis
POST   /api/projects/{id}/stages/3/generate         # Generate problem statements
POST   /api/projects/{id}/stages/4/generate         # Generate product ideas
POST   /api/projects/{id}/stages/5/submit-feedback  # Submit evaluation

POST   /api/projects/{id}/feedback-loop             # SSE: trigger feedback loop
GET    /api/projects/{id}/iterations                 # List iteration snapshots
GET    /api/projects/{id}/iterations/{n}             # Get specific snapshot

POST   /api/projects/{id}/stages/{n}/report         # Generate per-stage report
GET    /api/projects/{id}/stages/{n}/report          # Get per-stage report
GET    /api/projects/{id}/comprehensive-report       # Get full report data
```

## Project Structure

```
main.py                        # FastAPI app entry point with all routers
run.py                         # Uvicorn startup script

app/
  routers/
    auth.py                    # Signup, login, logout, email verification, password reset
    project.py                 # Project CRUD, 5-stage workflow, feedback loop, reports
    conversation.py            # Chat sessions
    rag.py                     # Document ingestion and querying
    admin.py                   # Email whitelist management
    resource_alloc.py          # System monitoring
    images.py                  # Image retrieval

  services/
    auth_service.py            # Auth business logic
    project_service.py         # Project lifecycle, 5-stage workflow, feedback loop
    agent_service.py           # Multi-provider LLM interactions (Gemini/Claude/OpenAI)
    image_service.py           # Gemini image generation & Firestore storage
    rag_service.py             # LlamaIndex RAG (document ingestion/querying)
    email_service.py           # SMTP email sending
    file_service.py            # File storage (base64 in Firestore)
    conversation_service.py    # Chat session management

  database/
    database.py                # Firestore async client setup
    query/
      db_auth.py               # User CRUD & verification queries
      db_project.py            # Project, stage, iteration & report queries

  schema/
    user.py                    # Pydantic models for users & JWT
    project.py                 # Pydantic models for projects, stages, iterations

  middleware/
    auth.py                    # JWT verification, get_current_user dependency
    log.py                     # Request/response logging

  utils/
    email_validator.py         # Whitelist validation (Firestore-backed)

  prompts/
    assistant.py               # LLM prompt templates for all stages + feedback loop

  constant/
    config.py                  # Environment variable loading
    status.py                  # Stage & project status enums

scripts/
  migrate_to_5_stages.py       # Migration script for existing 4-stage projects
  whitelist_user.py            # Add user to email whitelist
```

## Tech Stack

- **Framework**: FastAPI 0.111, Uvicorn
- **Database**: Google Cloud Firestore (async)
- **AI/LLM**: Google Gemini (primary), Anthropic Claude & OpenAI GPT (fallback)
- **RAG**: LlamaIndex with Firestore-backed document store
- **Auth**: JWT (HS256) + bcrypt password hashing
- **Email**: SMTP (Gmail)
