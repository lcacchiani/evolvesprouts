# Evolve Sprouts

Supporting Hong Kong families to raise their children through positive education!

## AI agent rules

Repository-wide AI execution rules are defined in `.cursorrules`.

To improve automatic rule loading across different agent runtimes, this
repository also includes:

- `AGENTS.md` for agent frameworks that auto-discover `AGENTS.md`
- `.cursor/rules/00_mandatory_cursorrules.mdc` for Cursor rule auto-apply
  (`alwaysApply: true`), which also instructs agents to **read** repository root
  `.cursorrules` explicitly when a runtime might not inject it
- `scripts/validate-cursorrules.sh` for CI and pre-commit enforcement

Prompt-level instruction precedence is controlled by each agent runtime and
cannot be changed from repository files alone. This repository enforces its AI
rule contract by failing automation when mandatory `.cursorrules` anchors are
removed or weakened.

## Setup

All deployment prerequisites and configuration steps are now documented in
`docs/architecture/setup.md`.

### My Best Auntie instance UUIDs (local dev)

To print Aurora `service_instances.id` values for the My Best Auntie service (for copying into
`apps/public_www/src/content/my-best-auntie-training-courses.json` by hand), run:

```
ATTESTATION_FAIL_CLOSED=false python backend/scripts/dump_mba_instance_uuids.py --execute
```

Without `--execute`, the script exits without connecting (see script docstring for `DATABASE_URL` requirements).
