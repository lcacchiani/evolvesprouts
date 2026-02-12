#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$ROOT_DIR/apps/public_www"
BUILD_DIR="$APP_DIR/out"
STACK_NAME="${PUBLIC_WWW_STACK_NAME:-evolvesprouts-public-www}"
SOURCE_STACK_NAME="${PUBLIC_WWW_SOURCE_STACK_NAME:-$STACK_NAME}"
DEPLOY_ENVIRONMENT="${PUBLIC_WWW_ENVIRONMENT:-production}"
RELEASE_ID="${PUBLIC_WWW_RELEASE_ID:-}"
PROMOTE_RELEASE_ID="${PUBLIC_WWW_PROMOTE_RELEASE_ID:-}"
ASSET_CACHE_CONTROL="public, max-age=31536000, immutable"
DOCUMENT_CACHE_CONTROL="public, max-age=300, must-revalidate"
NO_STORE_CACHE_CONTROL="no-store, max-age=0"

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

function get_environment_outputs() {
  local environment_name="$1"
  if [ "$environment_name" = "production" ]; then
    echo "PublicWwwBucketName PublicWwwDistributionId"
    return
  fi
  if [ "$environment_name" = "staging" ]; then
    echo "PublicWwwStagingBucketName PublicWwwStagingDistributionId"
    return
  fi

  echo "Unsupported PUBLIC_WWW_ENVIRONMENT: '$environment_name'"
  echo "Allowed values: production, staging"
  exit 1
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
    local -a invalidation_paths=(
      "/"
      "/index.html"
      "/404.html"
      "/404/index.html"
      "/_not-found/index.html"
      "/en*"
      "/zh-CN*"
      "/zh-HK*"
      "/about-us*"
      "/about*"
      "/book*"
      "/contact-us*"
      "/contact*"
      "/events*"
      "/newsletter*"
      "/privacy*"
      "/resources*"
      "/services*"
      "/training-courses*"
      "/robots.txt"
      "/sitemap.xml"
    )
    local max_attempts=5
    local retry_delay_seconds=20
    local attempt=1

    echo "Invalidating CloudFront distribution $distribution_id"
    while [ "$attempt" -le "$max_attempts" ]; do
      local invalidation_output
      invalidation_output="$(mktemp)"
      if aws cloudfront create-invalidation \
        --distribution-id "$distribution_id" \
        --paths "${invalidation_paths[@]}" \
        >"$invalidation_output" 2>&1; then
        cat "$invalidation_output"
        rm -f "$invalidation_output"
        return
      fi

      local invalidation_error
      invalidation_error="$(<"$invalidation_output")"
      rm -f "$invalidation_output"

      if [[ "$invalidation_error" == *"TooManyInvalidationsInProgress"* ]] && \
        [ "$attempt" -lt "$max_attempts" ]; then
        echo "CloudFront invalidation queue is full (attempt $attempt/$max_attempts)."
        echo "Retrying in ${retry_delay_seconds}s..."
        sleep "$retry_delay_seconds"
        attempt=$((attempt + 1))
        continue
      fi

      echo "$invalidation_error"
      return 1
    done

    echo "CloudFront invalidation failed after $max_attempts attempts."
    return 1
  fi
}

function optimize_images_for_deploy() {
  local optimize_flag="${PUBLIC_WWW_OPTIMIZE_IMAGES:-true}"
  if [ "$optimize_flag" != "true" ]; then
    echo "Skipping image optimization (PUBLIC_WWW_OPTIMIZE_IMAGES=$optimize_flag)"
    return
  fi

  if [ ! -f "$APP_DIR/package.json" ]; then
    echo "Skipping image optimization (package.json not found at $APP_DIR)"
    return
  fi

  echo "Optimizing images before deployment sync"
  (
    cd "$APP_DIR"
    npm run images:optimize
  )

  if [ -d "$APP_DIR/public" ]; then
    echo "Refreshing exported static assets from public/"
    cp -a "$APP_DIR/public/." "$BUILD_DIR/"
  fi
}

function sync_site_artifacts() {
  local source_dir="$1"
  local destination_uri="$2"

  if [ -d "$source_dir/_next/static" ]; then
    aws s3 sync \
      "$source_dir/_next/static" \
      "$destination_uri/_next/static" \
      --cache-control "$ASSET_CACHE_CONTROL"
  fi

  aws s3 sync \
    "$source_dir" \
    "$destination_uri" \
    --exclude "_next/static/*" \
    --exclude "releases/*" \
    --cache-control "$DOCUMENT_CACHE_CONTROL" \
    --delete
}

function sync_release_artifacts() {
  local source_uri="$1"
  local destination_uri="$2"

  if aws s3 ls "$source_uri/_next/static/" >/dev/null 2>&1; then
    aws s3 sync \
      "$source_uri/_next/static" \
      "$destination_uri/_next/static" \
      --cache-control "$ASSET_CACHE_CONTROL"
  fi

  aws s3 sync \
    "$source_uri" \
    "$destination_uri" \
    --exclude "_next/static/*" \
    --exclude "releases/*" \
    --cache-control "$DOCUMENT_CACHE_CONTROL" \
    --delete
}

function enforce_staging_robots_txt() {
  local bucket_name="$1"
  local robots_file

  robots_file="$(mktemp)"
  cat > "$robots_file" <<EOF
User-agent: *
Disallow: /
EOF

  aws s3 cp \
    "$robots_file" \
    "s3://$bucket_name/robots.txt" \
    --content-type "text/plain; charset=utf-8" \
    --cache-control "$NO_STORE_CACHE_CONTROL"

  rm -f "$robots_file"
}

if [ -n "$PROMOTE_RELEASE_ID" ]; then
  validate_release_id "$PROMOTE_RELEASE_ID"

  SOURCE_BUCKET_NAME="$(require_stack_output \
    "$SOURCE_STACK_NAME" \
    "PublicWwwStagingBucketName")"
  TARGET_BUCKET_NAME="$(require_stack_output \
    "$STACK_NAME" \
    "PublicWwwBucketName")"
  TARGET_DISTRIBUTION_ID="$(require_stack_output \
    "$STACK_NAME" \
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
  sync_release_artifacts \
    "s3://$SOURCE_BUCKET_NAME/releases/$PROMOTE_RELEASE_ID" \
    "s3://$TARGET_BUCKET_NAME"

  invalidate_distribution "$TARGET_DISTRIBUTION_ID"
  exit 0
fi

if [ ! -d "$BUILD_DIR" ]; then
  echo "Build output not found at $BUILD_DIR"
  echo "Run: (cd apps/public_www && npm run build)"
  exit 1
fi

optimize_images_for_deploy

read -r TARGET_BUCKET_OUTPUT_KEY TARGET_DISTRIBUTION_OUTPUT_KEY <<< "$(get_environment_outputs "$DEPLOY_ENVIRONMENT")"
TARGET_BUCKET_NAME="$(require_stack_output \
  "$STACK_NAME" \
  "$TARGET_BUCKET_OUTPUT_KEY")"
TARGET_DISTRIBUTION_ID="$(require_stack_output \
  "$STACK_NAME" \
  "$TARGET_DISTRIBUTION_OUTPUT_KEY")"

echo "Syncing Public WWW to s3://$TARGET_BUCKET_NAME"
sync_site_artifacts "$BUILD_DIR" "s3://$TARGET_BUCKET_NAME"

if [ -n "$RELEASE_ID" ]; then
  validate_release_id "$RELEASE_ID"
  echo "Saving immutable release at releases/$RELEASE_ID/"
  sync_site_artifacts "$BUILD_DIR" "s3://$TARGET_BUCKET_NAME/releases/$RELEASE_ID"

  if [ "$DEPLOY_ENVIRONMENT" = "staging" ]; then
    echo "Updating staging latest release marker: $RELEASE_ID"
    MARKER_FILE="$(mktemp)"
    printf "%s\n" "$RELEASE_ID" > "$MARKER_FILE"
    aws s3 cp \
      "$MARKER_FILE" \
      "s3://$TARGET_BUCKET_NAME/releases/latest-release-id.txt"
    rm -f "$MARKER_FILE"
  fi
fi

if [ "$DEPLOY_ENVIRONMENT" = "staging" ]; then
  echo "Applying staging robots.txt deny-all policy"
  enforce_staging_robots_txt "$TARGET_BUCKET_NAME"
fi

invalidate_distribution "$TARGET_DISTRIBUTION_ID"
