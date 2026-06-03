#!/usr/bin/env bash
# Shared AWS CLI retry helpers for static-site deploy scripts.
# Source from deploy-*.sh; do not execute directly.

: "${AWS_DEPLOY_MAX_ATTEMPTS:=5}"
: "${AWS_DEPLOY_RETRY_DELAY_SECONDS:=15}"
: "${AWS_CLI_CONNECT_TIMEOUT:=60}"
: "${AWS_CLI_READ_TIMEOUT:=120}"

# Global options applied to every aws invocation in deploy scripts.
AWS_CLI_ARGS=(
  --cli-connect-timeout "$AWS_CLI_CONNECT_TIMEOUT"
  --cli-read-timeout "$AWS_CLI_READ_TIMEOUT"
)
if [ -n "${AWS_REGION:-}" ]; then
  AWS_CLI_ARGS+=(--region "$AWS_REGION")
fi

is_aws_retryable_error() {
  local message="$1"
  case "$message" in
    *"Connect timeout"*|*"connect timeout"*|*"Connection timed out"*|*"Unable to connect"*|*"Could not connect"*|*"timed out"*|*"Throttling"*|*"Rate exceeded"*|*"TooManyRequests"*|*"ServiceUnavailable"*|*"InternalError"*|*"RequestTimeout"*|*"endpoint URL"*)
      return 0
      ;;
  esac
  return 1
}

# Run aws … and return captured stdout (for --output text / json queries).
aws_retry() {
  local max_attempts="$AWS_DEPLOY_MAX_ATTEMPTS"
  local retry_delay="$AWS_DEPLOY_RETRY_DELAY_SECONDS"
  local attempt=1
  local combined_file

  combined_file="$(mktemp)"
  while [ "$attempt" -le "$max_attempts" ]; do
    if aws "${AWS_CLI_ARGS[@]}" "$@" >"$combined_file" 2>&1; then
      cat "$combined_file"
      rm -f "$combined_file"
      return 0
    fi

    local combined
    combined="$(<"$combined_file")"
    if [ "$attempt" -ge "$max_attempts" ] || ! is_aws_retryable_error "$combined"; then
      echo "$combined" >&2
      rm -f "$combined_file"
      return 1
    fi

    echo "AWS CLI failed (attempt ${attempt}/${max_attempts}); retrying in ${retry_delay}s..." >&2
    echo "$combined" >&2
    rm -f "$combined_file"
    sleep "$retry_delay"
    attempt=$((attempt + 1))
    combined_file="$(mktemp)"
  done

  rm -f "$combined_file"
  return 1
}

# Run aws … with live stdout/stderr (for s3 sync and similar).
aws_retry_live() {
  local max_attempts="$AWS_DEPLOY_MAX_ATTEMPTS"
  local retry_delay="$AWS_DEPLOY_RETRY_DELAY_SECONDS"
  local attempt=1
  local err_file

  err_file="$(mktemp)"
  while [ "$attempt" -le "$max_attempts" ]; do
    if aws "${AWS_CLI_ARGS[@]}" "$@" 2>"$err_file"; then
      rm -f "$err_file"
      return 0
    fi

    local err
    err="$(<"$err_file")"
    if [ -n "$err" ]; then
      echo "$err" >&2
    fi
    if [ "$attempt" -ge "$max_attempts" ] || ! is_aws_retryable_error "$err"; then
      rm -f "$err_file"
      return 1
    fi

    echo "AWS CLI failed (attempt ${attempt}/${max_attempts}); retrying in ${retry_delay}s..." >&2
    rm -f "$err_file"
    sleep "$retry_delay"
    attempt=$((attempt + 1))
    err_file="$(mktemp)"
  done

  rm -f "$err_file"
  return 1
}
