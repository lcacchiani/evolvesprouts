#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=aws-retry.sh
source "$SCRIPT_DIR/aws-retry.sh"

APP_DIR="$ROOT_DIR/apps/training"
BUILD_DIR="$APP_DIR/out"
STACK_NAME="${TRAINING_STACK_NAME:-evolvesprouts-training}"

if [ ! -d "$BUILD_DIR" ]; then
  echo "Build output not found at $BUILD_DIR"
  echo "Run: (cd apps/training && npm run build)"
  exit 1
fi

BUCKET_QUERY="Stacks[0].Outputs[?OutputKey=='TrainingBucketName']."
BUCKET_QUERY+="OutputValue"
BUCKET_NAME="$(aws_retry cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "$BUCKET_QUERY" \
  --output text)"

if [ -z "$BUCKET_NAME" ] || [ "$BUCKET_NAME" = "None" ]; then
  echo "Training bucket output not found for $STACK_NAME"
  exit 1
fi

echo "Syncing training site to s3://$BUCKET_NAME"
aws_retry_live s3 sync "$BUILD_DIR" "s3://$BUCKET_NAME" --delete

DISTRIBUTION_QUERY="Stacks[0].Outputs[?OutputKey=='TrainingDistributionId']."
DISTRIBUTION_QUERY+="OutputValue"
DISTRIBUTION_ID="$(aws_retry cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "$DISTRIBUTION_QUERY" \
  --output text)"

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
  echo "Invalidating CloudFront distribution $DISTRIBUTION_ID"
  aws_retry_live cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*"
fi
