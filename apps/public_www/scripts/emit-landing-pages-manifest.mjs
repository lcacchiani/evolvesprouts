/**
 * Runs after `next build`. Writes manifest before `csp:inject` / `csp:validate` (see package.json
 * `build` script) so CSP steps still operate on the same `out/` tree as today.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const landingPagesModulePath = join(__dirname, '../src/lib/landing-pages.ts');
const outDir = join(__dirname, '../out');
const nextDir = join(__dirname, '../.next');
const manifestFileName = 'landing-pages-manifest.json';
const outManifestPath = join(outDir, manifestFileName);
const nextManifestPath = join(nextDir, manifestFileName);

const source = readFileSync(landingPagesModulePath, 'utf8');
const landingPagesMatch = source.match(
  /const\s+LANDING_PAGES\s*=\s*\{([\s\S]*?)\}\s*satisfies/,
);
if (!landingPagesMatch) {
  console.error(
    'Could not parse LANDING_PAGES from src/lib/landing-pages.ts; update emit-landing-pages-manifest.mjs.',
  );
  process.exit(1);
}

const slugs = [...landingPagesMatch[1].matchAll(/^\s*'([^']+)'\s*:/gm)].map((entry) => entry[1]);

if (slugs.length === 0) {
  console.error('Parsed zero landing page slugs from landing-pages.ts.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(nextDir, { recursive: true });
const json = `${JSON.stringify({ slugs }, null, 2)}\n`;
writeFileSync(outManifestPath, json, 'utf8');
writeFileSync(nextManifestPath, json, 'utf8');

console.log(`Wrote ${outManifestPath} and ${nextManifestPath} (${slugs.length} slug(s)) from landing-pages.ts.`);
