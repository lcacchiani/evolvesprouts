import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const BUILD_OUTPUT_DIRECTORY = resolve('out');
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

const GTM_SCRIPT_ORIGINS = ['https://www.googletagmanager.com'];
const GTM_CONNECT_ORIGINS = [
  'https://www.google-analytics.com',
  'https://analytics.google.com',
  'https://region1.google-analytics.com',
  'https://stats.g.doubleclick.net',
];
const GTM_DETECT_MARKER = 'init-gtm.js';

function buildCspDirectiveBase(hasGtm) {
  const connectSources = [
    "'self'",
    'https://api.evolvesprouts.com',
    TURNSTILE_ORIGIN,
  ];
  if (hasGtm) {
    connectSources.push(...GTM_CONNECT_ORIGINS);
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src ${connectSources.join(' ')}`,
    `frame-src 'self' ${TURNSTILE_ORIGIN}`,
    "form-action 'self' mailto:",
  ];
}

const HEAD_OPENING_TAG_REGEX = /<head\b[^>]*>/i;
const EXISTING_CSP_META_REGEX =
  /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i;

function toSha256HashSource(value) {
  const digest = createHash('sha256').update(value, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

function escapeHtmlAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function collectUniqueInlineBodies(values) {
  const seen = new Set();
  const orderedBodies = [];

  for (const body of values) {
    if (body.trim() === '' || seen.has(body)) {
      continue;
    }

    seen.add(body);
    orderedBodies.push(body);
  }

  return orderedBodies;
}

function collectInlineBodiesWithDom(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const inlineScriptBodies = collectUniqueInlineBodies(
    [...document.querySelectorAll('script:not([src])')].map(
      (element) => element.textContent ?? '',
    ),
  );
  const inlineStyleBodies = collectUniqueInlineBodies(
    [...document.querySelectorAll('style')].map(
      (element) => element.textContent ?? '',
    ),
  );
  const inlineStyleAttributeValues = collectUniqueInlineBodies(
    [...document.querySelectorAll('[style]')].map(
      (element) => element.getAttribute('style') ?? '',
    ),
  );

  dom.window.close();

  return {
    inlineScriptBodies,
    inlineStyleBodies,
    inlineStyleAttributeValues,
  };
}

function collectQueuedNextInlineScripts(inlineScriptBodies) {
  const queuedBodies = [];
  const seen = new Set();

  for (const scriptBody of inlineScriptBodies) {
    const pushCallIndex = scriptBody.indexOf('.push(');
    if (!scriptBody.includes('__next_s') || pushCallIndex < 0) {
      continue;
    }

    const payloadStartIndex = pushCallIndex + '.push('.length;
    const payloadEndIndex = scriptBody.lastIndexOf(')');
    if (payloadEndIndex <= payloadStartIndex) {
      continue;
    }

    const payloadRaw = scriptBody.slice(payloadStartIndex, payloadEndIndex);
    try {
      const payload = JSON.parse(payloadRaw);
      if (!Array.isArray(payload) || payload.length < 2) {
        continue;
      }

      const scriptSource = payload[0];
      const scriptProps = payload[1];
      if (
        scriptSource ||
        !scriptProps ||
        typeof scriptProps !== 'object' ||
        typeof scriptProps.children !== 'string'
      ) {
        continue;
      }

      const inlineChildren = scriptProps.children;
      if (inlineChildren.trim() === '' || seen.has(inlineChildren)) {
        continue;
      }

      seen.add(inlineChildren);
      queuedBodies.push(inlineChildren);
    } catch {
      // Ignore payloads that are not parseable JSON arrays.
    }
  }

  return queuedBodies;
}

function buildCspValue(html) {
  const {
    inlineScriptBodies,
    inlineStyleBodies,
    inlineStyleAttributeValues,
  } = collectInlineBodiesWithDom(html);
  const queuedInlineScriptBodies = collectQueuedNextInlineScripts(inlineScriptBodies);

  const scriptHashes = [
    ...new Set(
      [...inlineScriptBodies, ...queuedInlineScriptBodies].map(toSha256HashSource),
    ),
  ];
  const styleHashes = [...new Set(inlineStyleBodies.map(toSha256HashSource))];
  const styleAttributeHashes = [
    ...new Set(inlineStyleAttributeValues.map(toSha256HashSource)),
  ];

  const hasGtm = html.includes(GTM_DETECT_MARKER);
  const gtmScriptOrigins = hasGtm ? GTM_SCRIPT_ORIGINS : [];

  const scriptDirectiveSources = [
    "'self'",
    TURNSTILE_ORIGIN,
    ...gtmScriptOrigins,
    ...scriptHashes,
  ].join(' ');
  const styleDirectiveSources = [
    "'self'",
    ...(styleAttributeHashes.length > 0 ? ["'unsafe-hashes'"] : []),
    ...styleHashes,
    ...styleAttributeHashes,
  ].join(' ');

  const directives = [
    ...buildCspDirectiveBase(hasGtm),
    `script-src ${scriptDirectiveSources}`,
    `style-src ${styleDirectiveSources}`,
  ];

  return {
    cspValue: directives.join('; '),
    scriptHashCount: scriptHashes.length,
    styleHashCount: styleHashes.length,
    styleAttributeHashCount: styleAttributeHashes.length,
  };
}

function applyCspMetaTag(html, cspValue) {
  const escapedCsp = escapeHtmlAttribute(cspValue);
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${escapedCsp}"/>`;

  if (EXISTING_CSP_META_REGEX.test(html)) {
    return html.replace(EXISTING_CSP_META_REGEX, metaTag);
  }

  const headMatch = html.match(HEAD_OPENING_TAG_REGEX);
  if (!headMatch || typeof headMatch.index !== 'number') {
    throw new Error('Unable to locate <head> tag for CSP injection.');
  }

  const insertionIndex = headMatch.index + headMatch[0].length;
  return `${html.slice(0, insertionIndex)}${metaTag}${html.slice(insertionIndex)}`;
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
      `No HTML files were found under "${BUILD_OUTPUT_DIRECTORY}". Cannot inject CSP.`,
    );
  }

  let modifiedFiles = 0;
  let totalScriptHashes = 0;
  let totalStyleHashes = 0;
  let totalStyleAttributeHashes = 0;
  let maxScriptHashesOnPage = 0;

  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, 'utf8');
    const {
      cspValue,
      scriptHashCount,
      styleHashCount,
      styleAttributeHashCount,
    } = buildCspValue(html);
    const updatedHtml = applyCspMetaTag(html, cspValue);

    if (updatedHtml !== html) {
      await writeFile(htmlPath, updatedHtml, 'utf8');
      modifiedFiles += 1;
    }

    totalScriptHashes += scriptHashCount;
    totalStyleHashes += styleHashCount;
    totalStyleAttributeHashes += styleAttributeHashCount;
    if (scriptHashCount > maxScriptHashesOnPage) {
      maxScriptHashesOnPage = scriptHashCount;
    }
  }

  console.log(
    [
      `Injected CSP meta into ${modifiedFiles}/${htmlFiles.length} HTML files.`,
      `Total script hash entries: ${totalScriptHashes}.`,
      `Total style hash entries: ${totalStyleHashes}.`,
      `Total style attribute hash entries: ${totalStyleAttributeHashes}.`,
      `Max script hashes on a single page: ${maxScriptHashesOnPage}.`,
    ].join(' '),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
