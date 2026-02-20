import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');
const PUBLIC_IMAGES_DIR = path.join(APP_ROOT, 'public', 'images');

const DEFAULT_WEBP_QUALITY = 82;

const FILE_OVERRIDES = {
  'hero/child-hero.png': { width: 900, quality: 84 },
  'family.png': { width: 1400, quality: 82 },
  'sprouts-squad-community-bg.png': { width: 1600, quality: 80 },
  'community-badge.png': { width: 320, quality: 85 },
  'footer-icon.png': { width: 320, quality: 85 },
  'testimonials/story-1-main.png': { width: 1200, quality: 82 },
  'testimonials/story-2-main.png': { width: 1200, quality: 82 },
  'testimonials/story-3-main.png': { width: 1200, quality: 82 },
  'testimonials/story-4-main.png': { width: 1200, quality: 82 },
  'testimonials/story-6-main.png': { width: 1200, quality: 82 },
  'testimonials/story-7-main.png': { width: 1200, quality: 82 },
  'testimonials/story-8-main.png': { width: 1200, quality: 82 },
  'testimonials/story-1-avatar.png': { width: 240, quality: 85 },
  'testimonials/story-2-avatar.png': { width: 240, quality: 85 },
  'testimonials/story-3-avatar.png': { width: 240, quality: 85 },
  'testimonials/story-4-avatar.png': { width: 240, quality: 85 },
};

async function collectPngFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectPngFiles(filePath);
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) {
        return [];
      }

      return [filePath];
    }),
  );

  return nestedFiles.flat();
}

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function optimizeFile(inputPath) {
  const relativePath = path
    .relative(PUBLIC_IMAGES_DIR, inputPath)
    .replaceAll('\\', '/');
  const override = FILE_OVERRIDES[relativePath] ?? {};
  const outputPath = inputPath.replace(/\.png$/i, '.webp');

  const sourceStats = await stat(inputPath);
  let pipeline = sharp(inputPath);
  if (override.width) {
    pipeline = pipeline.resize({
      width: override.width,
      withoutEnlargement: true,
    });
  }

  await pipeline
    .webp({
      quality: override.quality ?? DEFAULT_WEBP_QUALITY,
      effort: 6,
    })
    .toFile(outputPath);

  const outputStats = await stat(outputPath);
  const deltaBytes = sourceStats.size - outputStats.size;
  const percentSaved =
    sourceStats.size === 0
      ? '0.0'
      : ((deltaBytes / sourceStats.size) * 100).toFixed(1);

  return {
    relativePath,
    sourceSize: sourceStats.size,
    outputSize: outputStats.size,
    percentSaved,
  };
}

async function main() {
  const pngFiles = await collectPngFiles(PUBLIC_IMAGES_DIR);
  if (pngFiles.length === 0) {
    console.log('No PNG files found under public/images.');
    return;
  }

  const results = [];
  for (const inputPath of pngFiles) {
    // Process sequentially to keep memory bounded in CI.
    // This script runs infrequently as part of asset maintenance.
    const result = await optimizeFile(inputPath);
    results.push(result);
  }

  const totalSourceBytes = results.reduce(
    (sum, result) => sum + result.sourceSize,
    0,
  );
  const totalOutputBytes = results.reduce(
    (sum, result) => sum + result.outputSize,
    0,
  );
  const totalSavedBytes = totalSourceBytes - totalOutputBytes;
  const totalSavedPct =
    totalSourceBytes === 0
      ? '0.0'
      : ((totalSavedBytes / totalSourceBytes) * 100).toFixed(1);

  for (const result of results) {
    console.log(
      `${result.relativePath} -> ${result.relativePath.replace(/\.png$/i, '.webp')} (${formatKilobytes(result.sourceSize)} -> ${formatKilobytes(result.outputSize)}, ${result.percentSaved}% saved)`,
    );
  }

  console.log('');
  console.log(`Optimized ${results.length} image(s).`);
  console.log(
    `Total: ${formatKilobytes(totalSourceBytes)} -> ${formatKilobytes(totalOutputBytes)} (${totalSavedPct}% saved)`,
  );
}

main().catch((error) => {
  console.error('Image optimization failed.');
  console.error(error);
  process.exit(1);
});
