import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..', '..');
const FIGMA_FILES_DIR = path.join(APP_ROOT, 'figma', 'files');

function getEnv(name) {
  return process.env[name]?.trim() ?? '';
}

async function ensureDirectory(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, data) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(filePath, content, 'utf8');
}

async function ensureJsonIfMissing(filePath, fallback) {
  try {
    await readFile(filePath, 'utf8');
  } catch (_error) {
    await writeJson(filePath, fallback);
  }
}

async function fetchFigmaJson(endpoint, accessToken) {
  const response = await fetch(endpoint, {
    headers: {
      'X-Figma-Token': accessToken,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    const snippet = responseText.slice(0, 500);
    throw new Error(
      `Figma request failed (${response.status}) at ${endpoint}: ${snippet}`,
    );
  }

  return response.json();
}

async function main() {
  await ensureDirectory(FIGMA_FILES_DIR);

  const accessToken = getEnv('FIGMA_ACCESS_TOKEN');
  const fileKey = getEnv('FIGMA_FILE_KEY');
  const fileInfoPath = path.join(FIGMA_FILES_DIR, 'file.json');
  const variablesPath = path.join(FIGMA_FILES_DIR, 'variables.local.json');

  if (!accessToken || !fileKey) {
    console.log(
      'Skipping Figma pull: FIGMA_ACCESS_TOKEN or FIGMA_FILE_KEY is missing.',
    );
    await ensureJsonIfMissing(fileInfoPath, {
      meta: {
        source: 'placeholder',
      },
    });
    await ensureJsonIfMissing(variablesPath, {
      meta: {
        variableCollections: {},
        variables: {},
      },
    });
    return;
  }

  const baseEndpoint = `https://api.figma.com/v1/files/${fileKey}`;
  const fileEndpoint = baseEndpoint;
  const variablesEndpoint = `${baseEndpoint}/variables/local`;

  const [fileJson, variablesJson] = await Promise.all([
    fetchFigmaJson(fileEndpoint, accessToken),
    fetchFigmaJson(variablesEndpoint, accessToken),
  ]);

  await Promise.all([
    writeJson(fileInfoPath, fileJson),
    writeJson(variablesPath, variablesJson),
  ]);

  console.log(
    'Pulled Figma file metadata and local variables into figma/files/.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
