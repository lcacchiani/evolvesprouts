# Public WWW

`public_www` is the public-facing web app for Evolve Sprouts.

## Core commands

- `npm run dev` — run local development server.
- `npm run validate:content` — validate locale content contract.
- `npm run lint` — run ESLint.
- `npm run test` — run unit tests (Vitest + Testing Library).
- `npm run audit:assets` — detect missing/unused static assets.
- `npm run images:optimize` — generate optimized `.webp` images from
  `public/images/**/*.png`.
- `npm run build` — validate content, build Figma CSS tokens, and build the app.
- `npm run lighthouse:ci` — run Lighthouse CI against the static export.

## Component and test folder conventions

Use this structure for all new `public_www` UI code:

- `src/components/pages/**` for page-composition components.
- `src/components/shared/**` for reusable primitives and layout helpers.
- `src/components/sections/**` for section components.
- `src/components/sections/shared/**` for section-only shared helpers.

Place all test files under `tests/**` (not under `src/**`), with mirrored
domains for navigation:

- `tests/components/**`
- `tests/lib/**`
- `tests/content/**`

## Figma token scaffolding

The app can consume design tokens from Figma:

- `npm run figma:pull` pulls Figma file metadata and local variables into
  `figma/files/` using OAuth 2.0 credentials.
- `npm run figma:build:studio` builds normalized token artifacts and generates
  CSS variables consumed by the app.
- `npm run figma:studio-sync` runs pull + tokenize + build in sequence.
- `npm run figma:full-sync` runs studio sync, scaffolding, and design spec
  extraction.

Directory layout:

- `figma/files/`: raw Figma API payloads
- `figma/mdm/artifacts/`: normalized artifacts generated for the website
- `src/app/generated/figma-tokens.css`: generated token CSS consumed by pages

To run `figma:pull`, set `FIGMA_FILE_KEY` and either:

- `FIGMA_OAUTH_ACCESS_TOKEN`, or
- `FIGMA_OAUTH_CLIENT_ID`, `FIGMA_OAUTH_CLIENT_SECRET`, and
  `FIGMA_OAUTH_REFRESH_TOKEN`.

## Development

```bash
npm install
npm run validate:content
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

To enable public website CRM API calls (including My Best Auntie discount code lookup), set:

- `NEXT_PUBLIC_WWW_CRM_API_BASE_URL`
- `NEXT_PUBLIC_WWW_CRM_API_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Use `NEXT_PUBLIC_WWW_CRM_API_BASE_URL=/www` to route requests through the
same-origin CloudFront API proxy and avoid cross-origin CORS preflight issues.
Use Cloudflare Turnstile test key `1x00000000000000000000AA` for local-only
testing.

## Build

```bash
npm run build
```

The static output is generated in `out/`.

## Routing + SEO

- Canonical English lives at `/en/`.
- Root `/` and legacy non-localized routes (for example `/about-us`) redirect
  to localized `/en/...` paths.
- `sitemap.xml` and `robots.txt` are generated at build time.

## Crawl policy

- Production is indexable.
- Staging is non-indexable via CloudFront `X-Robots-Tag` headers and a deploy
  step that applies a deny-all `robots.txt`.
