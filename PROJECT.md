# Innovation Workflow - Project Description

A full-stack web application for guiding users through a 4-stage innovation process: research upload, problem definition, idea generation, and report creation. Built with Next.js 14 (frontend) and FastAPI (backend), using Google Cloud Firestore as the database and multi-provider LLM support (Google Gemini, Anthropic Claude, OpenAI GPT). Deployed to Google Cloud Run via Cloud Build CI/CD.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14.2.16, React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI 0.111.1, Python, Uvicorn |
| Database | Google Cloud Firestore (async) |
| AI/LLM | Multi-provider: Google Gemini (default: `gemini-3.1-flash-lite-preview`), Anthropic Claude (`claude-sonnet-4-6`), OpenAI GPT (`gpt-4o`) with automatic fallback chain |
| Multi-Agent | AutoGen (UserProxyAgent, AssistantAgent) for conversational agents |
| Auth | JWT (HS256) + bcrypt password hashing |
| Email | SMTP (Gmail) for verification codes |
| UI Components | Radix UI, Lucide React icons, next-themes |
| PDF | jsPDF (export), pdfplumber/PyPDF2 (parsing) |
| RAG | LlamaIndex with Firestore-backed document store |
| Deploy | Google Cloud Run, Cloud Build, Artifact Registry, Docker |

## Architecture

```
Frontend (Next.js)  -->  Next.js API Routes (proxy)  -->  FastAPI Backend  -->  Firestore
                                                              |
                                                     LLM Providers (Gemini / Claude / GPT)
                                                              |
                                                     AutoGen Multi-Agent System
```

The frontend uses Next.js API routes as a proxy layer to the Python backend. All AI/LLM calls happen server-side in the backend. The backend implements a smart multi-provider fallback chain: if the primary LLM provider fails, it automatically falls back to alternative providers.

## Deployment

Both services are containerized with Docker and deployed to Google Cloud Run via Cloud Build:

- **Backend**: Python 3.11-slim image, Uvicorn on port 8000, health checks, non-root user
- **Frontend**: Multi-stage Node 20-alpine build (deps -> build -> runner), standalone Next.js output on port 3000
- **CI/CD**: `cloudbuild.yaml` orchestrates build, push to Artifact Registry, deploy to Cloud Run, and CORS configuration
- **Secrets**: Managed via Google Secret Manager (API keys, JWT secret, admin credentials, email credentials)

## Directory Structure

### Frontend (`/frontend`)
```
app/
  layout.tsx              # Root layout (AuthProvider + ModelProvider + ThemeProvider + Navbar)
  page.tsx                # Landing page
  error.tsx               # Global error boundary
  login/
    layout.tsx            # Login layout
    page.tsx              # Login form
  signup/
    layout.tsx            # Signup layout
    page.tsx              # Registration form
  verify-email/page.tsx   # Email verification (6-digit code)
  forgot-password/page.tsx # Password reset request
  reset-password/page.tsx # Password reset with token
  admin/page.tsx          # Admin dashboard (whitelist management)
  new/
    layout.tsx            # New project layout
    page.tsx              # New project
  past/
    page.tsx              # Past projects list
    table/page.tsx        # Past projects table view
  project/[id]/page.tsx   # Project details viewer
  debug/page.tsx          # Auth debug page (localStorage/cookie/API inspection)
  workflow/
    layout.tsx            # Workflow layout
    page.tsx              # Workflow hub
    upload/page.tsx       # Stage 1: Document upload & AI analysis
    problem/page.tsx      # Stage 2: Problem statement selection
    ideas/page.tsx        # Stage 3: AI-generated product ideas with images
    report/page.tsx       # Stage 4: Final report & PDF export
  api/                    # Next.js API routes (proxy to backend)
    auth/                 # login, signup, logout, verify-email, resend-verification, me, forgot-password, reset-password
    admin/
      allowed-emails/     # CRUD: usernames, domains, bulk operations
      users/              # User management
    projects/
      route.ts            # List/create projects
      [projectId]/
        route.ts          # Get/update/delete project
        upload/           # File upload
        upload-text/      # Text upload
        document/         # Document retrieval
        file/             # File retrieval + info
        save-progress/    # Save workflow progress
        pdf/              # PDF export
        report/           # Report generation
        stages/
          1/ 2/ 3/ 4/     # Stage data + generate endpoints
        ideas/
          [ideaId]/
            regenerate-image/  # Regenerate idea image
      image-proxy/        # Proxy for image serving
    images/[id]/          # Image retrieval by ID

context/
  AuthContext.tsx          # Auth state, login/signup/logout methods
  ModelContext.tsx         # AI model selection (stored in localStorage)

components/
  Navbar.tsx              # Top nav with user dropdown
  ProtectedRoute.tsx      # Auth guard for protected pages
  ModelSelector.tsx       # LLM model picker dropdown (multi-provider)
  PDFViewer.tsx           # PDF document viewer
  theme-provider.tsx      # next-themes dark/light mode provider
  ui/                     # 50+ Radix UI components (shadcn/ui)

hooks/
  use-mobile.tsx          # Mobile viewport detection hook
  use-toast.ts            # Toast notification hook

lib/
  utils.ts                # Shared utility functions (cn, etc.)
```

### Backend (`/backend`)
```
main.py                   # FastAPI app entry point with all routers, CORS, health check
auth_server.py            # Standalone auth server
run.py                    # Uvicorn startup script
Dockerfile                # Python 3.11-slim container image

app/
  routers/
    auth.py               # /signup, /login, /logout, /verify-email, /resend-verification, /forgot-password, /reset-password
    project.py            # /api/projects/* (CRUD, stages, uploads, generation)
    conversation.py       # /api/chat/* (chat sessions)
    rag.py                # /api/rag/* (document ingestion/querying)
    admin.py              # /api/admin/* (whitelist management)
    resource_alloc.py     # /api/resources/* (system monitoring)
    images.py             # /api/images/* (image retrieval)

  services/
    auth_service.py       # Auth business logic + admin account initialization
    project_service.py    # Project lifecycle & stage management
    agent_service.py      # Multi-provider LLM interactions with fallback chain (Gemini -> Claude -> GPT)
    image_service.py      # Gemini image generation & storage
    rag_service.py        # LlamaIndex RAG (document ingestion/querying)
    email_service.py      # SMTP email sending (verification, password reset)
    file_service.py       # File storage (base64 in Firestore)
    conversation_service.py # Chat session management

  assistance/             # AutoGen multi-agent system
    agents.py             # UserProxy and Reformulate agents (AutoGen)
    assistant.py          # Assistant class (Zelta) for agent management
    conversation_agent.py # Conversational agent logic
    documents_reading_agent.py # Document analysis agent
    memory_agent.py       # Memory/context agent
    scrape_agent.py       # Internet search agent
    teach_partner.py      # Teaching partner agent
    thread_manager.py     # Agent thread management
    custom_actor_client.py # Custom actor client for agents

  database/
    database.py           # Firestore async client setup (session_manager)
    query/
      db_auth.py          # User CRUD & verification queries
      db_project.py       # Project & stage queries
      db_message.py       # Chat message queries

  schema/
    user.py               # Pydantic models (UserCreate, UserDB, JWT helpers)
    project.py            # Project/stage models
    conversation.py       # Conversation/chat models
    rag.py                # RAG document models
    log.py                # Log entry models

  middleware/
    auth.py               # JWT verification, get_current_user dependency
    log.py                # Request/response logging (APIGatewayMiddleware)

  utils/
    email_validator.py    # Whitelist validation (Firestore-backed)
    logger.py             # CSV file logger (weekly rotation)

  prompts/
    assistant.py          # LLM prompt templates for all stages

  constant/
    config.py             # Environment variable loading + multi-provider CONFIG_LIST
    status.py             # StageStatus & ProjectStatus enums
    message.py            # MessageRoleEnum (user/assistant)
    log.py                # Log constants

scripts/
  whitelist_user.py       # CLI script to whitelist an email for signup
```

## Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `users` | User accounts (name, email, hashed_password, role, verification status) |
| `projects` | Projects with 4-stage arrays (analysis, problems, ideas, solution) |
| `rag_documents` | Ingested document text for RAG queries |
| `uploaded_files` | Original PDFs stored as base64 |
| `images` | AI-generated images stored as base64 |
| `messages` | Chat messages |
| `conversations` | Chat sessions |
| `allowed_emails` | Email whitelist (doc: `email_whitelist` with `allowed_usernames` + `allowed_domains` arrays) |

## Authentication Flow

1. **Signup**: Email validated against whitelist (username + domain) -> 6-digit verification code emailed
2. **Verify Email**: User enters code within 15 minutes
3. **Login**: Email/password -> JWT token stored in httpOnly cookie + localStorage
4. **Password Reset**: User requests reset -> token emailed -> user sets new password
5. **Admin**: Auto-created on startup via `ensure_admin_account_exists()`, auto-verified, bypasses whitelist

## 4-Stage Innovation Workflow

1. **Research Upload** (Stage 1): Upload PDF or paste text -> LLM analyzes and streams insights via SSE
2. **Problem Definition** (Stage 2): LLM generates 4-5 problem statements -> user selects or writes custom
3. **Idea Generation** (Stage 3): LLM generates product ideas + concept images (Gemini image generation)
4. **Report** (Stage 4): User selects idea -> final report compiled -> PDF export via jsPDF

## Multi-Provider LLM Fallback

The backend supports three LLM providers with automatic fallback:

| Provider | Default Model | API Key Env Var |
|----------|--------------|-----------------|
| Google Gemini | `gemini-3.1-flash-lite-preview` | `GEMINI_API_KEY` |
| Anthropic Claude | `claude-sonnet-4-6` | `CLAUDE_API_KEY` |
| OpenAI GPT | `gpt-4o` | `OPENAI_API_KEY` |

If the primary provider fails, the system automatically tries the next provider in the fallback chain (e.g., Google -> Anthropic -> OpenAI). Users are notified when a fallback model is used.

## Key Environment Variables

### Backend (`/backend/.env`)
```
GEMINI_API_KEY=           # Google Gemini API key
GEMINI_MODEL=             # LLM model (default: gemini-3.1-flash-lite-preview)
CLAUDE_API_KEY=           # Anthropic Claude API key
OPENAI_API_KEY=           # OpenAI API key
GOOGLE_CLOUD_PROJECT=     # GCP project ID
FIRESTORE_DATABASE=       # Firestore database name
JWT_SECRET=               # JWT signing key
SECRET_KEY=               # Session secret
ADMIN_EMAIL=              # Admin account email
ADMIN_PASSWORD=           # Admin account password
ADMIN_FIRST_NAME=         # Admin first name
ADMIN_LAST_NAME=          # Admin last name
EMAIL_USERNAME=           # Gmail for sending verification emails
EMAIL_PASSWORD=           # Gmail app password
ENVIRONMENT=              # "production" or "development"
ALLOWED_ORIGINS=          # Comma-separated CORS origins
APIFY_KEY=                # Apify API key (for scrape agent)
HOST=                     # Server host (default: 0.0.0.0)
PORT=                     # Server port (default: 8000)
```

### Frontend (`/frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=      # Backend API URL (e.g., http://127.0.0.1:8000)
NEXT_PUBLIC_BACKEND_URL=  # Backend URL (used in production builds)
```

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
python run.py  # Starts on port 8000

# Frontend
cd frontend
npm install    # or bun install
npm run dev    # Starts on port 3000
```

## Deploying to Cloud Run

```bash
# Full deploy (backend + frontend)
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_REGION=us-central1,_FIRESTORE_DATABASE=your-db-name

# Frontend only
cd frontend
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_BACKEND_URL=https://your-backend-url
```

## Model Selection

The app supports selecting different LLM models via a dropdown in the UI. The selected model is stored in localStorage and passed to the backend via the `X-Model-Type` header. The backend determines the provider (Google/Anthropic/OpenAI) from the model ID and routes the request accordingly, with automatic cross-provider fallback on failure.
