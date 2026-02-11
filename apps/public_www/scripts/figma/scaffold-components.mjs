/**
 * Figma → Component scaffold generator.
 *
 * Reads the Figma file payload and scaffolds React section components
 * for each direct child of the root frame. Idempotent — never
 * overwrites existing component files.
 *
 * Also appends new section keys to content JSON files (preserving
 * existing keys).
 *
 * Usage:
 *   FIGMA_TOKEN_ROOT_NODE=Desktop node scripts/figma/scaffold-components.mjs
 *
 * Environment variables:
 *   FIGMA_TOKEN_ROOT_NODE  — name or ID of the Figma frame to scan
 *                            (required)
 *
 * Output:
 *   src/components/sections/<section-name>.tsx  (one per Figma child)
 *   src/content/en.json     (new keys appended)
 *   src/content/zh-CN.json  (new keys appended)
 *   src/content/zh-HK.json  (new keys appended)
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..', '..');

const FIGMA_FILE_PATH = path.join(APP_ROOT, 'figma', 'files', 'file.json');
const SECTIONS_DIR = path.join(APP_ROOT, 'src', 'components', 'sections');
const CONTENT_DIR = path.join(APP_ROOT, 'src', 'content');

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

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a Figma node name to a kebab-case file name.
 * e.g. "Hero Banner" → "hero-banner"
 */
function toKebabCase(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Convert a Figma node name to a PascalCase component name.
 * e.g. "Hero Banner" → "HeroBanner"
 */
function toPascalCase(name) {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert a Figma node name to a camelCase content key.
 * e.g. "Hero Banner" → "heroBanner"
 */
function toCamelCase(name) {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
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
// Component template
// ---------------------------------------------------------------------------

function generateComponentSource(componentName, contentKey, figmaNodeName) {
  return `interface ${componentName}Props {
  content: {
    title: string;
    description: string;
    [key: string]: unknown;
  };
}

export function ${componentName}({ content }: ${componentName}Props) {
  return (
    <section
      aria-label={content.title}
      data-figma-node="${figmaNodeName}"
      className="w-full px-4 py-12 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
          {content.title}
        </h2>
        {content.description && (
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            {content.description}
          </p>
        )}
        {/* TODO: Implement ${figmaNodeName} section design from Figma */}
      </div>
    </section>
  );
}
`;
}

// ---------------------------------------------------------------------------
// Content updater
// ---------------------------------------------------------------------------

/**
 * Adds a new section key to a content JSON file if it doesn't exist.
 * Preserves all existing keys.
 */
async function appendContentKey(filePath, contentKey, sectionTitle) {
  const existing = await readJsonIfExists(filePath);
  if (!existing) {
    return false;
  }

  if (existing[contentKey]) {
    return false; // Key already exists — don't touch it
  }

  existing[contentKey] = {
    title: sectionTitle,
    description: '',
    items: [],
  };

  await writeJson(filePath, existing);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rootNodeSpec = (process.env.FIGMA_TOKEN_ROOT_NODE ?? '').trim();
  if (!rootNodeSpec) {
    console.error('Error: FIGMA_TOKEN_ROOT_NODE is required.');
    console.error(
      'Set it to the name or ID of the Figma frame to scaffold from.',
    );
    process.exitCode = 1;
    return;
  }

  const figmaFile = await readJsonIfExists(FIGMA_FILE_PATH);
  if (!figmaFile) {
    console.error('No Figma file data found at figma/files/file.json.');
    console.error('Run "npm run figma:pull" first.');
    process.exitCode = 1;
    return;
  }

  const document = figmaFile.document ?? figmaFile;
  const rootNode = findNode(document, rootNodeSpec);
  if (!rootNode) {
    console.error(`Could not find node "${rootNodeSpec}" in the Figma file.`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Scanning "${rootNode.name}" (${rootNode.type}, id: ${rootNode.id})`,
  );

  const children = rootNode.children ?? [];
  if (children.length === 0) {
    console.log('No children found — nothing to scaffold.');
    return;
  }

  console.log(`Found ${children.length} section(s) to scaffold.`);
  console.log('');

  await mkdir(SECTIONS_DIR, { recursive: true });

  let created = 0;
  let skipped = 0;
  let contentUpdated = 0;

  const contentFiles = [
    path.join(CONTENT_DIR, 'en.json'),
    path.join(CONTENT_DIR, 'zh-CN.json'),
    path.join(CONTENT_DIR, 'zh-HK.json'),
  ];

  for (const child of children) {
    const nodeName = child.name ?? 'unnamed';
    const kebab = toKebabCase(nodeName);
    const pascal = toPascalCase(nodeName);
    const camel = toCamelCase(nodeName);
    const filePath = path.join(SECTIONS_DIR, `${kebab}.tsx`);

    // Scaffold component (idempotent — skip if exists)
    if (await fileExists(filePath)) {
      console.log(`  SKIP  ${kebab}.tsx (already exists)`);
      skipped++;
    } else {
      const source = generateComponentSource(pascal, camel, nodeName);
      await writeFile(filePath, source, 'utf8');
      console.log(`  NEW   ${kebab}.tsx → <${pascal} />`);
      created++;
    }

    // Append content key to each locale (idempotent — skip if key exists)
    for (const contentFile of contentFiles) {
      const added = await appendContentKey(contentFile, camel, nodeName);
      if (added) {
        const locale = path.basename(contentFile, '.json');
        console.log(`        + content key "${camel}" in ${locale}.json`);
        contentUpdated++;
      }
    }
  }

  console.log('');
  console.log(
    `Scaffold complete: ${created} created, ${skipped} skipped, ${contentUpdated} content key(s) added.`,
  );

  if (created > 0) {
    console.log('');
    console.log('Next steps:');
    console.log(
      '  1. Open each new component in src/components/sections/ and',
    );
    console.log(
      '     implement the design from Figma (use MCP to inspect the frame).',
    );
    console.log(
      '  2. Update src/content/*.json with the actual copy for each section.',
    );
    console.log(
      '  3. Add the component to your page in src/app/[locale]/page.tsx.',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
