# Innovation Workflow - Frontend

Next.js 14 application providing the user interface for the Innovation Workflow platform.

## Getting Started

```bash
# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.sample .env.local
# Edit .env.local and set:
#   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

# Run development server
npm run dev    # Starts on http://localhost:3000
```

## Project Structure

```
app/
  layout.tsx                  # Root layout (AuthProvider + ModelProvider + Navbar)
  page.tsx                    # Landing page
  login/page.tsx              # Login form
  signup/page.tsx             # Registration form
  verify-email/page.tsx       # Email verification (6-digit code)
  forgot-password/page.tsx    # Password reset request
  reset-password/page.tsx     # Password reset with token
  admin/page.tsx              # Admin dashboard (whitelist management)
  new/page.tsx                # Create new project
  past/page.tsx               # Past projects list
  project/[id]/page.tsx       # Project details viewer
  workflow/
    page.tsx                  # Workflow hub (5-stage overview)
    research/page.tsx         # Stage 1: Document upload (PDF or text)
    understand/page.tsx       # Stage 2: AI-powered analysis (SSE streaming)
    analysis/page.tsx         # Stage 3: Problem statement selection
    ideate/page.tsx           # Stage 4: AI-generated product ideas with images
    evaluate/page.tsx         # Stage 5: Evaluation, feedback, iteration loop
    report/page.tsx           # Comprehensive report & PDF export
  api/                        # Next.js API routes (proxy to backend)
    auth/                     # Authentication endpoints
    admin/                    # Whitelist management
    projects/                 # Project CRUD, stages, uploads, generation,
                              # feedback-loop, iterations, reports
    images/                   # Image retrieval

context/
  AuthContext.tsx              # Auth state, login/signup/logout methods
  ModelContext.tsx             # AI model selection (stored in localStorage)

components/
  Navbar.tsx                   # Top navigation with user dropdown
  ProtectedRoute.tsx           # Auth guard for protected pages
  ModelSelector.tsx            # LLM model picker dropdown
  WorkflowProgress.tsx         # 5-step progress indicator with stage names
  StageReportButton.tsx        # Per-stage PDF report generation button
  IterationHistory.tsx         # Expandable iteration history panel
  ui/                          # Radix UI component library
```

## Tech Stack

- **Framework**: Next.js 14.2, React 18, TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, Lucide React icons
- **PDF Export**: jsPDF
- **Auth**: JWT stored in httpOnly cookies + localStorage
