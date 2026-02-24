# Admin Web (SPA Shell)

`admin_web` is a minimal single-page shell for Evolve Sprouts.

## Development

```bash
npm install
npm run dev
```

## ESLint 10 compatibility

This app currently keeps a temporary ESLint 10 compatibility shim because the
Next.js lint dependency graph still includes plugins that are not fully
ESLint-10-native.

- `eslint.config.js` wraps `eslint-config-next` via `@eslint/compat`
  `fixupConfigRules(...)`.
- `eslint.config.js` uses `espree` for JS-family files to avoid parser/runtime
  mismatches while linting config files.
- `package.json` overrides `typescript-eslint` to `8.55.1-alpha.4` to pick up
  ESLint 10 support in the parser/scope-manager stack.

When upstream `eslint-config-next` dependencies ship stable ESLint 10 support,
remove the compatibility shim and the override.

## Build

```bash
npm run build
```

The static output is generated in `out/`.
