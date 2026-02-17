import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..', 'src');
const ALLOWED_EXTENSIONS = new Set(['.css', '.ts', '.tsx']);

const EXPECTED_TOKEN_FALLBACKS = {
  '--es-color-brand-orange': '#C84A16',
  '--es-color-brand-orange-soft': '#F2A975',
  '--es-color-brand-orange-strong': '#ED622E',
  '--es-color-booking-highlight-icon': '#B42318',
  '--es-color-border-date': '#CAD6E5',
  '--es-color-text-heading': '#333333',
  '--es-color-text-icon': '#3D3E3D',
  '--es-color-text-neutral-strong': '#5A5A5A',
};

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(absolutePath)));
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(extension)) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function main() {
  const sourceFiles = await collectSourceFiles(SRC_DIR);
  const errors = [];

  for (const filePath of sourceFiles) {
    const fileContent = await readFile(filePath, 'utf8');

    for (const [tokenName, expectedHex] of Object.entries(
      EXPECTED_TOKEN_FALLBACKS,
    )) {
      const fallbackPattern = new RegExp(
        `var\\(${escapeForRegex(tokenName)}\\s*,\\s*(#[0-9A-Fa-f]{3,8})\\)`,
        'g',
      );

      let match = fallbackPattern.exec(fileContent);
      while (match) {
        const fallbackHex = (match[1] ?? '').toUpperCase();
        const normalizedExpectedHex = expectedHex.toUpperCase();

        if (fallbackHex !== normalizedExpectedHex) {
          const lineNumber = getLineNumber(fileContent, match.index);
          errors.push(
            `${path.relative(SRC_DIR, filePath)}:${lineNumber} ${tokenName} fallback is ${fallbackHex}, expected ${normalizedExpectedHex}`,
          );
        }

        match = fallbackPattern.exec(fileContent);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Token fallback validation failed.');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Token fallback validation passed.');
}

main().catch((error) => {
  console.error('Token fallback validation crashed.');
  console.error(error);
  process.exit(1);
});
