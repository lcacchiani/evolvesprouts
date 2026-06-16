import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(scriptPath), '..');
const openapiSpecPath = path.resolve(appRoot, '../../docs/api/public.yaml');
const generatedTypesPath = path.resolve(appRoot, 'src/types/generated/public-api.generated.ts');
const generatorBinaryPath = path.resolve(appRoot, 'node_modules/.bin/openapi-typescript');

if (!existsSync(generatedTypesPath)) {
  console.error(
    `Missing generated public API types at ${generatedTypesPath}. Run "npm run generate:public-api-types".`
  );
  process.exit(1);
}

if (!existsSync(generatorBinaryPath)) {
  console.error(
    `Missing openapi-typescript binary at ${generatorBinaryPath}. Run "npm install" in apps/public_www.`
  );
  process.exit(1);
}

const tempDir = mkdtempSync(path.join(tmpdir(), 'public-api-types-'));
const tempOutputPath = path.join(tempDir, 'public-api.generated.ts');

try {
  execFileSync(generatorBinaryPath, [openapiSpecPath, '-o', tempOutputPath], {
    cwd: appRoot,
    stdio: 'pipe',
  });

  const generatedInRepo = readFileSync(generatedTypesPath, 'utf8');
  const generatedFromSpec = readFileSync(tempOutputPath, 'utf8');
  if (generatedInRepo !== generatedFromSpec) {
    console.error('Public API type drift detected.');
    console.error('Run "npm run generate:public-api-types" and commit the updated generated file.');
    process.exit(1);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
