import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
]);

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
]);

const ASSET_REFERENCE_PATTERN =
  /['"`](\/[^'"`]+\.(?:png|jpg|jpeg|gif|webp|svg|ico))['"`]/g;
const UNUSED_IMAGE_ALLOWLIST = new Set();

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const srcRoot = join(projectRoot, 'src');
const publicRoot = join(projectRoot, 'public');

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(filePath);
      }

      return [filePath];
    }),
  );

  return files.flat();
}

function toPublicPath(filePath) {
  return `/${relative(publicRoot, filePath).replaceAll('\\', '/')}`;
}

function isImageFile(publicPath) {
  const extension = extname(publicPath).toLowerCase();
  return IMAGE_EXTENSIONS.has(extension);
}

function printList(title, values) {
  if (values.length === 0) {
    return;
  }

  console.error(`${title}:`);
  for (const value of values) {
    console.error(`  - ${value}`);
  }
}

async function collectReferencedAssets() {
  const sourceFiles = await collectFiles(srcRoot);
  const references = new Set();

  for (const filePath of sourceFiles) {
    const extension = extname(filePath).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(extension)) {
      continue;
    }

    const content = await readFile(filePath, 'utf8');
    for (const match of content.matchAll(ASSET_REFERENCE_PATTERN)) {
      references.add(match[1]);
    }
  }

  return references;
}

async function collectPublicAssets() {
  const publicFiles = await collectFiles(publicRoot);
  return new Set(publicFiles.map((filePath) => toPublicPath(filePath)));
}

async function main() {
  const [referencedAssets, existingAssets] = await Promise.all([
    collectReferencedAssets(),
    collectPublicAssets(),
  ]);

  const missingAssets = Array.from(referencedAssets).filter(
    (assetPath) => !existingAssets.has(assetPath),
  );

  const unusedImages = Array.from(existingAssets).filter((assetPath) => {
    if (!assetPath.startsWith('/images/')) {
      return false;
    }

    if (!isImageFile(assetPath)) {
      return false;
    }

    if (UNUSED_IMAGE_ALLOWLIST.has(assetPath)) {
      return false;
    }

    return !referencedAssets.has(assetPath);
  });

  missingAssets.sort();
  unusedImages.sort();

  if (missingAssets.length > 0 || unusedImages.length > 0) {
    console.error('Asset audit failed.');
    printList('Missing referenced assets', missingAssets);
    printList('Unused image assets in /public/images', unusedImages);
    process.exit(1);
  }

  console.log('Asset audit passed.');
  console.log(`Referenced assets: ${referencedAssets.size}`);
  console.log(`Public assets: ${existingAssets.size}`);
}

main().catch((error) => {
  console.error('Asset audit crashed.');
  console.error(error);
  process.exit(1);
});
