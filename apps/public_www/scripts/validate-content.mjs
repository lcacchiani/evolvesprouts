import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENT_DIR = path.resolve(__dirname, '..', 'src', 'content');
const LOCALE_APP_DIR = path.resolve(__dirname, '..', 'src', 'app', '[locale]');

const LOCALE_FILES = [
  ['en', 'en.json'],
  ['zh-CN', 'zh-CN.json'],
  ['zh-HK', 'zh-HK.json'],
];
const CONTACT_EMAIL_ENV_NAME = 'NEXT_PUBLIC_EMAIL';
const STRIPE_PUBLISHABLE_KEY_ENV_NAME = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY';
const CONTACT_EMAIL_PLACEHOLDER = '{{CONTACT_EMAIL}}';
const CONTACT_EMAIL_MAILTO_PLACEHOLDER = `mailto:${CONTACT_EMAIL_PLACEHOLDER}`;
const WHATSAPP_URL_PLACEHOLDER = '{{WHATSAPP_URL}}';
const INSTAGRAM_URL_PLACEHOLDER = '{{INSTAGRAM_URL}}';
const EMAIL_VALUE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_VALUE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;
const DANGEROUS_HREF_PROTOCOL_REGEX = /^(javascript|data|vbscript|file|blob):/i;
const PROTOCOL_RELATIVE_URL_REGEX = /^\/\//;
const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSTANCE_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAILTO_PROTOCOL_REGEX = /^mailto:/i;
const TEL_PROTOCOL_REGEX = /^tel:/i;
const GENERIC_SOCIAL_PROFILE_ROOT_REGEX =
  /^https:\/\/(?:www\.)?(linkedin\.com|instagram\.com)\/?$/i;
const DISALLOWED_SECTION_ROOT_KEYS = {
  hero: ['headline', 'subheadline', 'supportingParagraph'],
  'aboutUs.intro': ['heading', 'body'],
  'myBestAuntie.hero': ['body'],
  sproutsSquadCommunity: ['heading', 'supportParagraph'],
  freeIntroSession: ['heading', 'supportParagraph'],
  termsAndConditions: ['intro'],
  privacyPolicy: ['intro'],
};

function readObjectAtPath(source, sectionPath) {
  const pathSegments = sectionPath.split('.');
  let currentValue = source;

  for (const segment of pathSegments) {
    if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) {
      return null;
    }
    currentValue = currentValue[segment];
  }

  if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) {
    return null;
  }

  return currentValue;
}

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

function validateShape(referenceValue, candidateValue, keyPath, errors) {
  const referenceType = getTypeName(referenceValue);
  const candidateType = getTypeName(candidateValue);

  validateType(referenceValue, candidateValue, keyPath, errors);
  if (referenceType !== candidateType) {
    return;
  }

  if (referenceType === 'array') {
    const referenceArray = referenceValue;
    const candidateArray = candidateValue;

    if (referenceArray.length === 0) {
      return;
    }

    if (candidateArray.length === 0) {
      return;
    }

    const referenceItemTypes = new Set(referenceArray.map((item) => getTypeName(item)));

    for (let index = 0; index < candidateArray.length; index += 1) {
      const candidateItem = candidateArray[index];
      const candidateItemType = getTypeName(candidateItem);

      if (!referenceItemTypes.has(candidateItemType)) {
        errors.push(
          `${keyPath}[${index}]: unexpected item type "${candidateItemType}"`,
        );
        continue;
      }

      if (candidateItemType === 'array') {
        const referenceArrayItem = referenceArray.find(
          (item) => getTypeName(item) === 'array',
        );
        if (referenceArrayItem) {
          validateShape(
            referenceArrayItem,
            candidateItem,
            `${keyPath}[${index}]`,
            errors,
          );
        }
      }

      if (candidateItemType === 'object' && referenceArray.length === 1) {
        validateShape(referenceArray[0], candidateItem, `${keyPath}[${index}]`, errors);
      }
    }

    return;
  }

  if (referenceType !== 'object') {
    return;
  }

  const referenceRecord = referenceValue;
  const candidateRecord = candidateValue;
  const referenceKeys = Object.keys(referenceRecord);
  const candidateKeys = Object.keys(candidateRecord);

  for (const key of referenceKeys) {
    if (!(key in candidateRecord)) {
      errors.push(`${keyPath}: missing key "${key}"`);
      continue;
    }

    validateShape(
      referenceRecord[key],
      candidateRecord[key],
      `${keyPath}.${key}`,
      errors,
    );
  }

  for (const key of candidateKeys) {
    if (!(key in referenceRecord)) {
      errors.push(`${keyPath}: unexpected key "${key}"`);
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

function validateEmailValue(value, keyPath, errors) {
  const normalizedValue = value.trim();
  if (normalizedValue === CONTACT_EMAIL_PLACEHOLDER) {
    return;
  }

  if (!EMAIL_VALUE_REGEX.test(normalizedValue)) {
    errors.push(`${keyPath}: invalid email value "${normalizedValue}"`);
  }
}

function validateHrefValue(value, keyPath, errors) {
  const normalizedValue = value.trim();
  if (normalizedValue === CONTACT_EMAIL_MAILTO_PLACEHOLDER) {
    return;
  }
  if (normalizedValue === WHATSAPP_URL_PLACEHOLDER) {
    if (
      keyPath.endsWith('.navbar.bookNow.href')
      || keyPath.endsWith('.freeIntroSession.ctaHref')
    ) {
      return;
    }
    errors.push(
      `${keyPath}: placeholder "${WHATSAPP_URL_PLACEHOLDER}" is only allowed for navbar.bookNow.href and freeIntroSession.ctaHref`,
    );
    return;
  }
  if (normalizedValue === INSTAGRAM_URL_PLACEHOLDER) {
    if (keyPath.includes('.contactUs.connect.cards[')) {
      return;
    }
    errors.push(
      `${keyPath}: placeholder "${INSTAGRAM_URL_PLACEHOLDER}" is only allowed in contactUs.connect.cards`,
    );
    return;
  }

  if (!normalizedValue) {
    errors.push(`${keyPath}: href cannot be empty`);
    return;
  }
  if (
    DANGEROUS_HREF_PROTOCOL_REGEX.test(normalizedValue) ||
    PROTOCOL_RELATIVE_URL_REGEX.test(normalizedValue)
  ) {
    errors.push(`${keyPath}: unsafe href protocol "${normalizedValue}"`);
    return;
  }
  if (normalizedValue.startsWith('#') || normalizedValue.startsWith('/')) {
    return;
  }

  if (MAILTO_PROTOCOL_REGEX.test(normalizedValue)) {
    const targetValue = normalizedValue.slice('mailto:'.length).split('?')[0]?.trim() ?? '';
    if (!EMAIL_VALUE_REGEX.test(targetValue)) {
      errors.push(`${keyPath}: invalid mailto target "${normalizedValue}"`);
    }
    return;
  }

  if (TEL_PROTOCOL_REGEX.test(normalizedValue)) {
    const phoneValue = normalizedValue.slice('tel:'.length).split('?')[0]?.trim() ?? '';
    if (!PHONE_VALUE_REGEX.test(phoneValue)) {
      errors.push(`${keyPath}: invalid tel target "${normalizedValue}"`);
    }
    return;
  }

  if (HTTP_PROTOCOL_REGEX.test(normalizedValue)) {
    let parsedUrl;
    try {
      parsedUrl = new URL(normalizedValue);
    } catch {
      errors.push(`${keyPath}: invalid URL "${normalizedValue}"`);
      return;
    }

    const protocol = parsedUrl.protocol.toLowerCase();
    const hostname = parsedUrl.hostname.toLowerCase();
    if (protocol === 'https:') {
      return;
    }
    if (protocol === 'http:' && hostname === 'localhost') {
      return;
    }

    errors.push(`${keyPath}: external URLs must use https "${normalizedValue}"`);
    return;
  }

  errors.push(`${keyPath}: unsupported href format "${normalizedValue}"`);
}

function validateConfiguredContactEmail(errors) {
  const normalizedValue = process.env[CONTACT_EMAIL_ENV_NAME]?.trim() ?? '';
  if (!EMAIL_VALUE_REGEX.test(normalizedValue)) {
    errors.push(
      `${CONTACT_EMAIL_ENV_NAME} must be configured with a valid email address for content interpolation.`,
    );
  }
}

function validateConfiguredStripePublishableKey(errors) {
  const normalizedValue = process.env[STRIPE_PUBLISHABLE_KEY_ENV_NAME]?.trim() ?? '';
  if (!normalizedValue) {
    errors.push(
      `${STRIPE_PUBLISHABLE_KEY_ENV_NAME} must be configured for Stripe payment initialization.`,
    );
    return;
  }
  if (!normalizedValue.startsWith('pk_')) {
    errors.push(
      `${STRIPE_PUBLISHABLE_KEY_ENV_NAME} must be a valid Stripe publishable key (expected prefix "pk_").`,
    );
  }
}

function normalizeInternalRoutePath(value) {
  let parsedUrl;
  try {
    parsedUrl = new URL(value, 'https://example.com');
  } catch {
    return null;
  }

  return parsedUrl.pathname.replace(/\/+$/, '') || '/';
}

async function collectLocaleRoutePaths(directory = LOCALE_APP_DIR) {
  const entries = await readdir(directory, { withFileTypes: true });
  const routePaths = new Set();

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedPaths = await collectLocaleRoutePaths(absolutePath);
      for (const nestedPath of nestedPaths) {
        routePaths.add(nestedPath);
      }
      continue;
    }

    if (!entry.isFile() || entry.name !== 'page.tsx') {
      continue;
    }

    const relativePath = path
      .relative(LOCALE_APP_DIR, absolutePath)
      .replaceAll('\\', '/');

    if (relativePath === 'page.tsx') {
      routePaths.add('/');
      continue;
    }

    routePaths.add(`/${relativePath.slice(0, -'/page.tsx'.length)}`);
  }

  return routePaths;
}

function validateInternalRouteHref(value, keyPath, errors, routePaths) {
  const normalizedValue = value.trim();
  if (normalizedValue.startsWith('#') || !normalizedValue.startsWith('/')) {
    return;
  }

  const normalizedPath = normalizeInternalRoutePath(normalizedValue);
  if (!normalizedPath) {
    errors.push(`${keyPath}: invalid internal href "${normalizedValue}"`);
    return;
  }

  if (!routePaths.has(normalizedPath)) {
    errors.push(
      `${keyPath}: unknown internal route "${normalizedValue}" (normalized path "${normalizedPath}")`,
    );
  }
}

function isNavigationOrFooterHrefPath(keyPath) {
  return (
    keyPath.includes('.navbar.menuItems[')
    || keyPath.includes('.footer.quickLinks.items[')
    || keyPath.includes('.footer.services.items[')
    || keyPath.includes('.footer.aboutUs.items[')
    || keyPath.includes('.footer.connectOn.items[')
  );
}

function validateSeoHrefPolicy(value, keyPath, errors) {
  const normalizedValue = value.trim();

  if (normalizedValue === '#' && isNavigationOrFooterHrefPath(keyPath)) {
    errors.push(`${keyPath}: placeholder href "#" is not allowed in navigation/footer links`);
  }

  if (
    keyPath.includes('.footer.connectOn.items[')
    && GENERIC_SOCIAL_PROFILE_ROOT_REGEX.test(normalizedValue)
  ) {
    errors.push(
      `${keyPath}: generic social root URL is not allowed; configure the company profile URL or use an internal fallback`,
    );
  }
}

function validateSemanticRules(value, keyPath, errors, routePaths) {
  if (typeof value === 'string') {
    const keyName = keyPath.split('.').pop()?.toLowerCase() ?? '';
    if (keyName === 'href' || keyName.endsWith('href')) {
      validateHrefValue(value, keyPath, errors);
      validateInternalRouteHref(value, keyPath, errors, routePaths);
      validateSeoHrefPolicy(value, keyPath, errors);
    }
    if (
      keyName === 'email' ||
      keyName.endsWith('email') ||
      keyName === 'emailaddress'
    ) {
      validateEmailValue(value, keyPath, errors);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      validateSemanticRules(value[index], `${keyPath}[${index}]`, errors, routePaths);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = keyPath ? `${keyPath}.${key}` : key;
    validateSemanticRules(nestedValue, nestedPath, errors, routePaths);
  }
}

function validateNoDisallowedSectionRootKeys(content, locale, errors) {
  for (const [sectionPath, disallowedKeys] of Object.entries(DISALLOWED_SECTION_ROOT_KEYS)) {
    const sectionValue = readObjectAtPath(content, sectionPath);
    if (!sectionValue) {
      errors.push(`${locale}: missing or invalid section "${sectionPath}"`);
      continue;
    }

    for (const disallowedKey of disallowedKeys) {
      if (disallowedKey in sectionValue) {
        errors.push(
          `${locale}.${sectionPath}: key "${disallowedKey}" is not allowed; use canonical copy keys`,
        );
      }
    }
  }
}

async function loadJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateMyBestAuntieTrainingCourses(filePath, data, errors) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push(`${filePath}: root must be an object`);
    return;
  }
  if (data.status !== 'success') {
    errors.push(`${filePath}: expected status "success"`);
  }
  if (!Array.isArray(data.data)) {
    errors.push(`${filePath}: expected data array`);
    return;
  }
  for (let index = 0; index < data.data.length; index += 1) {
    const cohort = data.data[index];
    const prefix = `${filePath}: data[${index}]`;
    if (!cohort || typeof cohort !== 'object' || Array.isArray(cohort)) {
      errors.push(`${prefix}: cohort must be an object`);
      continue;
    }
    const slug = cohort.slug;
    if (typeof slug !== 'string' || !slug.trim()) {
      errors.push(`${prefix}: slug must be a non-empty string`);
      continue;
    }
    if (!INSTANCE_SLUG_REGEX.test(slug.trim())) {
      errors.push(`${prefix}: slug must match the public instance slug pattern`);
    }
    const dates = cohort.dates;
    if (!Array.isArray(dates) || dates.length === 0) {
      errors.push(`${prefix}: dates must be a non-empty array`);
      continue;
    }
    const parts = [];
    for (let d = 0; d < dates.length; d += 1) {
      const slot = dates[d];
      const slotPrefix = `${prefix}.dates[${d}]`;
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
        errors.push(`${slotPrefix}: must be an object`);
        continue;
      }
      const part = slot.part;
      if (typeof part !== 'number' || !Number.isInteger(part) || part < 1) {
        errors.push(`${slotPrefix}: part must be an integer >= 1`);
      } else {
        parts.push(part);
      }
      for (const key of ['start_datetime', 'end_datetime']) {
        if (typeof slot[key] !== 'string' || !slot[key].trim()) {
          errors.push(`${slotPrefix}: ${key} must be a non-empty string`);
        }
      }
    }
    const sorted = [...parts].sort((a, b) => a - b);
    const expected = Array.from({ length: sorted.length }, (_, i) => i + 1);
    const matches =
      sorted.length === expected.length && sorted.every((v, i) => v === expected[i]);
    if (!matches) {
      errors.push(
        `${prefix}: dates[].part values must be the dense sequence 1..N with no gaps or duplicates`,
      );
    }
  }
}

async function main() {
  const localeRoutePaths = await collectLocaleRoutePaths();
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

  validateConfiguredContactEmail(errors);
  validateConfiguredStripePublishableKey(errors);

  const mbaCoursesPath = path.join(CONTENT_DIR, 'my-best-auntie-training-courses.json');
  const mbaCourses = await loadJson(mbaCoursesPath);
  validateMyBestAuntieTrainingCourses('my-best-auntie-training-courses.json', mbaCourses, errors);

  for (const [locale] of LOCALE_FILES) {
    const localeContent = localeMap[locale];
    validateShape(englishContent, localeContent, locale, errors);
    assertLocaleMetadata(localeContent, locale, errors);
    validateSemanticRules(localeContent, locale, errors, localeRoutePaths);
    validateNoDisallowedSectionRootKeys(localeContent, locale, errors);
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
