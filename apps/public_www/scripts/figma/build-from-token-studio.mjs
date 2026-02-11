/**
 * Token Studio → CSS builder.
 *
 * Reads Token Studio JSON files from figma/token-studio/ and generates:
 *   - figma/mdm/artifacts/tokens.normalized.json  (normalized artifact)
 *   - src/app/generated/figma-tokens.css           (CSS custom properties)
 *
 * Supports:
 *   - All Token Studio token types (color, spacing, borderRadius, etc.)
 *   - Alias references like {colors.primary.500}
 *   - Composite typography tokens
 *   - Box shadow tokens (single and multi-layer)
 *   - Theme-aware token set resolution
 *
 * No external dependencies — uses Node.js built-ins only.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..', '..');

const TOKEN_STUDIO_DIR = path.join(APP_ROOT, 'figma', 'token-studio');
const OUTPUT_ARTIFACT_PATH = path.join(
  APP_ROOT,
  'figma',
  'mdm',
  'artifacts',
  'tokens.normalized.json',
);
const OUTPUT_CSS_PATH = path.join(
  APP_ROOT,
  'src',
  'app',
  'generated',
  'figma-tokens.css',
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readJsonIfExists(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to read JSON: ${filePath} — ${error.message}`);
  }
}

async function ensureDirectoryForFile(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeJson(filePath, value) {
  await ensureDirectoryForFile(filePath);
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(filePath, content, 'utf8');
}

async function writeText(filePath, value) {
  await ensureDirectoryForFile(filePath);
  await writeFile(filePath, value, 'utf8');
}

function sanitizeTokenSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/-{2,}/g, '-');
}

// ---------------------------------------------------------------------------
// Token collection: flatten Token Studio nested JSON into a flat list
// ---------------------------------------------------------------------------

function collectTokens(node, pathParts, tokens) {
  if (node === null || node === undefined) {
    return;
  }

  if (typeof node !== 'object' || Array.isArray(node)) {
    return;
  }

  // A Token Studio token has a "value" and "type" property
  if ('value' in node && 'type' in node) {
    tokens.push({
      path: pathParts.join('.'),
      value: node.value,
      type: node.type,
      description: node.description ?? '',
    });
    return;
  }

  // A token with only "value" (no explicit type)
  if ('value' in node && pathParts.length > 0) {
    tokens.push({
      path: pathParts.join('.'),
      value: node.value,
      type: null,
      description: node.description ?? '',
    });
    return;
  }

  // Recurse into groups
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue; // Skip Token Studio metadata keys
    }
    collectTokens(child, [...pathParts, key], tokens);
  }
}

// ---------------------------------------------------------------------------
// Alias resolution
// ---------------------------------------------------------------------------

/**
 * Builds a lookup map from token path to resolved value.
 * Handles alias references like {colors.primary.500}.
 */
function buildResolutionMap(allTokens) {
  const map = new Map();

  for (const token of allTokens) {
    map.set(token.path, token);
  }

  return map;
}

function isAliasString(value) {
  return typeof value === 'string' && value.startsWith('{') && value.endsWith('}');
}

function extractAliasPath(value) {
  return value.slice(1, -1).trim();
}

/**
 * Resolves a token value, following alias references recursively.
 * Detects circular references to avoid infinite loops.
 */
function resolveValue(value, resolutionMap, visited) {
  if (visited === undefined) {
    visited = new Set();
  }

  if (typeof value === 'string' && isAliasString(value)) {
    const aliasPath = extractAliasPath(value);

    if (visited.has(aliasPath)) {
      return value; // Circular reference — return unresolved
    }

    visited.add(aliasPath);

    const target = resolutionMap.get(aliasPath);
    if (target) {
      return resolveValue(target.value, resolutionMap, visited);
    }

    return value; // Unresolved alias — return as-is
  }

  if (typeof value === 'string') {
    // Handle inline alias references like "16px {spacing.unit}"
    return value.replace(/\{([^}]+)\}/g, (match, aliasPath) => {
      if (visited.has(aliasPath)) {
        return match;
      }

      visited.add(aliasPath);

      const target = resolutionMap.get(aliasPath.trim());
      if (target) {
        const resolved = resolveValue(target.value, resolutionMap, new Set(visited));
        return typeof resolved === 'string' ? resolved : JSON.stringify(resolved);
      }

      return match;
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, resolutionMap, new Set(visited)));
  }

  if (value && typeof value === 'object') {
    const resolved = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val, resolutionMap, new Set(visited));
    }
    return resolved;
  }

  return value;
}

// ---------------------------------------------------------------------------
// CSS value conversion
// ---------------------------------------------------------------------------

function tokenValueToCss(resolvedValue, tokenType) {
  if (resolvedValue === null || resolvedValue === undefined) {
    return '';
  }

  if (typeof resolvedValue === 'string') {
    return resolvedValue;
  }

  if (typeof resolvedValue === 'number') {
    return String(resolvedValue);
  }

  if (typeof resolvedValue === 'boolean') {
    return resolvedValue ? 'true' : 'false';
  }

  // Box shadow (single or array)
  if (tokenType === 'boxShadow') {
    const shadows = Array.isArray(resolvedValue)
      ? resolvedValue
      : [resolvedValue];

    const parts = shadows.map((shadow) => {
      const x = shadow.x ?? '0';
      const y = shadow.y ?? '0';
      const blur = shadow.blur ?? '0';
      const spread = shadow.spread ?? '0';
      const color = shadow.color ?? 'rgba(0, 0, 0, 0.25)';
      const inset = shadow.type === 'innerShadow' ? 'inset ' : '';
      return `${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`;
    });

    return parts.join(', ');
  }

  // Typography composite
  if (tokenType === 'typography') {
    const parts = [];
    if (resolvedValue.fontWeight) {
      parts.push(resolvedValue.fontWeight);
    }
    if (resolvedValue.fontSize) {
      const fontSize = resolvedValue.fontSize;
      const lineHeight = resolvedValue.lineHeight;
      if (lineHeight) {
        parts.push(`${fontSize}px/${lineHeight}`);
      } else {
        parts.push(`${fontSize}px`);
      }
    }
    if (resolvedValue.fontFamily) {
      parts.push(resolvedValue.fontFamily);
    }
    return parts.join(' ') || JSON.stringify(resolvedValue);
  }

  // Generic object — serialize
  if (typeof resolvedValue === 'object') {
    return JSON.stringify(resolvedValue);
  }

  return String(resolvedValue);
}

/**
 * Returns the appropriate CSS unit suffix for a given token type
 * if the value is a plain number.
 */
function cssSuffix(tokenType, rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  // If value already has a unit, don't add one
  if (/[a-zA-Z%]/.test(rawValue)) {
    return '';
  }

  const pxTypes = new Set([
    'spacing',
    'borderRadius',
    'borderWidth',
    'fontSizes',
    'paragraphSpacing',
    'sizing',
  ]);

  if (pxTypes.has(tokenType)) {
    return 'px';
  }

  return '';
}

// ---------------------------------------------------------------------------
// Build outputs
// ---------------------------------------------------------------------------

function buildCssFile(normalizedTokens) {
  const lines = [
    '/* Auto-generated by scripts/figma/build-from-token-studio.mjs */',
    '/* Source: figma/token-studio/ (Token Studio format) */',
    ':root {',
  ];

  for (const token of normalizedTokens) {
    const comment = token.description ? ` /* ${token.description} */` : '';
    lines.push(`  ${token.cssVar}: ${token.cssValue};${comment}`);
  }

  lines.push('}', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Read metadata to determine token set order
  const metadata = await readJsonIfExists(
    path.join(TOKEN_STUDIO_DIR, '$metadata.json'),
  );
  const themes = await readJsonIfExists(
    path.join(TOKEN_STUDIO_DIR, '$themes.json'),
  );

  const tokenSetOrder = metadata?.tokenSetOrder ?? [
    'global',
    'semantic',
    'component',
  ];

  // Determine which sets to load (default: all sets as source/enabled)
  // Use the first theme if available, otherwise load all sets
  let activeSets = tokenSetOrder;
  if (Array.isArray(themes) && themes.length > 0) {
    const theme = themes[0]; // Use first theme (Light) by default
    const selected = theme.selectedTokenSets ?? {};
    activeSets = tokenSetOrder.filter(
      (set) =>
        selected[set] === 'source' || selected[set] === 'enabled',
    );
    console.log(`Using theme "${theme.name}" with sets: ${activeSets.join(', ')}`);
  }

  // Load all active token sets
  const allTokens = [];

  for (const setName of activeSets) {
    const setPath = path.join(TOKEN_STUDIO_DIR, `${setName}.json`);
    const setData = await readJsonIfExists(setPath);

    if (!setData) {
      console.log(`Token set "${setName}" not found — skipping.`);
      continue;
    }

    const tokens = [];
    collectTokens(setData, [], tokens);
    console.log(`Loaded ${tokens.length} token(s) from "${setName}".`);
    allTokens.push(...tokens);
  }

  if (allTokens.length === 0) {
    console.log('No tokens found. Writing empty CSS.');
    await ensureDirectoryForFile(OUTPUT_CSS_PATH);
    await writeText(
      OUTPUT_CSS_PATH,
      '/* Auto-generated by scripts/figma/build-from-token-studio.mjs */\n:root {\n}\n',
    );
    return;
  }

  // Build resolution map and resolve aliases
  const resolutionMap = buildResolutionMap(allTokens);

  const slugCounts = new Map();
  const normalizedTokens = allTokens.map((token) => {
    const resolvedValue = resolveValue(token.value, resolutionMap);
    const cssRawValue = tokenValueToCss(resolvedValue, token.type);
    const suffix = cssSuffix(token.type, cssRawValue);
    const cssValue = cssRawValue + suffix;

    const baseSlug = sanitizeTokenSlug(token.path);
    const currentCount = slugCounts.get(baseSlug) ?? 0;
    const nextCount = currentCount + 1;
    slugCounts.set(baseSlug, nextCount);
    const uniqueSlug = nextCount > 1 ? `${baseSlug}-${nextCount}` : baseSlug;

    return {
      path: token.path,
      type: token.type,
      description: token.description,
      cssVar: `--figma-${uniqueSlug}`,
      cssValue,
      rawValue: token.value,
      resolvedValue,
    };
  });

  // Write artifact JSON
  await writeJson(OUTPUT_ARTIFACT_PATH, {
    generatedAt: new Date().toISOString(),
    source: 'token-studio',
    theme: Array.isArray(themes) && themes.length > 0 ? themes[0].name : 'default',
    tokenCount: normalizedTokens.length,
    tokens: normalizedTokens.map((t) => ({
      path: t.path,
      type: t.type,
      description: t.description,
      cssVar: t.cssVar,
      cssValue: t.cssValue,
    })),
  });

  // Write CSS
  await writeText(OUTPUT_CSS_PATH, buildCssFile(normalizedTokens));

  console.log('');
  console.log(`Built ${normalizedTokens.length} token(s) from Token Studio source.`);
  console.log(`Wrote artifact: ${OUTPUT_ARTIFACT_PATH}`);
  console.log(`Wrote CSS:      ${OUTPUT_CSS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
