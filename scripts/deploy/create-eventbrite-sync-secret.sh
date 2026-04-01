#!/usr/bin/env bash
set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required."
  exit 1
fi

SECRET_NAME="${EVENTBRITE_SECRET_NAME:-/evolvesprouts/eventbrite/sync-token}"
SECRET_DESCRIPTION="${EVENTBRITE_SECRET_DESCRIPTION:-Eventbrite API token for Evolve Sprouts sync processor}"
EVENTBRITE_API_TOKEN="${EVENTBRITE_API_TOKEN:-}"

TAG_ORGANIZATION="${TAG_ORGANIZATION:-Evolve Sprouts}"
TAG_PROJECT="${TAG_PROJECT:-Backend}"
TAG_SERVICE="${TAG_SERVICE:-eventbrite-sync}"
TAG_ENVIRONMENT="${TAG_ENVIRONMENT:-production}"
TAG_MANAGED_BY="${TAG_MANAGED_BY:-manual}"

if [ -z "$EVENTBRITE_API_TOKEN" ]; then
  cat <<'EOF'
Missing required environment variable: EVENTBRITE_API_TOKEN

Usage:
  EVENTBRITE_API_TOKEN='your-token' bash scripts/deploy/create-eventbrite-sync-secret.sh

Optional environment variables:
  EVENTBRITE_SECRET_NAME            (default: /evolvesprouts/eventbrite/sync-token)
  EVENTBRITE_SECRET_DESCRIPTION     (default: Eventbrite API token for Evolve Sprouts sync processor)
  TAG_ORGANIZATION                  (default: Evolve Sprouts)
  TAG_PROJECT                       (default: Backend)
  TAG_SERVICE                       (default: eventbrite-sync)
  TAG_ENVIRONMENT                   (default: production)
  TAG_MANAGED_BY                    (default: manual)
EOF
  exit 1
fi

SECRET_STRING="$(python3 - <<'PY'
import json
import os

print(json.dumps({"token": os.environ["EVENTBRITE_API_TOKEN"]}))
PY
)"

TAGS=(
  "Key=Organization,Value=${TAG_ORGANIZATION}"
  "Key=Project,Value=${TAG_PROJECT}"
  "Key=Service,Value=${TAG_SERVICE}"
  "Key=Environment,Value=${TAG_ENVIRONMENT}"
  "Key=ManagedBy,Value=${TAG_MANAGED_BY}"
)

if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
  echo "Secret exists. Updating value and tags: $SECRET_NAME"
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "$SECRET_STRING" >/dev/null

  aws secretsmanager untag-resource \
    --secret-id "$SECRET_NAME" \
    --tag-keys Organization Project Service Environment ManagedBy >/dev/null 2>&1 || true

  aws secretsmanager tag-resource \
    --secret-id "$SECRET_NAME" \
    --tags "${TAGS[@]}" >/dev/null
else
  echo "Creating secret: $SECRET_NAME"
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "$SECRET_DESCRIPTION" \
    --secret-string "$SECRET_STRING" \
    --tags "${TAGS[@]}" >/dev/null
fi

SECRET_ARN="$(aws secretsmanager describe-secret \
  --secret-id "$SECRET_NAME" \
  --query 'ARN' \
  --output text)"

echo
echo "Done."
echo "Secret ARN: $SECRET_ARN"
echo
echo "GitHub wiring:"
echo "  Secret name: CDK_PARAM_EVENTBRITE_TOKEN_SECRET_ARN"
echo "  Secret value: $SECRET_ARN"
echo "  Variable name: CDK_PARAM_EVENTBRITE_ORGANIZATION_ID"
