# Public WWW

`public_www` is the public-facing web app for Evolve Sprouts.

## Figma token scaffolding

The app can consume design tokens from Figma:

- `npm run figma:pull` pulls Figma file metadata and local variables into
  `figma/files/` using OAuth 2.0 credentials.
- `npm run figma:build` builds normalized token artifacts and generates CSS
  variables consumed by the app.
- `npm run figma:sync` runs both commands in sequence.

Directory layout:

- `figma/files/`: raw Figma API payloads
- `figma/mdm/exports/`: files exported by Figma MDM flow
- `figma/mdm/artifacts/`: normalized artifacts generated for the website

To run `figma:pull`, set `FIGMA_FILE_KEY` and either:

- `FIGMA_OAUTH_ACCESS_TOKEN`, or
- `FIGMA_OAUTH_CLIENT_ID`, `FIGMA_OAUTH_CLIENT_SECRET`, and
  `FIGMA_OAUTH_REFRESH_TOKEN`.

## Development

```bash
npm install
npm run figma:build
npm run dev
```

## Build

```bash
npm run build
```

The static output is generated in `out/`.
