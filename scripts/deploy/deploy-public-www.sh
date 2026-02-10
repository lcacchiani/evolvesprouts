#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$ROOT_DIR/apps/public_www"
BUILD_DIR="$APP_DIR/out"
TARGET_STACK_NAME="${PUBLIC_WWW_STACK_NAME:-evolvesprouts-public-www}"
SOURCE_STACK_NAME="${PUBLIC_WWW_SOURCE_STACK_NAME:-evolvesprouts-public-www-staging}"
RELEASE_ID="${PUBLIC_WWW_RELEASE_ID:-}"
PROMOTE_RELEASE_ID="${PUBLIC_WWW_PROMOTE_RELEASE_ID:-}"

function require_stack_output() {
  local stack_name="$1"
  local output_key="$2"
  local query value

  query="Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue"
  value="$(aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "$query" \
    --output text)"

  if [ -z "$value" ] || [ "$value" = "None" ]; then
    echo "Output '$output_key' not found for stack '$stack_name'"
    exit 1
  fi

  echo "$value"
}

function validate_release_id() {
  local release_id="$1"
  if [[ ! "$release_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
    echo "Invalid release ID: '$release_id'"
    echo "Allowed: letters, numbers, dot, dash, underscore (max 128 chars)."
    exit 1
  fi
}

function invalidate_distribution() {
  local distribution_id="$1"
  if [ -n "$distribution_id" ] && [ "$distribution_id" != "None" ]; then
    echo "Invalidating CloudFront distribution $distribution_id"
    aws cloudfront create-invalidation \
      --distribution-id "$distribution_id" \
      --paths "/*"
  fi
}

if [ -n "$PROMOTE_RELEASE_ID" ]; then
  validate_release_id "$PROMOTE_RELEASE_ID"

  SOURCE_BUCKET_NAME="$(require_stack_output \
    "$SOURCE_STACK_NAME" \
    "PublicWwwBucketName")"
  TARGET_BUCKET_NAME="$(require_stack_output \
    "$TARGET_STACK_NAME" \
    "PublicWwwBucketName")"
  TARGET_DISTRIBUTION_ID="$(require_stack_output \
    "$TARGET_STACK_NAME" \
    "PublicWwwDistributionId")"

  KEY_COUNT="$(aws s3api list-objects-v2 \
    --bucket "$SOURCE_BUCKET_NAME" \
    --prefix "releases/$PROMOTE_RELEASE_ID/" \
    --max-keys 1 \
    --query "KeyCount" \
    --output text)"

  if [ "$KEY_COUNT" = "0" ]; then
    echo "Release '$PROMOTE_RELEASE_ID' not found in source stack"
    echo "Expected prefix: s3://$SOURCE_BUCKET_NAME/releases/$PROMOTE_RELEASE_ID/"
    exit 1
  fi

  echo "Promoting release '$PROMOTE_RELEASE_ID' from staging to production"
  aws s3 sync \
    "s3://$SOURCE_BUCKET_NAME/releases/$PROMOTE_RELEASE_ID/" \
    "s3://$TARGET_BUCKET_NAME" \
    --exclude "releases/*" \
    --delete

  invalidate_distribution "$TARGET_DISTRIBUTION_ID"
  exit 0
fi

if [ ! -d "$BUILD_DIR" ]; then
  echo "Build output not found at $BUILD_DIR"
  echo "Run: (cd apps/public_www && npm run build)"
  exit 1
fi

TARGET_BUCKET_NAME="$(require_stack_output \
  "$TARGET_STACK_NAME" \
  "PublicWwwBucketName")"
TARGET_DISTRIBUTION_ID="$(require_stack_output \
  "$TARGET_STACK_NAME" \
  "PublicWwwDistributionId")"

echo "Syncing Public WWW to s3://$TARGET_BUCKET_NAME"
aws s3 sync \
  "$BUILD_DIR" \
  "s3://$TARGET_BUCKET_NAME" \
  --exclude "releases/*" \
  --delete

if [ -n "$RELEASE_ID" ]; then
  validate_release_id "$RELEASE_ID"
  echo "Saving immutable release at releases/$RELEASE_ID/"
  aws s3 sync \
    "$BUILD_DIR" \
    "s3://$TARGET_BUCKET_NAME/releases/$RELEASE_ID/" \
    --delete
fi

invalidate_distribution "$TARGET_DISTRIBUTION_ID"
