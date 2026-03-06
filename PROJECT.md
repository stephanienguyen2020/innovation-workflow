# Innovation Workflow - Project Description

A full-stack web application for guiding users through a 4-stage innovation process: research upload, problem definition, idea generation, and report creation. Built with Next.js 14 (frontend) and FastAPI (backend), using Google Cloud Firestore as the database and Google Gemini for AI capabilities.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14.2.16, React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI 0.111.1, Python, Uvicorn |
| Database | Google Cloud Firestore (async) |
| AI/LLM | Google Gemini (configurable model, default: `gemini-3-flash-preview`) |
| Auth | JWT (HS256) + bcrypt password hashing |
| Email | SMTP (Gmail) for verification codes |
| UI Components | Radix UI, Lucide React icons |
| PDF | jsPDF (export), pdfplumber/PyPDF2 (parsing) |
| RAG | LlamaIndex with Firestore-backed document store |

## Architecture

```
Frontend (Next.js)  -->  Next.js API Routes (proxy)  -->  FastAPI Backend  -->  Firestore
                                                              |
                                                         Google Gemini API
```

The frontend uses Next.js API routes as a proxy layer to the Python backend. All AI/LLM calls happen server-side in the backend.

## Directory Structure

### Frontend (`/frontend`)
```
app/
  layout.tsx              # Root layout (AuthProvider + ModelProvider + Navbar)
  page.tsx                # Landing page
  login/page.tsx          # Login form
  signup/page.tsx         # Registration form
  verify-email/page.tsx   # Email verification (6-digit code)
  forgot-password/page.tsx # Password reset request
  reset-password/page.tsx # Password reset with token
  admin/page.tsx          # Admin dashboard (whitelist management)
  new/page.tsx            # New project
  past/page.tsx           # Past projects list
  project/[id]/page.tsx   # Project details viewer
  workflow/
    page.tsx              # Workflow hub
    upload/page.tsx       # Stage 1: Document upload & AI analysis
    problem/page.tsx      # Stage 2: Problem statement selection
    ideas/page.tsx        # Stage 3: AI-generated product ideas with images
    report/page.tsx       # Stage 4: Final report & PDF export
  api/                    # Next.js API routes (proxy to backend)
    auth/                 # login, signup, logout, verify-email, me, forgot-password, reset-password
    admin/                # allowed-emails management
    projects/             # CRUD, stages, uploads, generation
    images/               # Image retrieval

context/
  AuthContext.tsx          # Auth state, login/signup/logout methods
  ModelContext.tsx         # AI model selection (stored in localStorage)

components/
  Navbar.tsx              # Top nav with user dropdown
  ProtectedRoute.tsx      # Auth guard for protected pages
  ModelSelector.tsx       # LLM model picker dropdown
  ui/                     # 50+ Radix UI components
```

### Backend (`/backend`)
```
main.py                   # FastAPI app entry point with all routers
auth_server.py            # Standalone auth server
run.py                    # Uvicorn startup script

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
    auth_service.py       # Auth business logic
    project_service.py    # Project lifecycle & stage management
    agent_service.py      # Gemini LLM interactions (analysis, ideas)
    image_service.py      # Gemini image generation & storage
    rag_service.py        # LlamaIndex RAG (document ingestion/querying)
    email_service.py      # SMTP email sending (verification, password reset)
    file_service.py       # File storage (base64 in Firestore)
    conversation_service.py # Chat session management

  database/
    database.py           # Firestore async client setup
    query/
      db_auth.py          # User CRUD & verification queries
      db_project.py       # Project & stage queries

  schema/
    user.py               # Pydantic models (UserCreate, UserDB, JWT helpers)
    project.py            # Project/stage models

  middleware/
    auth.py               # JWT verification, get_current_user dependency
    log.py                # Request/response logging

  utils/
    email_validator.py    # Whitelist validation (Firestore-backed)

  prompts/
    assistant.py          # LLM prompt templates for all stages

  constant/
    config.py             # Environment variable loading
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
5. **Admin**: Auto-verified on signup, bypasses whitelist

## 4-Stage Innovation Workflow

1. **Research Upload** (Stage 1): Upload PDF or paste text -> Gemini analyzes and streams insights via SSE
2. **Problem Definition** (Stage 2): Gemini generates 4-5 problem statements -> user selects or writes custom
3. **Idea Generation** (Stage 3): Gemini generates product ideas + concept images (Gemini 2.5 Flash Image)
4. **Report** (Stage 4): User selects idea -> final report compiled -> PDF export via jsPDF

## Key Environment Variables

### Backend (`/backend/.env`)
```
GEMINI_API_KEY=           # Google Gemini API key
GEMINI_MODEL=             # LLM model (default: gemini-3-flash-preview)
GOOGLE_CLOUD_PROJECT=     # GCP project ID
FIRESTORE_DATABASE=       # Firestore database name
JWT_SECRET=               # JWT signing key
SECRET_KEY=               # Session secret
ADMIN_EMAIL=              # Admin account email
ADMIN_PASSWORD=           # Admin account password
EMAIL_USERNAME=           # Gmail for sending verification emails
EMAIL_PASSWORD=           # Gmail app password
ENVIRONMENT=              # "production" or "development"
ALLOWED_ORIGINS=          # Comma-separated CORS origins
```

### Frontend (`/frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=      # Backend API URL (e.g., http://127.0.0.1:8000)
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

## Model Selection

The app supports selecting different Gemini models via a dropdown in the UI. The selected model is stored in localStorage and passed to the backend via the `X-Model-Type` header. The backend uses the configured `GEMINI_MODEL` env var by default.

Available models include the full Gemini family from Google's API.
