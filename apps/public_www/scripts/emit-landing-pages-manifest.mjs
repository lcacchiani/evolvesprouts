import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const landingPagesDir = join(__dirname, '../src/content/landing-pages');
const outDir = join(__dirname, '../out');
const manifestPath = join(outDir, 'landing-pages-manifest.json');

const jsonFiles = readdirSync(landingPagesDir).filter((name) => name.endsWith('.json'));
const slugs = jsonFiles.map((name) => basename(name, '.json'));

mkdirSync(outDir, { recursive: true });
writeFileSync(
  manifestPath,
  `${JSON.stringify({ slugs }, null, 2)}\n`,
  'utf8',
);

for (const slug of slugs) {
  const raw = readFileSync(join(landingPagesDir, `${slug}.json`), 'utf8');
  JSON.parse(raw);
}

console.log(`Wrote ${manifestPath} (${slugs.length} slug(s)).`);
