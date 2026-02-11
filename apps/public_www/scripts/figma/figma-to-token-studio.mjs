/**
 * Figma → Token Studio converter.
 *
 * Reads the Figma file payload (figma/files/file.json) produced by
 * `npm run figma:pull` and extracts design tokens into Token Studio
 * compatible JSON files under figma/token-studio/.
 *
 * Works on Figma Professional plans — does NOT require the Variables
 * API (Enterprise-only). Extracts tokens exclusively from published
 * styles (color, text, effect) found in the file response. Raw node
 * properties (spacing, border radius, stroke weight, opacity) are
 * intentionally ignored — those are rendering artifacts, not tokens.
 *
 * Output files:
 *   figma/token-studio/global.json    — primitive design values
 *   figma/token-studio/semantic.json  — semantic aliases (preserved if exists)
 *   figma/token-studio/component.json — component tokens (preserved if exists)
 *   figma/token-studio/$metadata.json — token set ordering
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..', '..');

const FIGMA_FILE_PATH = path.join(APP_ROOT, 'figma', 'files', 'file.json');
const TOKEN_STUDIO_DIR = path.join(APP_ROOT, 'figma', 'token-studio');

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
    throw new Error(`Failed to read JSON file: ${filePath} — ${error.message}`);
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(filePath, content, 'utf8');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeName(name) {
  return name
    .replace(/\//g, '.')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.\-_]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\-]+/, '')
    .replace(/[.\-]+$/, '');
}

function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== 'object' || current[key].value !== undefined) {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

// ---------------------------------------------------------------------------
// Color extraction
// ---------------------------------------------------------------------------

function figmaColorToHex(color) {
  if (!color || typeof color !== 'object') {
    return null;
  }

  const r = Math.round(clamp((color.r ?? 0) * 255, 0, 255));
  const g = Math.round(clamp((color.g ?? 0) * 255, 0, 255));
  const b = Math.round(clamp((color.b ?? 0) * 255, 0, 255));
  const a = color.a !== undefined ? clamp(color.a, 0, 1) : 1;

  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();

  if (a < 1) {
    const alphaHex = Math.round(a * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
    return `${hex}${alphaHex}`;
  }

  return hex;
}

function figmaColorToRgba(color) {
  if (!color || typeof color !== 'object') {
    return null;
  }

  const r = Math.round(clamp((color.r ?? 0) * 255, 0, 255));
  const g = Math.round(clamp((color.g ?? 0) * 255, 0, 255));
  const b = Math.round(clamp((color.b ?? 0) * 255, 0, 255));
  const a = color.a !== undefined ? clamp(color.a, 0, 1) : 1;

  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(3))})`;
  }

  return `rgb(${r}, ${g}, ${b})`;
}

// ---------------------------------------------------------------------------
// Style extraction from the Figma file payload
// ---------------------------------------------------------------------------

/**
 * Builds a lookup map: style node ID → style metadata from the top-level
 * `styles` field of the Figma file response.
 */
function buildStyleMap(figmaFile) {
  const styles = figmaFile.styles ?? {};
  const map = new Map();

  for (const [nodeId, styleMeta] of Object.entries(styles)) {
    map.set(nodeId, {
      key: styleMeta.key,
      name: styleMeta.name,
      styleType: styleMeta.styleType,
      description: styleMeta.description ?? '',
    });
  }

  return map;
}

/**
 * Walks the document tree and collects nodes that reference styles.
 * Returns arrays of extracted values grouped by type.
 */
function extractFromNodeTree(node, styleMap, collected) {
  if (!node || typeof node !== 'object') {
    return;
  }

  // Extract fill styles (COLOR styles applied to fills)
  if (node.styles?.fill && styleMap.has(node.styles.fill)) {
    const meta = styleMap.get(node.styles.fill);
    if (meta.styleType === 'FILL' && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'SOLID' && fill.color) {
          const hex = figmaColorToHex(fill.color);
          if (hex) {
            collected.colors.set(meta.name, {
              hex,
              description: meta.description,
              opacity: fill.opacity,
            });
          }
        }
      }
    }
  }

  // Extract stroke styles
  if (node.styles?.stroke && styleMap.has(node.styles.stroke)) {
    const meta = styleMap.get(node.styles.stroke);
    if (Array.isArray(node.strokes)) {
      for (const stroke of node.strokes) {
        if (stroke.type === 'SOLID' && stroke.color) {
          const hex = figmaColorToHex(stroke.color);
          if (hex) {
            const strokeName = meta.name.startsWith('stroke/')
              ? meta.name
              : `stroke/${meta.name}`;
            collected.colors.set(strokeName, {
              hex,
              description: meta.description,
              opacity: stroke.opacity,
            });
          }
        }
      }
    }
  }

  // Extract text styles
  if (node.styles?.text && styleMap.has(node.styles.text)) {
    const meta = styleMap.get(node.styles.text);
    if (node.style) {
      collected.textStyles.set(meta.name, {
        fontFamily: node.style.fontFamily ?? null,
        fontWeight: node.style.fontWeight ?? null,
        fontSize: node.style.fontSize ?? null,
        lineHeightPx: node.style.lineHeightPx ?? null,
        lineHeightPercent: node.style.lineHeightPercent ?? null,
        lineHeightPercentFontSize:
          node.style.lineHeightPercentFontSize ?? null,
        lineHeightUnit: node.style.lineHeightUnit ?? null,
        letterSpacing: node.style.letterSpacing ?? null,
        paragraphSpacing: node.style.paragraphSpacing ?? null,
        textCase: node.style.textCase ?? null,
        textDecoration: node.style.textDecoration ?? null,
        description: meta.description,
      });
    }
  }

  // Extract effect styles
  if (node.styles?.effect && styleMap.has(node.styles.effect)) {
    const meta = styleMap.get(node.styles.effect);
    if (Array.isArray(node.effects)) {
      collected.effectStyles.set(meta.name, {
        effects: node.effects,
        description: meta.description,
      });
    }
  }

  // Extract grid styles
  if (node.styles?.grid && styleMap.has(node.styles.grid)) {
    const meta = styleMap.get(node.styles.grid);
    if (Array.isArray(node.layoutGrids)) {
      collected.gridStyles.set(meta.name, {
        grids: node.layoutGrids,
        description: meta.description,
      });
    }
  }

  // NOTE: We intentionally do NOT scrape raw node properties (spacing,
  // border radius, border width, opacity, unstyled fills) from the
  // document tree. Those values are rendering artifacts from individual
  // shapes and icons — not intentional design tokens. Only published
  // styles are extracted as tokens.

  // Recurse into children
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      extractFromNodeTree(child, styleMap, collected);
    }
  }
}

// ---------------------------------------------------------------------------
// Token builders
// ---------------------------------------------------------------------------

function buildColorTokens(colorMap) {
  const tokens = {};

  for (const [styleName, data] of colorMap) {
    const tokenPath = sanitizeName(styleName);
    if (!tokenPath) {
      continue;
    }

    const token = {
      value: data.hex,
      type: 'color',
    };

    if (data.description) {
      token.description = data.description;
    }

    if (data.opacity !== undefined && data.opacity !== null && data.opacity < 1) {
      token.value = figmaColorToRgba({
        r: parseInt(data.hex.slice(1, 3), 16) / 255,
        g: parseInt(data.hex.slice(3, 5), 16) / 255,
        b: parseInt(data.hex.slice(5, 7), 16) / 255,
        a: data.opacity,
      });
    }

    setNestedValue(tokens, tokenPath, token);
  }

  return tokens;
}

function buildTypographyTokens(textStyleMap) {
  const fontFamilies = {};
  const fontWeights = {};
  const fontSizes = {};
  const lineHeights = {};
  const letterSpacings = {};
  const paragraphSpacings = {};
  const typography = {};

  const seenFamilies = new Set();
  const seenWeights = new Set();
  const seenSizes = new Set();

  for (const [styleName, data] of textStyleMap) {
    const tokenPath = sanitizeName(styleName);
    if (!tokenPath) {
      continue;
    }

    // Collect unique font families
    if (data.fontFamily && !seenFamilies.has(data.fontFamily)) {
      seenFamilies.add(data.fontFamily);
      const familyKey = sanitizeName(data.fontFamily);
      fontFamilies[familyKey] = {
        value: data.fontFamily,
        type: 'fontFamilies',
      };
    }

    // Collect unique font weights
    if (data.fontWeight !== null && !seenWeights.has(data.fontWeight)) {
      seenWeights.add(data.fontWeight);
      fontWeights[`${data.fontWeight}`] = {
        value: `${data.fontWeight}`,
        type: 'fontWeights',
      };
    }

    // Collect unique font sizes
    if (data.fontSize !== null && !seenSizes.has(data.fontSize)) {
      seenSizes.add(data.fontSize);
      fontSizes[`${data.fontSize}`] = {
        value: `${data.fontSize}`,
        type: 'fontSizes',
      };
    }

    // Build line height value
    let lineHeightValue = null;
    if (data.lineHeightUnit === 'PIXELS' && data.lineHeightPx !== null) {
      lineHeightValue = `${data.lineHeightPx}`;
    } else if (
      data.lineHeightUnit === 'FONT_SIZE_%' &&
      data.lineHeightPercentFontSize !== null
    ) {
      lineHeightValue = `${data.lineHeightPercentFontSize}%`;
    } else if (data.lineHeightPercent !== null) {
      lineHeightValue = `${data.lineHeightPercent}%`;
    }

    if (lineHeightValue !== null) {
      lineHeights[tokenPath] = {
        value: lineHeightValue,
        type: 'lineHeights',
      };
    }

    // Letter spacing
    if (data.letterSpacing !== null && data.letterSpacing !== 0) {
      letterSpacings[tokenPath] = {
        value: `${data.letterSpacing}`,
        type: 'letterSpacing',
      };
    }

    // Paragraph spacing
    if (data.paragraphSpacing !== null && data.paragraphSpacing !== 0) {
      paragraphSpacings[tokenPath] = {
        value: `${data.paragraphSpacing}`,
        type: 'paragraphSpacing',
      };
    }

    // Composite typography token
    const compositeValue = {};
    if (data.fontFamily) {
      const familyKey = sanitizeName(data.fontFamily);
      compositeValue.fontFamily = `{fontFamilies.${familyKey}}`;
    }
    if (data.fontWeight !== null) {
      compositeValue.fontWeight = `{fontWeights.${data.fontWeight}}`;
    }
    if (data.fontSize !== null) {
      compositeValue.fontSize = `{fontSizes.${data.fontSize}}`;
    }
    if (lineHeightValue !== null) {
      compositeValue.lineHeight = `{lineHeights.${tokenPath}}`;
    }
    if (data.letterSpacing !== null && data.letterSpacing !== 0) {
      compositeValue.letterSpacing = `{letterSpacing.${tokenPath}}`;
    }
    if (data.paragraphSpacing !== null && data.paragraphSpacing !== 0) {
      compositeValue.paragraphSpacing = `{paragraphSpacing.${tokenPath}}`;
    }
    if (data.textCase) {
      compositeValue.textCase = data.textCase.toLowerCase();
    }
    if (data.textDecoration) {
      compositeValue.textDecoration = data.textDecoration.toLowerCase();
    }

    const typographyToken = {
      value: compositeValue,
      type: 'typography',
    };
    if (data.description) {
      typographyToken.description = data.description;
    }

    setNestedValue(typography, tokenPath, typographyToken);
  }

  return {
    fontFamilies,
    fontWeights,
    fontSizes,
    lineHeights,
    letterSpacing: letterSpacings,
    paragraphSpacing: paragraphSpacings,
    typography,
  };
}

function buildEffectTokens(effectStyleMap) {
  const tokens = {};

  for (const [styleName, data] of effectStyleMap) {
    const tokenPath = sanitizeName(styleName);
    if (!tokenPath) {
      continue;
    }

    const shadowValues = [];

    for (const effect of data.effects) {
      if (
        (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') &&
        effect.visible !== false
      ) {
        const color = effect.color
          ? figmaColorToRgba(effect.color)
          : 'rgba(0, 0, 0, 0.25)';
        const offsetX = effect.offset?.x ?? 0;
        const offsetY = effect.offset?.y ?? 0;
        const blur = effect.radius ?? 0;
        const spread = effect.spread ?? 0;

        shadowValues.push({
          color,
          type: effect.type === 'INNER_SHADOW' ? 'innerShadow' : 'dropShadow',
          x: `${offsetX}`,
          y: `${offsetY}`,
          blur: `${blur}`,
          spread: `${spread}`,
        });
      }
    }

    if (shadowValues.length > 0) {
      const token = {
        value: shadowValues.length === 1 ? shadowValues[0] : shadowValues,
        type: 'boxShadow',
      };

      if (data.description) {
        token.description = data.description;
      }

      setNestedValue(tokens, tokenPath, token);
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Node finder — locate a specific frame/component by name or ID
// ---------------------------------------------------------------------------

/**
 * Searches the document tree for a node matching the given name or ID.
 * Returns the first match found (depth-first).
 */
function findNode(node, nameOrId) {
  if (!node || typeof node !== 'object') {
    return null;
  }

  // Match by node ID (e.g. "123:456")
  if (node.id === nameOrId) {
    return node;
  }

  // Match by name (case-insensitive)
  if (
    node.name &&
    node.name.toLowerCase() === nameOrId.toLowerCase()
  ) {
    return node;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNode(child, nameOrId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Lists all top-level frames across all pages for diagnostic output.
 */
function listTopLevelFrames(document) {
  const frames = [];
  const pages = document.children ?? [];

  for (const page of pages) {
    const pageName = page.name ?? '(unnamed page)';
    const pageChildren = page.children ?? [];

    for (const frame of pageChildren) {
      frames.push({
        id: frame.id,
        name: frame.name ?? '(unnamed)',
        type: frame.type ?? 'UNKNOWN',
        page: pageName,
      });
    }
  }

  return frames;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const figmaFile = await readJsonIfExists(FIGMA_FILE_PATH);

  if (!figmaFile) {
    console.log(
      'No Figma file data found at figma/files/file.json.',
    );
    console.log(
      'Run "npm run figma:pull" first, or place the file manually.',
    );
    process.exitCode = 1;
    return;
  }

  if (figmaFile.meta?.source === 'placeholder') {
    console.log(
      'Figma file is a placeholder. Run "npm run figma:pull" with valid credentials.',
    );
    console.log(
      'Skipping tokenization — Token Studio files left unchanged.',
    );
    return;
  }

  const styleMap = buildStyleMap(figmaFile);
  console.log(`Found ${styleMap.size} published style(s) in file metadata.`);

  // Determine the root node to extract from.
  // If FIGMA_TOKEN_ROOT_NODE is set, scope extraction to that frame only.
  // This prevents picking up styles from imported libraries (e.g. Material
  // Design kits) that live elsewhere in the file.
  const rootNodeSpec = (process.env.FIGMA_TOKEN_ROOT_NODE ?? '').trim();
  const document = figmaFile.document ?? figmaFile;
  let extractionRoot = document;

  if (rootNodeSpec) {
    const found = findNode(document, rootNodeSpec);
    if (!found) {
      console.error(
        `Error: could not find node "${rootNodeSpec}" in the Figma file.`,
      );
      console.error('');
      console.error('Available top-level frames:');
      const frames = listTopLevelFrames(document);
      for (const frame of frames) {
        console.error(
          `  [${frame.type}] "${frame.name}" (id: ${frame.id}) — page: ${frame.page}`,
        );
      }
      console.error('');
      console.error(
        'Set FIGMA_TOKEN_ROOT_NODE to one of the names or IDs above.',
      );
      process.exitCode = 1;
      return;
    }

    extractionRoot = found;
    console.log(
      `Scoped extraction to: "${found.name}" (id: ${found.id}, type: ${found.type})`,
    );
  } else {
    console.log(
      'No FIGMA_TOKEN_ROOT_NODE set — extracting from entire document.',
    );
    console.log(
      'Tip: set FIGMA_TOKEN_ROOT_NODE to a frame name or ID to scope extraction.',
    );

    const frames = listTopLevelFrames(document);
    if (frames.length > 0) {
      console.log('');
      console.log('Available top-level frames:');
      for (const frame of frames) {
        console.log(
          `  [${frame.type}] "${frame.name}" (id: ${frame.id}) — page: ${frame.page}`,
        );
      }
      console.log('');
    }
  }

  const collected = {
    colors: new Map(),
    textStyles: new Map(),
    effectStyles: new Map(),
    gridStyles: new Map(),
  };

  extractFromNodeTree(extractionRoot, styleMap, collected);

  console.log(`Extracted ${collected.colors.size} color style(s).`);
  console.log(`Extracted ${collected.textStyles.size} text style(s).`);
  console.log(`Extracted ${collected.effectStyles.size} effect style(s).`);
  console.log(`Extracted ${collected.gridStyles.size} grid style(s).`);

  // Build global tokens from published styles only
  const colorTokens = buildColorTokens(collected.colors);
  const typographyResult = buildTypographyTokens(collected.textStyles);
  const effectTokens = buildEffectTokens(collected.effectStyles);

  const globalTokens = {
    colors: colorTokens,
    fontFamilies: typographyResult.fontFamilies,
    fontWeights: typographyResult.fontWeights,
    fontSizes: typographyResult.fontSizes,
    lineHeights: typographyResult.lineHeights,
    letterSpacing: typographyResult.letterSpacing,
    paragraphSpacing: typographyResult.paragraphSpacing,
    typography: typographyResult.typography,
    boxShadow: effectTokens,
  };

  // Remove empty top-level groups for cleanliness
  for (const [key, value] of Object.entries(globalTokens)) {
    if (
      value &&
      typeof value === 'object' &&
      Object.keys(value).length === 0
    ) {
      delete globalTokens[key];
    }
  }

  // Write global.json (always overwritten from Figma)
  const globalPath = path.join(TOKEN_STUDIO_DIR, 'global.json');
  await writeJson(globalPath, globalTokens);
  console.log(`Wrote global tokens: ${globalPath}`);

  // Preserve semantic.json and component.json if they exist
  // (these are manually curated, not auto-generated)
  const semanticPath = path.join(TOKEN_STUDIO_DIR, 'semantic.json');
  const existingSemantic = await readJsonIfExists(semanticPath);
  if (!existingSemantic) {
    await writeJson(semanticPath, {
      fg: {
        default: {
          value: '{colors.black}',
          type: 'color',
          description: 'Default foreground color — update to reference your Figma color tokens',
        },
      },
      bg: {
        default: {
          value: '{colors.white}',
          type: 'color',
          description: 'Default background color — update to reference your Figma color tokens',
        },
      },
    });
    console.log(`Wrote initial semantic tokens: ${semanticPath}`);
  } else {
    console.log(`Semantic tokens preserved: ${semanticPath}`);
  }

  const componentPath = path.join(TOKEN_STUDIO_DIR, 'component.json');
  const existingComponent = await readJsonIfExists(componentPath);
  if (!existingComponent) {
    await writeJson(componentPath, {});
    console.log(`Wrote initial component tokens: ${componentPath}`);
  } else {
    console.log(`Component tokens preserved: ${componentPath}`);
  }

  // Write/update metadata
  const metadataPath = path.join(TOKEN_STUDIO_DIR, '$metadata.json');
  await writeJson(metadataPath, {
    tokenSetOrder: ['global', 'semantic', 'component'],
  });
  console.log(`Wrote metadata: ${metadataPath}`);

  // Summary
  const totalTokens = countTokens(globalTokens);
  console.log('');
  console.log(`Tokenization complete: ${totalTokens} token(s) in global set.`);
  console.log(
    'Run "npm run figma:build:studio" to generate CSS custom properties.',
  );
}

function countTokens(obj) {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && 'value' in value) {
      count++;
    } else if (value && typeof value === 'object') {
      count += countTokens(value);
    }
  }
  return count;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
