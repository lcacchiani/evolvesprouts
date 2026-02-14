#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  local message="$1"
  echo "::error title=.cursorrules compliance::${message}"
  exit 1
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "Missing required file: ${path}"
}

require_literal() {
  local path="$1"
  local literal="$2"
  local message="$3"
  if ! rg --fixed-strings --quiet -- "$literal" "$path"; then
    fail "${message} (file: ${path})"
  fi
}

require_file ".cursorrules"
require_file "AGENTS.md"
require_file ".cursor/rules/00_mandatory_cursorrules.mdc"

# Keep checks focused on stable, high-value compliance anchors.
require_literal ".cursorrules" "## Scope and applicability (MANDATORY)" "Missing mandatory scope section"
require_literal ".cursorrules" "## Workflow (MANDATORY)" "Missing mandatory workflow section"
require_literal ".cursorrules" "Wait for explicit user approval." "Missing explicit user approval guardrail"
require_literal ".cursorrules" "## Documentation freshness (MANDATORY after code changes)" "Missing documentation freshness section"

require_literal "AGENTS.md" "Read `@.cursorrules` before any analysis, plan, command, or code edit." "Missing AGENTS bootstrap requirement"
require_literal "AGENTS.md" "Treat the rules in `.cursorrules` as mandatory for the full session." "Missing AGENTS mandatory-application requirement"

require_literal ".cursor/rules/00_mandatory_cursorrules.mdc" "alwaysApply: true" "Cursor always-apply flag is not present"
require_literal ".cursor/rules/00_mandatory_cursorrules.mdc" "Do not continue with implementation if `@.cursorrules` has not been applied." "Missing Cursor hard-stop requirement"

echo ".cursorrules compliance checks passed."
