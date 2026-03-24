# Innovation Workflow

A guided ideation and iteration tool for the design process. Innovation Workflow helps users move from raw research to refined product ideas through a structured 5-stage workflow powered by AI, with a feedback loop for iterative improvement.

Users upload research documents, receive AI-generated analysis, explore problem statements, generate product ideas with concept images, evaluate and iterate with feedback, and produce a final innovation report -- all within a single, streamlined interface.

## How It Works

1. **Research** -- Upload a PDF or paste text. Your raw research is stored for AI processing.
2. **Understand** -- The AI analyzes your research via streaming and surfaces key insights relevant to your problem domain.
3. **Analysis** -- The AI generates problem statements grounded in your research. Choose one, or write your own.
4. **Ideate** -- Based on the selected problem, the AI produces product ideas with detailed explanations and concept images. Iterate on any idea with feedback.
5. **Evaluate** -- Review your ideas, select a solution, and optionally submit feedback to re-run stages 2-4 with improvements (feedback loop). Each loop creates a versioned iteration snapshot.

After evaluation, export a comprehensive innovation report as a PDF.

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.10+
- Google Cloud project with Firestore enabled
- Google Gemini API key

### Run the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.sample .env
# Edit .env and fill in the required values (see below)

# Run the server
python run.py                    # http://127.0.0.1:8000
```

**Required environment variables** (in `backend/.env`):

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID with Firestore enabled |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `SECRET_KEY` | App secret key |
| `ADMIN_EMAIL` | Admin account email (created on first startup) |
| `ADMIN_PASSWORD` | Admin account password |

Optional: `CLAUDE_API_KEY`, `OPENAI_API_KEY` (for multi-provider LLM fallback), `EMAIL_USERNAME`/`EMAIL_PASSWORD`/`FROM_EMAIL` (for email features), `APIFY_KEY`.

See [backend/.env.sample](backend/.env.sample) for the full list.

### Run the Frontend

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.sample .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

# Run the dev server
npm run dev                      # http://localhost:3000
```

### Migrate Existing Projects (if upgrading from 4-stage)

If you have existing projects from the old 4-stage workflow, run the migration script:

```bash
cd backend
source venv/bin/activate
python -m scripts.migrate_to_5_stages
```

This maps old stages to the new 5-stage format. Projects also auto-migrate when loaded via the Pydantic model validator.

## Project Structure

```
innovation-workflow/
  backend/           # FastAPI application
  frontend/          # Next.js 14 application
```

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for detailed project structure.
