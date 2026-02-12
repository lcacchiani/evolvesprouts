import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENT_DIR = path.resolve(__dirname, '..', 'src', 'content');

const LOCALE_FILES = [
  ['en', 'en.json'],
  ['zh-CN', 'zh-CN.json'],
  ['zh-HK', 'zh-HK.json'],
];

function getTypeName(value) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function validateType(referenceValue, candidateValue, keyPath, errors) {
  const referenceType = getTypeName(referenceValue);
  const candidateType = getTypeName(candidateValue);
  if (referenceType !== candidateType) {
    errors.push(
      `${keyPath}: expected ${referenceType}, received ${candidateType}`,
    );
  }
}

function validateTopLevelShape(reference, candidate, locale, errors) {
  const referenceKeys = Object.keys(reference);
  const candidateKeys = Object.keys(candidate);

  for (const key of referenceKeys) {
    if (!(key in candidate)) {
      errors.push(`${locale}: missing top-level key "${key}"`);
      continue;
    }

    validateType(reference[key], candidate[key], `${locale}.${key}`, errors);
  }

  for (const key of candidateKeys) {
    if (!(key in reference)) {
      errors.push(`${locale}: unexpected top-level key "${key}"`);
    }
  }
}

function assertLocaleMetadata(content, locale, errors) {
  if (!content.meta || typeof content.meta !== 'object') {
    errors.push(`${locale}: missing "meta" object`);
    return;
  }

  if (content.meta.locale !== locale) {
    errors.push(
      `${locale}: meta.locale must equal "${locale}", received "${content.meta.locale}"`,
    );
  }
}

async function loadJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const loadedEntries = await Promise.all(
    LOCALE_FILES.map(async ([locale, filename]) => {
      const filePath = path.join(CONTENT_DIR, filename);
      const content = await loadJson(filePath);
      return [locale, content];
    }),
  );

  const localeMap = Object.fromEntries(loadedEntries);
  const englishContent = localeMap.en;
  const errors = [];

  for (const [locale] of LOCALE_FILES) {
    const localeContent = localeMap[locale];
    validateTopLevelShape(englishContent, localeContent, locale, errors);
    assertLocaleMetadata(localeContent, locale, errors);
  }

  if (errors.length > 0) {
    console.error('Content validation failed.');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Content validation passed.');
}

main().catch((error) => {
  console.error('Content validation crashed.');
  console.error(error);
  process.exit(1);
});
