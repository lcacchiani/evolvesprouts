import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { JSDOM } from 'jsdom';

const BUILD_OUTPUT_DIRECTORY = resolve('out');
const CSP_META_REGEX =
  /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i;
const SHA256_SOURCE_REGEX = /'sha256-([^']+)'/g;

function toSha256Hash(value) {
  return createHash('sha256').update(value, 'utf8').digest('base64');
}

async function collectHtmlFiles(directoryPath) {
  const htmlFiles = [];
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      htmlFiles.push(...(await collectHtmlFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(entryPath);
    }
  }

  return htmlFiles;
}

function collectInlineHashesFromHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const inlineScriptHashes = new Set(
    [...document.querySelectorAll('script:not([src])')]
      .map((element) => element.textContent ?? '')
      .filter((value) => value.trim() !== '')
      .map(toSha256Hash),
  );
  const inlineStyleHashes = new Set(
    [...document.querySelectorAll('style')]
      .map((element) => element.textContent ?? '')
      .filter((value) => value.trim() !== '')
      .map(toSha256Hash),
  );
  const inlineStyleAttributeHashes = new Set(
    [...document.querySelectorAll('[style]')]
      .map((element) => element.getAttribute('style') ?? '')
      .filter((value) => value.trim() !== '')
      .map(toSha256Hash),
  );

  dom.window.close();

  return {
    inlineScriptHashes,
    inlineStyleHashes,
    inlineStyleAttributeHashes,
  };
}

function collectCspHashes(cspDirectiveValue) {
  const hashes = new Set();
  for (const match of cspDirectiveValue.matchAll(SHA256_SOURCE_REGEX)) {
    hashes.add(match[1] ?? '');
  }
  return hashes;
}

async function main() {
  const outputDirectoryStats = await stat(BUILD_OUTPUT_DIRECTORY).catch(() => null);
  if (!outputDirectoryStats || !outputDirectoryStats.isDirectory()) {
    throw new Error(
      `Build output directory "${BUILD_OUTPUT_DIRECTORY}" not found. Run "npm run build" first.`,
    );
  }

  const htmlFiles = await collectHtmlFiles(BUILD_OUTPUT_DIRECTORY);
  if (htmlFiles.length === 0) {
    throw new Error(
      `No HTML files were found under "${BUILD_OUTPUT_DIRECTORY}". Cannot validate CSP.`,
    );
  }

  const validationErrors = [];

  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, 'utf8');
    const cspMetaMatch = html.match(CSP_META_REGEX);
    if (!cspMetaMatch) {
      validationErrors.push(`${htmlPath}: missing CSP meta tag.`);
      continue;
    }

    const cspValue = cspMetaMatch[1].replaceAll('&amp;', '&').replaceAll('&quot;', '"');
    const scriptDirective = cspValue.match(/script-src\s+([^;]+)/i)?.[1] ?? '';
    const styleDirective = cspValue.match(/style-src\s+([^;]+)/i)?.[1] ?? '';
    const cspScriptHashes = collectCspHashes(scriptDirective);
    const cspStyleHashes = collectCspHashes(styleDirective);

    const {
      inlineScriptHashes,
      inlineStyleHashes,
      inlineStyleAttributeHashes,
    } = collectInlineHashesFromHtml(html);

    for (const hash of inlineScriptHashes) {
      if (!cspScriptHashes.has(hash)) {
        validationErrors.push(`${htmlPath}: missing script hash sha256-${hash}.`);
      }
    }

    for (const hash of inlineStyleHashes) {
      if (!cspStyleHashes.has(hash)) {
        validationErrors.push(`${htmlPath}: missing style hash sha256-${hash}.`);
      }
    }

    for (const hash of inlineStyleAttributeHashes) {
      if (!cspStyleHashes.has(hash)) {
        validationErrors.push(
          `${htmlPath}: missing style-attribute hash sha256-${hash}.`,
        );
      }
    }
  }

  if (validationErrors.length > 0) {
    for (const validationError of validationErrors) {
      console.error(validationError);
    }
    throw new Error(`CSP validation failed with ${validationErrors.length} issue(s).`);
  }

  console.log(`CSP validation passed for ${htmlFiles.length} HTML files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
