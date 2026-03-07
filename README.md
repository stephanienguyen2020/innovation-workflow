# Innovation Workflow

A guided ideation and iteration tool for the design process. Innovation Workflow helps users move from raw research to refined product ideas through a structured 4-stage workflow powered by AI.

Users upload research documents, receive AI-generated analysis, explore problem statements, generate product ideas with concept images, and produce a final innovation report -- all within a single, streamlined interface.

## How It Works

1. **Research Upload** -- Upload a PDF or paste text. The AI analyzes your research and surfaces key insights relevant to your problem domain.
2. **Problem Definition** -- The AI generates problem statements grounded in your research. Choose one, or write your own.
3. **Idea Generation** -- Based on the selected problem, the AI produces product ideas with detailed explanations and concept images. Iterate on any idea with feedback.
4. **Report** -- Select your preferred idea and export a final innovation report as a PDF.

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.10+
- Google Cloud project with Firestore enabled
- Google Gemini API key

### Run Locally

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Configure backend/.env (see backend/README.md)
python run.py                    # http://127.0.0.1:8000

# Frontend (in a separate terminal)
cd frontend
npm install --legacy-peer-deps
# Configure frontend/.env.local (see frontend/README.md)
npm run dev                      # http://localhost:3000
```

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for detailed setup instructions and project structure.

## Project Structure

```
innovation-workflow/
  frontend/          # Next.js 14 application
  backend/           # FastAPI application
```
