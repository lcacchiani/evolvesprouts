# Public WWW

`public_www` is the public-facing web app for Evolve Sprouts.

## Figma token scaffolding

The app can consume design tokens from Figma:

- `npm run figma:pull` pulls Figma file metadata and local variables into
  `figma/files/`.
- `npm run figma:build` builds normalized token artifacts and generates CSS
  variables consumed by the app.
- `npm run figma:sync` runs both commands in sequence.

Directory layout:

- `figma/files/`: raw Figma API payloads
- `figma/mdm/exports/`: files exported by Figma MDM flow
- `figma/mdm/artifacts/`: normalized artifacts generated for the website

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
