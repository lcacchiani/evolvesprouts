import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..', 'src');
const CONTRACT_PATH = path.resolve(SRC_DIR, 'lib', 'analytics-taxonomy.json');
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx']);
const TRACKER_FUNCTION_NAMES = new Set(['trackAnalyticsEvent', 'trackPublicFormOutcome']);

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

function getLineNumber(sourceText, index) {
  return sourceText.slice(0, index).split('\n').length;
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

function extractParamsObjectProperty(optionsObjectNode) {
  for (const property of optionsObjectNode.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      continue;
    }
    const propertyName = getPropertyName(property.name);
    if (propertyName === 'params') {
      return property;
    }
  }
  return null;
}

function extractStaticFormKindFromOptions(optionsObjectNode) {
  if (!ts.isObjectLiteralExpression(optionsObjectNode)) {
    return null;
  }
  for (const property of optionsObjectNode.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const propertyName = getPropertyName(property.name);
    if (propertyName !== 'formKind') {
      continue;
    }
    const init = property.initializer;
    if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
      const value = init.text.trim();
      return value || null;
    }
  }
  return null;
}

function extractCustomParamKeys(paramsInitializerNode, sourceFilePath, sourceText, errors) {
  if (!ts.isObjectLiteralExpression(paramsInitializerNode)) {
    const lineNumber = getLineNumber(sourceText, paramsInitializerNode.pos);
    errors.push(
      `${sourceFilePath}:${lineNumber} Analytics tracker params must be an object literal.`,
    );
    return [];
  }

  const customParamKeys = [];
  for (const property of paramsInitializerNode.properties) {
    if (ts.isSpreadAssignment(property)) {
      const lineNumber = getLineNumber(sourceText, property.pos);
      errors.push(
        `${sourceFilePath}:${lineNumber} Analytics tracker params cannot use spread syntax.`,
      );
      continue;
    }

    if (ts.isShorthandPropertyAssignment(property)) {
      customParamKeys.push(property.name.text);
      continue;
    }

    if (!ts.isPropertyAssignment(property)) {
      const lineNumber = getLineNumber(sourceText, property.pos);
      errors.push(
        `${sourceFilePath}:${lineNumber} Analytics tracker params must use key/value assignments.`,
      );
      continue;
    }

    const paramName = getPropertyName(property.name);
    if (!paramName) {
      const lineNumber = getLineNumber(sourceText, property.pos);
      errors.push(
        `${sourceFilePath}:${lineNumber} Analytics tracker params must use static keys.`,
      );
      continue;
    }

    customParamKeys.push(paramName);
  }

  return customParamKeys;
}

function validateEventParams({
  sourceFilePath,
  sourceText,
  callExpressionNode,
  eventName,
  optionsArgumentNode,
  contractEventSpec,
  errors,
  trackerLabel,
  mergeFormKindFromTrackPublicFormOutcome,
}) {
  const requiredCustomParams = new Set(contractEventSpec.requiredCustomParams ?? []);
  const allowedCustomParams = new Set(contractEventSpec.allowedCustomParams ?? []);

  if (!optionsArgumentNode) {
    if (requiredCustomParams.size > 0) {
      const lineNumber = getLineNumber(sourceText, callExpressionNode.pos);
      errors.push(
        `${sourceFilePath}:${lineNumber} ${trackerLabel}("${eventName}") is missing required params: ${[...requiredCustomParams].join(', ')}`,
      );
    }
    return;
  }

  if (!ts.isObjectLiteralExpression(optionsArgumentNode)) {
    const lineNumber = getLineNumber(sourceText, optionsArgumentNode.pos);
    errors.push(
      `${sourceFilePath}:${lineNumber} ${trackerLabel} options must be an object literal for contract validation.`,
    );
    return;
  }

  const paramsPropertyNode = extractParamsObjectProperty(optionsArgumentNode);
  if (!paramsPropertyNode) {
    if (requiredCustomParams.size > 0) {
      const lineNumber = getLineNumber(sourceText, optionsArgumentNode.pos);
      errors.push(
        `${sourceFilePath}:${lineNumber} ${trackerLabel}("${eventName}") must provide params: ${[...requiredCustomParams].join(', ')}`,
      );
    }
    return;
  }

  const paramsInitializerNode = ts.isPropertyAssignment(paramsPropertyNode)
    ? paramsPropertyNode.initializer
    : paramsPropertyNode.name;
  const customParamKeys = extractCustomParamKeys(
    paramsInitializerNode,
    sourceFilePath,
    sourceText,
    errors,
  );
  const customParamKeySet = new Set(customParamKeys);

  if (mergeFormKindFromTrackPublicFormOutcome) {
    const staticFormKind = extractStaticFormKindFromOptions(optionsArgumentNode);
    if (staticFormKind) {
      customParamKeySet.add('form_kind');
    } else if (requiredCustomParams.has('form_kind')) {
      const lineNumber = getLineNumber(sourceText, optionsArgumentNode.pos);
      errors.push(
        `${sourceFilePath}:${lineNumber} ${trackerLabel}("${eventName}") requires a static string formKind option (merged into form_kind).`,
      );
    }
  }

  for (const requiredParam of requiredCustomParams) {
    if (!customParamKeySet.has(requiredParam)) {
      const lineNumber = getLineNumber(sourceText, paramsInitializerNode.pos);
      errors.push(
        `${sourceFilePath}:${lineNumber} ${trackerLabel}("${eventName}") missing required param "${requiredParam}".`,
      );
    }
  }

  for (const customParamKey of customParamKeySet) {
    if (!allowedCustomParams.has(customParamKey)) {
      const lineNumber = getLineNumber(sourceText, paramsInitializerNode.pos);
      errors.push(
        `${sourceFilePath}:${lineNumber} ${trackerLabel}("${eventName}") uses unsupported param "${customParamKey}".`,
      );
    }
  }
}

function validateSourceFileAgainstContract(sourceFilePath, sourceText, contract, errors) {
  const sourceFile = ts.createSourceFile(
    sourceFilePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourceFilePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const trackerName = node.expression.text;
      if (TRACKER_FUNCTION_NAMES.has(trackerName)) {
        const eventNameNode = node.arguments[0];
        const eventName = extractStaticEventName(eventNameNode);
        if (!eventName) {
          const lineNumber = getLineNumber(sourceText, node.pos);
          errors.push(
            `${sourceFilePath}:${lineNumber} ${trackerName} requires a static string event name.`,
          );
        } else {
          const contractEventSpec = contract.events[eventName];
          if (!contractEventSpec) {
            const lineNumber = getLineNumber(sourceText, node.pos);
            errors.push(
              `${sourceFilePath}:${lineNumber} ${trackerName}("${eventName}") is not defined in analytics-taxonomy.json.`,
            );
          } else {
            validateEventParams({
              sourceFilePath,
              sourceText,
              callExpressionNode: node,
              eventName,
              optionsArgumentNode: node.arguments[1],
              contractEventSpec,
              errors,
              trackerLabel: trackerName,
              mergeFormKindFromTrackPublicFormOutcome: trackerName === 'trackPublicFormOutcome',
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

async function main() {
  const contract = JSON.parse(await readFile(CONTRACT_PATH, 'utf8'));
  if (!contract?.events || typeof contract.events !== 'object') {
    throw new Error('analytics-taxonomy.json must define an "events" object.');
  }

  const sourceFiles = await collectSourceFiles(SRC_DIR);
  const errors = [];

  for (const sourceFile of sourceFiles) {
    const sourceText = await readFile(sourceFile, 'utf8');
    validateSourceFileAgainstContract(
      path.relative(path.resolve(__dirname, '..'), sourceFile),
      sourceText,
      contract,
      errors,
    );
  }

  if (errors.length > 0) {
    console.error('Analytics contract validation failed.');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Analytics contract validation passed.');
}

main().catch((error) => {
  console.error('Analytics contract validation crashed.');
  console.error(error);
  process.exit(1);
});
