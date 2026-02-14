# Agent Operating Instructions

Applies to any AI coding agent that works in this repository (including web
agents).

## Mandatory bootstrap step

1. Read `@.cursorrules` before any analysis, plan, command, or code edit.
2. Treat the rules in `.cursorrules` as mandatory for the full session.
3. Re-read `.cursorrules` immediately if it changes during the task.
4. If instructions conflict, use this precedence:
   system instructions > developer instructions > user instructions >
   `.cursorrules`.

## Enforcement intent

Do not begin implementation work until `.cursorrules` has been loaded and
applied.
Do not perform implementation actions until explicit user approval is received
for the current task.
Treat all write operations as implementation actions, including file
create/edit/delete, dependency changes, migrations, generated artifacts, and
git write operations (`git add`, `git commit`, `git push`).
If implementation scope changes after approval, pause and request renewed
explicit user approval before continuing.

## Repository-enforced guardrail

The repository enforces a `.cursorrules` contract via
`scripts/validate-cursorrules.sh` (wired into pre-commit and CI lint checks).
This does not alter runtime prompt precedence, but it blocks merges when
mandatory `.cursorrules` integration anchors are removed or weakened.
