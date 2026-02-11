/**
 * Figma → Token Studio converter.
 *
 * Reads the Figma file payload (figma/files/file.json) produced by
 * `npm run figma:pull` and extracts design tokens into Token Studio
 * compatible JSON files under figma/token-studio/.
 *
 * Works on Figma Professional plans — does NOT require the Variables
 * API (Enterprise-only). Instead it extracts tokens from:
 *   - Published styles (color, text, effect) embedded in the file response
 *   - Document node tree (fills, strokes, effects, typography, layout)
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

  // Extract auto-layout properties (spacing, padding, border radius)
  if (node.layoutMode && (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL')) {
    if (node.itemSpacing !== undefined && node.itemSpacing > 0) {
      const key = `${node.itemSpacing}`;
      if (!collected.spacingValues.has(key)) {
        collected.spacingValues.set(key, node.itemSpacing);
      }
    }
    if (node.paddingTop !== undefined && node.paddingTop > 0) {
      collected.spacingValues.set(`${node.paddingTop}`, node.paddingTop);
    }
    if (node.paddingRight !== undefined && node.paddingRight > 0) {
      collected.spacingValues.set(`${node.paddingRight}`, node.paddingRight);
    }
    if (node.paddingBottom !== undefined && node.paddingBottom > 0) {
      collected.spacingValues.set(`${node.paddingBottom}`, node.paddingBottom);
    }
    if (node.paddingLeft !== undefined && node.paddingLeft > 0) {
      collected.spacingValues.set(`${node.paddingLeft}`, node.paddingLeft);
    }
  }

  // Extract border radius
  if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
    const key = `${node.cornerRadius}`;
    if (!collected.borderRadiusValues.has(key)) {
      collected.borderRadiusValues.set(key, node.cornerRadius);
    }
  }
  if (Array.isArray(node.rectangleCornerRadii)) {
    for (const r of node.rectangleCornerRadii) {
      if (r > 0) {
        collected.borderRadiusValues.set(`${r}`, r);
      }
    }
  }

  // Extract border width from strokes
  if (node.strokeWeight !== undefined && node.strokeWeight > 0) {
    collected.borderWidthValues.set(`${node.strokeWeight}`, node.strokeWeight);
  }

  // Extract opacity
  if (node.opacity !== undefined && node.opacity < 1 && node.opacity > 0) {
    const rounded = parseFloat(node.opacity.toFixed(2));
    const pct = Math.round(rounded * 100);
    collected.opacityValues.set(`${pct}`, rounded);
  }

  // Also collect fills/strokes from nodes without explicit styles
  // (useful for one-off colors used in the design)
  if (!node.styles?.fill && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.color && fill.visible !== false) {
        const hex = figmaColorToHex(fill.color);
        if (hex && !collected.looseFillColors.has(hex)) {
          collected.looseFillColors.set(hex, {
            hex,
            nodeName: node.name ?? '',
          });
        }
      }
    }
  }

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

function buildSpacingTokens(spacingValues) {
  const values = [...spacingValues.values()].sort((a, b) => a - b);
  const tokens = {};

  // Create named scale from sorted unique values
  const scaleNames = [
    '3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl',
    '4xl', '5xl', '6xl', '7xl', '8xl', '9xl', '10xl',
  ];

  values.forEach((value, index) => {
    const name = index < scaleNames.length ? scaleNames[index] : `${value}`;
    tokens[name] = {
      value: `${value}`,
      type: 'spacing',
    };
  });

  return tokens;
}

function buildBorderRadiusTokens(radiusValues) {
  const values = [...radiusValues.values()].sort((a, b) => a - b);
  const tokens = {};

  const scaleNames = [
    'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full',
  ];

  values.forEach((value, index) => {
    const name = index < scaleNames.length ? scaleNames[index] : `${value}`;
    tokens[name] = {
      value: `${value}`,
      type: 'borderRadius',
    };
  });

  return tokens;
}

function buildBorderWidthTokens(widthValues) {
  const values = [...widthValues.values()].sort((a, b) => a - b);
  const tokens = {};

  const scaleNames = ['thin', 'default', 'thick', 'heavy'];

  values.forEach((value, index) => {
    const name = index < scaleNames.length ? scaleNames[index] : `${value}`;
    tokens[name] = {
      value: `${value}`,
      type: 'borderWidth',
    };
  });

  return tokens;
}

function buildOpacityTokens(opacityValues) {
  const entries = [...opacityValues.entries()].sort(
    (a, b) => a[1] - b[1],
  );
  const tokens = {};

  for (const [pct, value] of entries) {
    tokens[pct] = {
      value: `${value}`,
      type: 'opacity',
    };
  }

  return tokens;
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

  const collected = {
    colors: new Map(),
    textStyles: new Map(),
    effectStyles: new Map(),
    gridStyles: new Map(),
    spacingValues: new Map(),
    borderRadiusValues: new Map(),
    borderWidthValues: new Map(),
    opacityValues: new Map(),
    looseFillColors: new Map(),
  };

  const document = figmaFile.document ?? figmaFile;
  extractFromNodeTree(document, styleMap, collected);

  console.log(`Extracted ${collected.colors.size} color style(s).`);
  console.log(`Extracted ${collected.textStyles.size} text style(s).`);
  console.log(`Extracted ${collected.effectStyles.size} effect style(s).`);
  console.log(
    `Extracted ${collected.spacingValues.size} unique spacing value(s).`,
  );
  console.log(
    `Extracted ${collected.borderRadiusValues.size} unique border-radius value(s).`,
  );
  console.log(
    `Extracted ${collected.borderWidthValues.size} unique border-width value(s).`,
  );
  console.log(
    `Extracted ${collected.opacityValues.size} unique opacity value(s).`,
  );
  console.log(
    `Found ${collected.looseFillColors.size} additional unstiled fill color(s).`,
  );

  // Build global tokens
  const colorTokens = buildColorTokens(collected.colors);
  const typographyResult = buildTypographyTokens(collected.textStyles);
  const effectTokens = buildEffectTokens(collected.effectStyles);
  const spacingTokens = buildSpacingTokens(collected.spacingValues);
  const borderRadiusTokens = buildBorderRadiusTokens(
    collected.borderRadiusValues,
  );
  const borderWidthTokens = buildBorderWidthTokens(
    collected.borderWidthValues,
  );
  const opacityTokens = buildOpacityTokens(collected.opacityValues);

  const globalTokens = {
    colors: colorTokens,
    spacing: spacingTokens,
    borderRadius: borderRadiusTokens,
    borderWidth: borderWidthTokens,
    opacity: opacityTokens,
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
