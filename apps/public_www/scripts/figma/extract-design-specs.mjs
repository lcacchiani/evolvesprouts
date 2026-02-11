/**
 * Figma → Design spec extractor.
 *
 * Reads the Figma file payload and generates a structured JSON
 * "design spec" for each direct child of the root frame. These
 * spec files are committed to git so that Cursor cloud agents
 * (and any automation) can read them without Figma API access.
 *
 * Output: figma/design-specs/<section-name>.json
 *
 * Environment variables:
 *   FIGMA_TOKEN_ROOT_NODE — name or ID of the root frame (required)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..', '..');

const FIGMA_FILE_PATH = path.join(APP_ROOT, 'figma', 'files', 'file.json');
const SPECS_DIR = path.join(APP_ROOT, 'figma', 'design-specs');

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
    throw error;
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function toKebabCase(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(3))})`;
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Node finder
// ---------------------------------------------------------------------------

function findNode(node, nameOrId) {
  if (!node || typeof node !== 'object') {
    return null;
  }
  if (node.id === nameOrId) {
    return node;
  }
  if (node.name && node.name.toLowerCase() === nameOrId.toLowerCase()) {
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

// ---------------------------------------------------------------------------
// Spec extraction
// ---------------------------------------------------------------------------

/**
 * Extract fills from a node as hex color strings.
 */
function extractFills(node) {
  if (!Array.isArray(node.fills)) {
    return [];
  }
  const colors = [];
  for (const fill of node.fills) {
    if (fill.type === 'SOLID' && fill.color && fill.visible !== false) {
      const hex = figmaColorToHex(fill.color);
      if (hex) {
        colors.push(hex);
      }
    }
  }
  return colors;
}

/**
 * Extract stroke colors from a node.
 */
function extractStrokes(node) {
  if (!Array.isArray(node.strokes)) {
    return [];
  }
  const colors = [];
  for (const stroke of node.strokes) {
    if (stroke.type === 'SOLID' && stroke.color && stroke.visible !== false) {
      const hex = figmaColorToHex(stroke.color);
      if (hex) {
        colors.push(hex);
      }
    }
  }
  return colors;
}

/**
 * Extract effects (shadows, blurs) from a node.
 */
function extractEffects(node) {
  if (!Array.isArray(node.effects)) {
    return [];
  }
  const effects = [];
  for (const effect of node.effects) {
    if (effect.visible === false) {
      continue;
    }
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      effects.push({
        type: effect.type === 'INNER_SHADOW' ? 'inner-shadow' : 'drop-shadow',
        color: effect.color ? figmaColorToHex(effect.color) : null,
        offset: { x: effect.offset?.x ?? 0, y: effect.offset?.y ?? 0 },
        blur: effect.radius ?? 0,
        spread: effect.spread ?? 0,
      });
    }
    if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
      effects.push({
        type: effect.type === 'BACKGROUND_BLUR' ? 'backdrop-blur' : 'blur',
        radius: effect.radius ?? 0,
      });
    }
  }
  return effects;
}

/**
 * Extract auto-layout properties from a node.
 */
function extractLayout(node) {
  if (!node.layoutMode) {
    return null;
  }
  const layout = {
    mode: node.layoutMode,
  };
  if (node.itemSpacing !== undefined) {
    layout.itemSpacing = node.itemSpacing;
  }
  if (node.primaryAxisAlignItems) {
    layout.primaryAxisAlign = node.primaryAxisAlignItems;
  }
  if (node.counterAxisAlignItems) {
    layout.counterAxisAlign = node.counterAxisAlignItems;
  }
  const padding = {};
  if (node.paddingTop) { padding.top = node.paddingTop; }
  if (node.paddingRight) { padding.right = node.paddingRight; }
  if (node.paddingBottom) { padding.bottom = node.paddingBottom; }
  if (node.paddingLeft) { padding.left = node.paddingLeft; }
  if (Object.keys(padding).length > 0) {
    layout.padding = padding;
  }
  return layout;
}

/**
 * Extract text properties from a TEXT node.
 */
function extractTextProps(node) {
  if (node.type !== 'TEXT') {
    return null;
  }
  const props = {};
  if (node.characters !== undefined) {
    props.content = node.characters;
  }
  if (node.style) {
    const s = node.style;
    if (s.fontFamily) { props.fontFamily = s.fontFamily; }
    if (s.fontSize) { props.fontSize = s.fontSize; }
    if (s.fontWeight) { props.fontWeight = s.fontWeight; }
    if (s.lineHeightPx) { props.lineHeight = s.lineHeightPx; }
    if (s.letterSpacing && s.letterSpacing !== 0) {
      props.letterSpacing = s.letterSpacing;
    }
    if (s.textAlignHorizontal) {
      props.textAlign = s.textAlignHorizontal.toLowerCase();
    }
    if (s.textCase && s.textCase !== 'ORIGINAL') {
      props.textTransform = s.textCase.toLowerCase();
    }
  }
  const fills = extractFills(node);
  if (fills.length > 0) {
    props.color = fills[0];
  }
  return props;
}

/**
 * Recursively build a design spec tree for a node.
 * Limits depth to avoid excessively large specs.
 */
function buildNodeSpec(node, depth, maxDepth) {
  if (!node || typeof node !== 'object') {
    return null;
  }
  if (node.visible === false) {
    return null;
  }

  const spec = {
    name: node.name ?? null,
    type: node.type ?? null,
  };

  // Dimensions
  if (node.absoluteBoundingBox) {
    const bb = node.absoluteBoundingBox;
    spec.width = Math.round(bb.width);
    spec.height = Math.round(bb.height);
  }

  // Fills
  const fills = extractFills(node);
  if (fills.length > 0) {
    spec.fills = fills;
  }

  // Strokes
  const strokes = extractStrokes(node);
  if (strokes.length > 0) {
    spec.strokes = strokes;
    if (node.strokeWeight) {
      spec.strokeWeight = node.strokeWeight;
    }
  }

  // Corner radius
  if (node.cornerRadius && node.cornerRadius > 0) {
    spec.cornerRadius = node.cornerRadius;
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity < 1) {
    spec.opacity = parseFloat(node.opacity.toFixed(3));
  }

  // Effects
  const effects = extractEffects(node);
  if (effects.length > 0) {
    spec.effects = effects;
  }

  // Layout
  const layout = extractLayout(node);
  if (layout) {
    spec.layout = layout;
  }

  // Text properties
  const textProps = extractTextProps(node);
  if (textProps) {
    spec.text = textProps;
  }

  // Children (with depth limit)
  if (Array.isArray(node.children) && depth < maxDepth) {
    const childSpecs = [];
    for (const child of node.children) {
      if (child.visible === false) {
        continue;
      }
      const childSpec = buildNodeSpec(child, depth + 1, maxDepth);
      if (childSpec) {
        childSpecs.push(childSpec);
      }
    }
    if (childSpecs.length > 0) {
      spec.children = childSpecs;
    }
  } else if (Array.isArray(node.children) && node.children.length > 0) {
    spec.childCount = node.children.filter((c) => c.visible !== false).length;
  }

  return spec;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rootNodeSpec = (process.env.FIGMA_TOKEN_ROOT_NODE ?? '').trim();
  if (!rootNodeSpec) {
    console.error('Error: FIGMA_TOKEN_ROOT_NODE is required.');
    process.exitCode = 1;
    return;
  }

  const figmaFile = await readJsonIfExists(FIGMA_FILE_PATH);
  if (!figmaFile) {
    console.error('No Figma file data at figma/files/file.json.');
    console.error('Run "npm run figma:pull" first.');
    process.exitCode = 1;
    return;
  }

  const document = figmaFile.document ?? figmaFile;
  const rootNode = findNode(document, rootNodeSpec);
  if (!rootNode) {
    console.error(`Could not find node "${rootNodeSpec}".`);
    process.exitCode = 1;
    return;
  }

  const children = rootNode.children ?? [];
  if (children.length === 0) {
    console.log('No children found — nothing to extract.');
    return;
  }

  console.log(
    `Extracting design specs from "${rootNode.name}" (${children.length} section(s))`,
  );

  await mkdir(SPECS_DIR, { recursive: true });

  const maxDepth = 6;
  let count = 0;

  for (const child of children) {
    if (child.visible === false) {
      continue;
    }

    const name = child.name ?? 'unnamed';
    const kebab = toKebabCase(name);
    const specPath = path.join(SPECS_DIR, `${kebab}.json`);
    const spec = buildNodeSpec(child, 0, maxDepth);

    if (spec) {
      spec.figmaNodeId = child.id ?? null;
      spec.extractedAt = new Date().toISOString();
      await writeJson(specPath, spec);
      console.log(`  ${kebab}.json — ${spec.children?.length ?? 0} child(ren)`);
      count++;
    }
  }

  console.log('');
  console.log(`Extracted ${count} design spec(s) to figma/design-specs/.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
