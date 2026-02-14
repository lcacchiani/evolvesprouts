# Evolve Sprouts

An app for searching and booking activities for children across Hong Kong and beyond.

## AI agent rules

Repository-wide AI execution rules are defined in `.cursorrules`.

To improve automatic rule loading across different agent runtimes, this
repository also includes:

- `AGENTS.md` for agent frameworks that auto-discover `AGENTS.md`
- `.cursor/rules/00_mandatory_cursorrules.mdc` for Cursor rule auto-apply
- `scripts/validate-cursorrules.sh` for CI and pre-commit enforcement

Prompt-level instruction precedence is controlled by each agent runtime and
cannot be changed from repository files alone. This repository enforces its AI
rule contract by failing automation when mandatory `.cursorrules` anchors are
removed or weakened.

## Setup

All deployment prerequisites and configuration steps are now documented in
`docs/architecture/setup.md`.
