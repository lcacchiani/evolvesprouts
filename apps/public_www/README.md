# Public WWW

`public_www` is the public-facing web app for Evolve Sprouts.

## Core commands

- `npm run dev` — run local development server.
- `npm run validate:content` — validate locale content contract.
- `npm run lint` — run ESLint.
- `npm run audit:assets` — detect missing/unused static assets.
- `npm run images:optimize` — generate optimized `.webp` images from
  `public/images/**/*.png`.
- `npm run build` — validate content, build Figma CSS tokens, and build the app.
- `npm run lighthouse:ci` — run Lighthouse CI against the static export.

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
