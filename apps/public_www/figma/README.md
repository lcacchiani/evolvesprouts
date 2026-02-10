# Figma token pipeline for `public_www`

This directory stores input and output files used by the public website
token pipeline.

## Directory structure

- `files/`
  - Raw Figma API payloads produced by:
    - `npm run figma:pull`
  - Expected files:
    - `file.json`
    - `variables.local.json`
- `mdm/exports/`
  - Design-token exports produced by a Figma MDM flow.
  - Default input file:
    - `tokens.json`
- `mdm/artifacts/`
  - Normalized artifacts produced for the website build.
  - Output file:
    - `tokens.normalized.json`

## Build outputs

`npm run figma:build` writes CSS custom properties used by the site to:

- `src/app/generated/figma-tokens.css`

`src/app/globals.css` imports this generated file so token updates from
Figma flow through the website build.
