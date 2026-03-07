# Innovation Workflow - Frontend

Next.js 14 application providing the user interface for the Innovation Workflow platform.

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
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
    page.tsx                  # Workflow hub
    upload/page.tsx           # Stage 1: Document upload & AI analysis
    problem/page.tsx          # Stage 2: Problem statement selection
    ideas/page.tsx            # Stage 3: AI-generated product ideas with images
    report/page.tsx           # Stage 4: Final report & PDF export
  api/                        # Next.js API routes (proxy to backend)
    auth/                     # Authentication endpoints
    admin/                    # Whitelist management
    projects/                 # Project CRUD, stages, uploads, generation
    images/                   # Image retrieval

context/
  AuthContext.tsx              # Auth state, login/signup/logout methods
  ModelContext.tsx              # AI model selection (stored in localStorage)

components/
  Navbar.tsx                   # Top navigation with user dropdown
  ProtectedRoute.tsx           # Auth guard for protected pages
  ModelSelector.tsx            # LLM model picker dropdown
  ui/                          # Radix UI component library
```

## Tech Stack

- **Framework**: Next.js 14.2, React 18, TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, Lucide React icons
- **PDF Export**: jsPDF
- **Auth**: JWT stored in httpOnly cookies + localStorage
