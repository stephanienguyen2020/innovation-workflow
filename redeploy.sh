#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Quick Redeploy - Cloud Build (reuses existing secrets)
# ============================================================

PROJECT_ID="innovation-workflow"
REGION="us-central1"
AR_REPO="innovation-workflow"
BACKEND_SERVICE="innovation-backend"
FRONTEND_SERVICE="innovation-frontend"

log() { echo -e "\n\033[1;34m==>\033[0m \033[1m$*\033[0m"; }

# Parse args: default to deploying both
DEPLOY_BE=false
DEPLOY_FE=false
for arg in "$@"; do
    case "$arg" in
        backend|be)  DEPLOY_BE=true ;;
        frontend|fe) DEPLOY_FE=true ;;
        *)           echo "Usage: $0 [backend|be] [frontend|fe]  (no args = both)"; exit 1 ;;
    esac
done
if ! $DEPLOY_BE && ! $DEPLOY_FE; then
    DEPLOY_BE=true
    DEPLOY_FE=true
fi

IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"

# ------- Backend -------
if $DEPLOY_BE; then
    log "Building backend with Cloud Build..."
    BACKEND_IMAGE="${IMAGE_BASE}/${BACKEND_SERVICE}"
    gcloud builds submit ./backend \
        --tag="$BACKEND_IMAGE" \
        --project="$PROJECT_ID" \
        --quiet

    log "Deploying backend to Cloud Run..."
    gcloud run deploy "$BACKEND_SERVICE" \
        --image="$BACKEND_IMAGE" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --platform=managed \
        --quiet

    BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
        --region="$REGION" --project="$PROJECT_ID" \
        --format='value(status.url)')
    log "Backend live at: $BACKEND_URL"
fi

# ------- Frontend -------
if $DEPLOY_FE; then
    # Get backend URL for the build arg
    BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
        --region="$REGION" --project="$PROJECT_ID" \
        --format='value(status.url)')

    log "Building frontend with Cloud Build..."
    FRONTEND_IMAGE="${IMAGE_BASE}/${FRONTEND_SERVICE}"
    gcloud builds submit ./frontend \
        --config=/dev/stdin \
        --project="$PROJECT_ID" \
        --substitutions="_IMAGE=${FRONTEND_IMAGE},_BACKEND_URL=${BACKEND_URL}" \
        --quiet <<'CLOUDBUILD'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_BACKEND_URL=${_BACKEND_URL}'
      - '-t'
      - '${_IMAGE}'
      - '.'
images:
  - '${_IMAGE}'
CLOUDBUILD

    log "Deploying frontend to Cloud Run..."
    gcloud run deploy "$FRONTEND_SERVICE" \
        --image="$FRONTEND_IMAGE" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --platform=managed \
        --quiet

    FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
        --region="$REGION" --project="$PROJECT_ID" \
        --format='value(status.url)')
    log "Frontend live at: $FRONTEND_URL"
fi

log "Redeploy complete!"
