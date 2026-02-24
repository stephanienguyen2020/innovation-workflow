#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Innovation Workflow - Google Cloud Run Deployment Script
# ============================================================
# Deploys the backend (FastAPI) and frontend (Next.js) to
# Cloud Run with secrets managed via Google Secret Manager.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCP project with billing enabled
#   - Firestore database already provisioned
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================================

# ------- Configuration -------
# Override these via environment variables or edit defaults below

PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-us-central1}"
FIRESTORE_DB="${FIRESTORE_DATABASE:-}"

BACKEND_SERVICE="innovation-backend"
FRONTEND_SERVICE="innovation-frontend"
AR_REPO="innovation-workflow"

BACKEND_MEMORY="1Gi"
BACKEND_CPU="1"
BACKEND_TIMEOUT="300"
BACKEND_MIN_INSTANCES="0"
BACKEND_MAX_INSTANCES="5"

FRONTEND_MEMORY="512Mi"
FRONTEND_CPU="1"
FRONTEND_TIMEOUT="60"
FRONTEND_MIN_INSTANCES="0"
FRONTEND_MAX_INSTANCES="5"

# ------- Helper functions -------

log()   { echo -e "\n\033[1;34m==>\033[0m \033[1m$*\033[0m"; }
warn()  { echo -e "\033[1;33mWARNING:\033[0m $*"; }
error() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

prompt_value() {
    local var_name="$1" prompt_text="$2" default="${3:-}"
    local current_val="${!var_name:-$default}"
    if [[ -n "$current_val" ]]; then
        read -rp "$prompt_text [$current_val]: " input
        eval "$var_name=\"${input:-$current_val}\""
    else
        read -rp "$prompt_text: " input
        [[ -z "$input" ]] && error "$var_name is required"
        eval "$var_name=\"$input\""
    fi
}

prompt_secret() {
    local var_name="$1" prompt_text="$2"
    read -rsp "$prompt_text: " input
    echo
    [[ -z "$input" ]] && error "$var_name is required"
    eval "$var_name=\"$input\""
}

create_or_update_secret() {
    local secret_name="$1" secret_value="$2"
    if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &>/dev/null; then
        echo "$secret_value" | gcloud secrets versions add "$secret_name" \
            --project="$PROJECT_ID" --data-file=-
        echo "  Updated secret: $secret_name"
    else
        echo "$secret_value" | gcloud secrets create "$secret_name" \
            --project="$PROJECT_ID" --data-file=- --replication-policy=automatic
        echo "  Created secret: $secret_name"
    fi
}

# ------- Pre-flight checks -------

log "Checking prerequisites..."

command -v gcloud >/dev/null 2>&1 || error "gcloud CLI is not installed. Install it from https://cloud.google.com/sdk/docs/install"

# Ensure authenticated
gcloud auth print-identity-token &>/dev/null || error "Not authenticated. Run: gcloud auth login"

# ------- Gather configuration -------

log "Project configuration"

if [[ -z "$PROJECT_ID" ]]; then
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
fi
prompt_value PROJECT_ID "GCP Project ID" "$PROJECT_ID"
prompt_value REGION "Region" "$REGION"
prompt_value FIRESTORE_DB "Firestore database name (leave empty for default)" "$FIRESTORE_DB"

# Set the active project
gcloud config set project "$PROJECT_ID"

log "Gathering secrets..."
echo "Enter the values for your application secrets."
echo "(These will be stored in Google Secret Manager)"
echo

prompt_secret GEMINI_API_KEY "Gemini API Key"
prompt_secret JWT_SECRET_VAL "JWT Secret"
prompt_secret SECRET_KEY_VAL "Session Secret Key"
prompt_value ADMIN_EMAIL_VAL "Admin Email" ""
prompt_secret ADMIN_PASSWORD_VAL "Admin Password"
prompt_value ADMIN_FIRST_NAME_VAL "Admin First Name" "Admin"
prompt_value ADMIN_LAST_NAME_VAL "Admin Last Name" "User"

# ------- Enable required APIs -------

log "Enabling required GCP APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
    --project="$PROJECT_ID"

# ------- Create Artifact Registry repo -------

log "Setting up Artifact Registry..."
if ! gcloud artifacts repositories describe "$AR_REPO" \
    --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    gcloud artifacts repositories create "$AR_REPO" \
        --repository-format=docker \
        --location="$REGION" \
        --project="$PROJECT_ID"
    echo "  Created repository: $AR_REPO"
else
    echo "  Repository already exists: $AR_REPO"
fi

# Configure Docker auth for Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ------- Store secrets -------

log "Storing secrets in Secret Manager..."
create_or_update_secret "gemini-api-key" "$GEMINI_API_KEY"
create_or_update_secret "jwt-secret" "$JWT_SECRET_VAL"
create_or_update_secret "secret-key" "$SECRET_KEY_VAL"
create_or_update_secret "admin-email" "$ADMIN_EMAIL_VAL"
create_or_update_secret "admin-password" "$ADMIN_PASSWORD_VAL"

# Grant Cloud Run service account access to secrets
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

log "Granting Secret Manager access to Cloud Run service account..."
for secret in gemini-api-key jwt-secret secret-key admin-email admin-password; do
    gcloud secrets add-iam-policy-binding "$secret" \
        --project="$PROJECT_ID" \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet
done

# ------- Build & deploy backend -------

log "Building and deploying backend..."

BACKEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${BACKEND_SERVICE}"

docker build -t "$BACKEND_IMAGE" ./backend
docker push "$BACKEND_IMAGE"

ENV_VARS="ENVIRONMENT=production"
ENV_VARS+=",GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
ENV_VARS+=",ADMIN_FIRST_NAME=${ADMIN_FIRST_NAME_VAL}"
ENV_VARS+=",ADMIN_LAST_NAME=${ADMIN_LAST_NAME_VAL}"
if [[ -n "$FIRESTORE_DB" ]]; then
    ENV_VARS+=",FIRESTORE_DATABASE=${FIRESTORE_DB}"
fi

SECRETS="GEMINI_API_KEY=gemini-api-key:latest"
SECRETS+=",JWT_SECRET=jwt-secret:latest"
SECRETS+=",SECRET_KEY=secret-key:latest"
SECRETS+=",ADMIN_EMAIL=admin-email:latest"
SECRETS+=",ADMIN_PASSWORD=admin-password:latest"

gcloud run deploy "$BACKEND_SERVICE" \
    --image="$BACKEND_IMAGE" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --platform=managed \
    --allow-unauthenticated \
    --set-env-vars="$ENV_VARS" \
    --set-secrets="$SECRETS" \
    --memory="$BACKEND_MEMORY" \
    --cpu="$BACKEND_CPU" \
    --timeout="$BACKEND_TIMEOUT" \
    --min-instances="$BACKEND_MIN_INSTANCES" \
    --max-instances="$BACKEND_MAX_INSTANCES" \
    --port=8000

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region="$REGION" --project="$PROJECT_ID" \
    --format='value(status.url)')

log "Backend deployed at: $BACKEND_URL"

# ------- Build & deploy frontend -------

log "Building and deploying frontend..."

FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${FRONTEND_SERVICE}"

docker build \
    --build-arg "NEXT_PUBLIC_BACKEND_URL=${BACKEND_URL}" \
    -t "$FRONTEND_IMAGE" \
    ./frontend
docker push "$FRONTEND_IMAGE"

gcloud run deploy "$FRONTEND_SERVICE" \
    --image="$FRONTEND_IMAGE" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --platform=managed \
    --allow-unauthenticated \
    --set-env-vars="NEXT_PUBLIC_BACKEND_URL=${BACKEND_URL}" \
    --memory="$FRONTEND_MEMORY" \
    --cpu="$FRONTEND_CPU" \
    --timeout="$FRONTEND_TIMEOUT" \
    --min-instances="$FRONTEND_MIN_INSTANCES" \
    --max-instances="$FRONTEND_MAX_INSTANCES" \
    --port=3000

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
    --region="$REGION" --project="$PROJECT_ID" \
    --format='value(status.url)')

log "Frontend deployed at: $FRONTEND_URL"

# ------- Update backend CORS -------

log "Updating backend CORS to allow frontend origin..."
gcloud run services update "$BACKEND_SERVICE" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --update-env-vars="ALLOWED_ORIGINS=${FRONTEND_URL}"

# ------- Summary -------

echo
echo "============================================================"
echo "  Deployment Complete!"
echo "============================================================"
echo
echo "  Frontend:  $FRONTEND_URL"
echo "  Backend:   $BACKEND_URL"
echo "  API Docs:  $BACKEND_URL/docs"
echo "  Health:    $BACKEND_URL/health"
echo
echo "  Region:    $REGION"
echo "  Project:   $PROJECT_ID"
echo
echo "  Next steps:"
echo "    1. Visit $FRONTEND_URL to verify the app loads"
echo "    2. Visit $BACKEND_URL/health to check backend health"
echo "    3. Test login with your admin credentials"
echo "    4. (Optional) Map a custom domain:"
echo "       gcloud run domain-mappings create --service=$FRONTEND_SERVICE --domain=YOUR_DOMAIN --region=$REGION"
echo
echo "============================================================"
