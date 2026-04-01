import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..', 'src');
const TAXONOMY_PATH = path.resolve(SRC_DIR, 'lib', 'meta-pixel-taxonomy.ts');
const LANDING_PAGES_PATH = path.resolve(SRC_DIR, 'lib', 'landing-pages.ts');
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx']);
const TRACKER_FUNCTION_NAME = 'trackMetaPixelEvent';

function getLineNumber(sourceText, index) {
  return sourceText.slice(0, index).split('\n').length;
}

async function collectSourceFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(absolutePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension) || entry.name.endsWith('.d.ts')) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function unwrapObjectLiteral(initializer) {
  let node = initializer;
  while (
    node
    && (ts.isAsExpression(node)
      || ts.isSatisfiesExpression(node))
  ) {
    node = node.expression;
  }
  return ts.isObjectLiteralExpression(node) ? node : null;
}

function extractMetaPixelStaticContentNames(taxonomySourceText, errors) {
  const sourceFile = ts.createSourceFile(
    TAXONOMY_PATH,
    taxonomySourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const names = new Set();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'META_PIXEL_CONTENT_NAMES'
      && node.initializer
    ) {
      const objectLiteral = unwrapObjectLiteral(node.initializer);
      if (objectLiteral) {
        for (const prop of objectLiteral.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            names.add(prop.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (names.size === 0) {
    errors.push('Could not parse META_PIXEL_CONTENT_NAMES keys from meta-pixel-taxonomy.ts.');
  }

  return names;
}

function extractLandingPageSlugs(landingSourceText, errors) {
  const sourceFile = ts.createSourceFile(
    LANDING_PAGES_PATH,
    landingSourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const slugs = new Set();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'LANDING_PAGES'
      && node.initializer
    ) {
      const objectLiteral = unwrapObjectLiteral(node.initializer);
      if (objectLiteral) {
        for (const prop of objectLiteral.properties) {
          if (
            ts.isPropertyAssignment(prop)
            && (ts.isStringLiteral(prop.name) || ts.isNoSubstitutionTemplateLiteral(prop.name))
          ) {
            slugs.add(prop.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (slugs.size === 0) {
    errors.push('Could not parse LANDING_PAGES keys from landing-pages.ts.');
  }

  return slugs;
}

function getPropertyName(propertyNameNode) {
  if (!propertyNameNode) {
    return null;
  }
  if (ts.isIdentifier(propertyNameNode)) {
    return propertyNameNode.text;
  }
  if (ts.isStringLiteralLike(propertyNameNode)) {
    return propertyNameNode.text;
  }
  return null;
}

function extractStaticEventName(argumentNode) {
  if (!argumentNode) {
    return null;
  }
  if (ts.isStringLiteral(argumentNode) || ts.isNoSubstitutionTemplateLiteral(argumentNode)) {
    return argumentNode.text.trim();
  }
  return null;
}

function isAllowedContentNameLiteral(value, staticNames, landingSlugs) {
  return staticNames.has(value) || landingSlugs.has(value);
}

function validateContentNameExpression({
  expression,
  sourceFilePath,
  sourceText,
  eventName,
  staticNames,
  landingSlugs,
  errors,
}) {
  const relPath = path.relative(path.resolve(__dirname, '..'), sourceFilePath);

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    const value = expression.text;
    if (!isAllowedContentNameLiteral(value, staticNames, landingSlugs)) {
      const lineNumber = getLineNumber(sourceText, expression.pos);
      errors.push(
        `${relPath}:${lineNumber} ${TRACKER_FUNCTION_NAME}("${eventName}") content_name "${value}" is not in META_PIXEL_CONTENT_NAMES or LANDING_PAGES.`,
      );
    }
    return;
  }

  if (
    ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'PIXEL_CONTENT_NAME'
    && ts.isIdentifier(expression.name)
    && staticNames.has(expression.name.text)
  ) {
    return;
  }

  if (ts.isConditionalExpression(expression)) {
    validateContentNameExpression({
      expression: expression.whenTrue,
      sourceFilePath,
      sourceText,
      eventName,
      staticNames,
      landingSlugs,
      errors,
    });
    validateContentNameExpression({
      expression: expression.whenFalse,
      sourceFilePath,
      sourceText,
      eventName,
      staticNames,
      landingSlugs,
      errors,
    });
    return;
  }

  if (ts.isAsExpression(expression) && ts.isIdentifier(expression.expression)) {
    if (
      expression.expression.text === 'slug'
      && relPath.endsWith('landing-pages/shared/landing-page-booking-cta-action.tsx')
    ) {
      return;
    }
  }

  if (ts.isIdentifier(expression)) {
    if (expression.text === 'slug' && relPath.endsWith('landing-pages/shared/landing-page-booking-cta-action.tsx')) {
      return;
    }
    if (expression.text === 'contentName' && relPath.endsWith('components/sections/links-hub.tsx')) {
      return;
    }
    if (expression.text === 'metaPixelContentName' && relPath.endsWith('booking-modal/reservation-form.tsx')) {
      return;
    }
    const lineNumber = getLineNumber(sourceText, expression.pos);
    errors.push(
      `${relPath}:${lineNumber} ${TRACKER_FUNCTION_NAME}("${eventName}") content_name must be a string literal, allowed conditional, or an approved dynamic binding (slug/contentName/metaPixelContentName).`,
    );
    return;
  }

  const lineNumber = getLineNumber(sourceText, expression.pos);
  errors.push(
    `${relPath}:${lineNumber} ${TRACKER_FUNCTION_NAME}("${eventName}") content_name expression is not supported for contract validation.`,
  );
}

function validateCall({
  node,
  sourceFilePath,
  sourceText,
  staticNames,
  landingSlugs,
  errors,
}) {
  const eventNameNode = node.arguments[0];
  const eventName = extractStaticEventName(eventNameNode);
  if (!eventName) {
    const relPath = path.relative(path.resolve(__dirname, '..'), sourceFilePath);
    const lineNumber = getLineNumber(sourceText, node.pos);
    errors.push(
      `${relPath}:${lineNumber} ${TRACKER_FUNCTION_NAME} requires a static string standard event name.`,
    );
    return;
  }

  const paramsArg = node.arguments[1];
  if (!paramsArg || !ts.isObjectLiteralExpression(paramsArg)) {
    return;
  }

  for (const property of paramsArg.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const key = getPropertyName(property.name);
    if (key !== 'content_name') {
      continue;
    }
    validateContentNameExpression({
      expression: property.initializer,
      sourceFilePath,
      sourceText,
      eventName,
      staticNames,
      landingSlugs,
      errors,
    });
  }
}

function validateSourceFile(sourceFilePath, sourceText, staticNames, landingSlugs, errors) {
  const sourceFile = ts.createSourceFile(
    sourceFilePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourceFilePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === TRACKER_FUNCTION_NAME
    ) {
      validateCall({
        node,
        sourceFilePath,
        sourceText,
        staticNames,
        landingSlugs,
        errors,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

async function main() {
  const errors = [];
  const taxonomyText = await readFile(TAXONOMY_PATH, 'utf8');
  const landingText = await readFile(LANDING_PAGES_PATH, 'utf8');
  const staticNames = extractMetaPixelStaticContentNames(taxonomyText, errors);
  const landingSlugs = extractLandingPageSlugs(landingText, errors);

  const sourceFiles = await collectSourceFiles(SRC_DIR);
  for (const sourceFile of sourceFiles) {
    const sourceText = await readFile(sourceFile, 'utf8');
    validateSourceFile(sourceFile, sourceText, staticNames, landingSlugs, errors);
  }

  if (errors.length > 0) {
    console.error('Meta Pixel contract validation failed.');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Meta Pixel contract validation passed.');
}

main().catch((error) => {
  console.error('Meta Pixel contract validation crashed.');
  console.error(error);
  process.exit(1);
});
