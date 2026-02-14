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
