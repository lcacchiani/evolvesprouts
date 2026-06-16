#!/usr/bin/env node
/**
 * Compare admin OpenAPI paths in docs/api/admin.yaml with API Gateway routes
 * wired in backend/infrastructure/lib/api-stack.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminYamlPath = path.join(repoRoot, 'docs/api/admin.yaml');
const apiStackPath = path.join(repoRoot, 'backend/infrastructure/lib/api-stack.ts');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

function parseAdminYamlRoutes(specText) {
  const routes = new Map();
  const lines = specText.split('\n');
  let inPaths = false;
  let currentPath = null;

  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) {
      continue;
    }
    if (/^components:/.test(line)) {
      break;
    }

    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      routes.set(currentPath, new Set());
      continue;
    }

    if (!currentPath) {
      continue;
    }

    const methodMatch = line.match(/^    ([a-z]+):\s*$/);
    if (methodMatch && HTTP_METHODS.has(methodMatch[1])) {
      routes.get(currentPath).add(methodMatch[1].toUpperCase());
    }
  }

  return routes;
}

function joinPath(parentPath, segment) {
  if (!parentPath) {
    return `/${segment}`;
  }
  return `${parentPath}/${segment}`;
}

function resolveResourcePath(expr, vars) {
  const parts = expr.split('.addResource(');
  const rootName = parts[0].trim();
  if (!vars.has(rootName)) {
    return null;
  }

  let currentPath = vars.get(rootName);

  for (let index = 1; index < parts.length; index += 1) {
    const segmentMatch = parts[index].match(/^"([^"]+)"/);
    if (!segmentMatch) {
      return null;
    }
    currentPath = joinPath(currentPath, segmentMatch[1]);
  }

  return currentPath;
}

function parseApiStackRoutes(source) {
  const sectionMatch = source.match(/\/\/ API Routes([\s\S]*?)\/\/ Admin Bootstrap/);
  if (!sectionMatch) {
    throw new Error('Could not locate API Routes section in api-stack.ts');
  }
  const section = sectionMatch[1];
  const vars = new Map([['api.root', '']]);
  const routes = new Map();
  const hasAdminCatchAll = section.includes('adminCatchAll.addMethod("ANY"');

  const assignRegex = /const\s+(\w+)\s*=\s*([^;]+);/g;
  for (const match of section.matchAll(assignRegex)) {
    const [, varName, expr] = match;
    if (!expr.includes('addResource(')) {
      continue;
    }
    const routePath = resolveResourcePath(expr.trim(), vars);
    if (routePath != null) {
      vars.set(varName, routePath);
    }
  }

  function recordRoute(routePath, method) {
    if (!routePath) {
      return;
    }
    const methods = routes.get(routePath) ?? new Set();
    methods.add(method.toUpperCase());
    routes.set(routePath, methods);
  }

  for (const match of section.matchAll(/(\w+)\.addMethod\("([A-Z]+)"/g)) {
    const [, varName, method] = match;
    const routePath = vars.get(varName);
    if (routePath != null) {
      recordRoute(routePath, method);
    }
  }

  for (const match of section.matchAll(/addPublicApiKeyMethod\((\w+),\s*"([A-Z]+)"\)/g)) {
    const [, varName, method] = match;
    const routePath = vars.get(varName);
    if (routePath != null) {
      recordRoute(routePath, method);
    }
  }

  return { routes, hasAdminCatchAll };
}

function isAdminCatchAllPath(routePath) {
  return routePath.startsWith('/v1/admin/') && !routePath.startsWith('/v1/admin/assets');
}

function isInScope(routePath) {
  return (
    routePath === '/health' ||
    routePath.startsWith('/v1/admin/') ||
    routePath.startsWith('/v1/user/')
  );
}

function methodSetToString(methods) {
  return [...methods].sort().join(',');
}

function main() {
  const adminYamlText = readFileSync(adminYamlPath, 'utf8');
  const apiStackText = readFileSync(apiStackPath, 'utf8');
  const adminRoutes = parseAdminYamlRoutes(adminYamlText);
  const { routes: cdkRoutes, hasAdminCatchAll } = parseApiStackRoutes(apiStackText);

  const errors = [];

  if (!hasAdminCatchAll) {
    errors.push('Missing /v1/admin/{proxy+} ANY catch-all route in api-stack.ts');
  }

  for (const [routePath, yamlMethods] of adminRoutes) {
    if (isAdminCatchAllPath(routePath)) {
      if (!hasAdminCatchAll) {
        errors.push(`admin.yaml path not covered by CDK catch-all: ${routePath}`);
      }
      continue;
    }

    const cdkMethods = cdkRoutes.get(routePath);
    if (!cdkMethods) {
      errors.push(`admin.yaml path missing in CDK api-stack.ts: ${routePath}`);
      continue;
    }

    for (const method of yamlMethods) {
      if (method === 'OPTIONS') {
        continue;
      }
      if (!cdkMethods.has(method) && !(method !== 'ANY' && cdkMethods.has('ANY'))) {
        errors.push(
          `Method mismatch for ${routePath}: admin.yaml has ${method}, CDK has ${methodSetToString(cdkMethods)}`
        );
      }
    }
  }

  for (const [routePath, cdkMethods] of cdkRoutes) {
    if (!isInScope(routePath)) {
      continue;
    }
    if (isAdminCatchAllPath(routePath)) {
      continue;
    }
    if (routePath.includes('{proxy+}')) {
      continue;
    }

    if (!adminRoutes.has(routePath)) {
      errors.push(`CDK route missing from admin.yaml: ${routePath}`);
      continue;
    }

    const yamlMethods = adminRoutes.get(routePath);
    for (const method of cdkMethods) {
      if (method === 'OPTIONS' || method === 'ANY') {
        continue;
      }
      if (!yamlMethods.has(method)) {
        errors.push(`CDK method missing from admin.yaml for ${routePath}: ${method}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('CDK route / admin.yaml drift detected:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `CDK routes align with admin.yaml (${adminRoutes.size} OpenAPI paths, ${cdkRoutes.size} explicit CDK paths).`
  );
}

main();
