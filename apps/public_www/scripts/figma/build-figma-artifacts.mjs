import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..', '..');

const DEFAULT_MDM_EXPORT_PATH = path.join(
  APP_ROOT,
  'figma',
  'mdm',
  'exports',
  'tokens.json',
);
const DEFAULT_FIGMA_VARIABLES_PATH = path.join(
  APP_ROOT,
  'figma',
  'files',
  'variables.local.json',
);
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

function resolvePathFromAppRoot(value, fallbackPath) {
  if (!value) {
    return fallbackPath;
  }

  if (path.isAbsolute(value)) {
    return value;
  }

  return path.join(APP_ROOT, value);
}

async function ensureDirectoryForFile(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonIfExists(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw new Error(`Failed to read JSON file: ${filePath}`);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeColorComponent(value) {
  const floatValue = Number(value);
  const normalized = floatValue <= 1 ? floatValue * 255 : floatValue;
  return Math.round(clamp(normalized, 0, 255));
}

function normalizeAlpha(value) {
  if (value === undefined) {
    return 1;
  }

  const alpha = Number(value);
  return clamp(alpha, 0, 1);
}

function isColorValue(value) {
  return (
    value &&
    typeof value === 'object' &&
    'r' in value &&
    'g' in value &&
    'b' in value
  );
}

function colorToCss(value) {
  const red = normalizeColorComponent(value.r);
  const green = normalizeColorComponent(value.g);
  const blue = normalizeColorComponent(value.b);
  const alpha = normalizeAlpha(value.a);

  if (alpha === 1) {
    return `rgb(${red} ${green} ${blue})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function sanitizeTokenName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function createTokenSlug(value) {
  const sanitized = sanitizeTokenName(value);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return 'token';
}

function cssValueFromTokenValue(tokenValue, aliasMap) {
  if (tokenValue === null || tokenValue === undefined) {
    return '';
  }

  if (typeof tokenValue === 'string') {
    return tokenValue;
  }

  if (typeof tokenValue === 'number') {
    return String(tokenValue);
  }

  if (typeof tokenValue === 'boolean') {
    return tokenValue ? 'true' : 'false';
  }

  if (Array.isArray(tokenValue)) {
    return tokenValue
      .map((item) => cssValueFromTokenValue(item, aliasMap))
      .join(' ');
  }

  if (isColorValue(tokenValue)) {
    return colorToCss(tokenValue);
  }

  if (
    typeof tokenValue === 'object' &&
    tokenValue.type === 'VARIABLE_ALIAS' &&
    tokenValue.id
  ) {
    const aliasName = aliasMap.get(tokenValue.id);
    if (!aliasName) {
      return `var(--figma-alias-${createTokenSlug(tokenValue.id)})`;
    }

    return `var(--figma-${createTokenSlug(aliasName)})`;
  }

  if (
    typeof tokenValue === 'object' &&
    'value' in tokenValue &&
    tokenValue.value !== undefined
  ) {
    return cssValueFromTokenValue(tokenValue.value, aliasMap);
  }

  return JSON.stringify(tokenValue);
}

function collectMdmTokens(node, pathParts, tokens) {
  if (node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      collectMdmTokens(item, [...pathParts, String(index)], tokens);
    });
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  if ('value' in node && pathParts.length > 0) {
    tokens.push({
      id: null,
      name: pathParts.join('.'),
      type: node.type ?? null,
      value: node.value,
    });
    return;
  }

  Object.entries(node).forEach(([key, child]) => {
    collectMdmTokens(child, [...pathParts, key], tokens);
  });
}

function collectFigmaApiTokens(variablesFile) {
  const collections = variablesFile?.meta?.variableCollections ?? {};
  const variables = variablesFile?.meta?.variables ?? {};
  const tokens = [];

  Object.values(variables).forEach((variable) => {
    const collection = collections[variable.variableCollectionId] ?? null;
    const collectionName = collection?.name ?? 'global';
    const valuesByMode = variable.valuesByMode ?? {};

    const modeId =
      collection?.defaultModeId ?? Object.keys(valuesByMode).at(0) ?? '';
    const modeName =
      collection?.modes?.find((mode) => mode.modeId === modeId)?.name ?? '';
    const value = valuesByMode[modeId];

    if (value === undefined) {
      return;
    }

    const tokenNameParts = [collectionName, variable.name];
    if (modeName && modeName.toLowerCase() !== 'default') {
      tokenNameParts.push(modeName);
    }

    tokens.push({
      id: variable.id ?? null,
      name: tokenNameParts.join('.'),
      type: variable.resolvedType ?? null,
      value,
    });
  });

  return tokens;
}

function normalizeTokens(rawTokens) {
  const slugCounts = new Map();
  const aliasMap = new Map();

  rawTokens.forEach((token) => {
    if (token.id) {
      aliasMap.set(token.id, token.name);
    }
  });

  return rawTokens.map((token) => {
    const baseSlug = createTokenSlug(token.name);
    const currentCount = slugCounts.get(baseSlug) ?? 0;
    const nextCount = currentCount + 1;
    slugCounts.set(baseSlug, nextCount);

    const uniqueSlug = nextCount > 1 ? `${baseSlug}-${nextCount}` : baseSlug;
    const cssVar = `--figma-${uniqueSlug}`;
    const cssValue = cssValueFromTokenValue(token.value, aliasMap);

    return {
      id: token.id,
      name: token.name,
      type: token.type,
      cssVar,
      cssValue,
    };
  });
}

function buildCssFile(tokens) {
  const lines = [
    '/* Auto-generated by scripts/figma/build-figma-artifacts.mjs */',
    ':root {',
  ];

  tokens.forEach((token) => {
    lines.push(`  ${token.cssVar}: ${token.cssValue};`);
  });

  lines.push('}', '');
  return lines.join('\n');
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

async function main() {
  const mdmExportPath = resolvePathFromAppRoot(
    process.env.FIGMA_MDM_EXPORT_PATH,
    DEFAULT_MDM_EXPORT_PATH,
  );
  const figmaVariablesPath = resolvePathFromAppRoot(
    process.env.FIGMA_VARIABLES_FILE_PATH,
    DEFAULT_FIGMA_VARIABLES_PATH,
  );

  const mdmExportJson = await readJsonIfExists(mdmExportPath);
  const figmaVariablesJson = await readJsonIfExists(figmaVariablesPath);

  let rawTokens = [];
  let source = 'none';

  if (mdmExportJson) {
    collectMdmTokens(mdmExportJson, [], rawTokens);
    source = 'mdm-export';
  }

  if (rawTokens.length === 0 && figmaVariablesJson) {
    rawTokens = collectFigmaApiTokens(figmaVariablesJson);
    source = 'figma-variables-api';
  }

  const normalizedTokens = normalizeTokens(rawTokens);

  await writeJson(OUTPUT_ARTIFACT_PATH, {
    generatedAt: new Date().toISOString(),
    source,
    tokenCount: normalizedTokens.length,
    tokens: normalizedTokens,
  });
  await writeText(OUTPUT_CSS_PATH, buildCssFile(normalizedTokens));

  console.log(
    `Built ${normalizedTokens.length} token(s) from ${source} source.`,
  );
  console.log(`Wrote artifact: ${OUTPUT_ARTIFACT_PATH}`);
  console.log(`Wrote CSS: ${OUTPUT_CSS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
