/**
 * Fails if required NEXT_PUBLIC_* vars for training poll persistence are unset or invalid.
 * Keep in sync with `.github/workflows/deploy-training.yml` build env.
 */
const API_BASE_URL_ENV = 'NEXT_PUBLIC_API_BASE_URL';
const TRAINING_API_KEY_ENV = 'NEXT_PUBLIC_TRAINING_API_KEY';
const WWW_CRM_API_KEY_ENV = 'NEXT_PUBLIC_WWW_CRM_API_KEY';
const WWW_PREFIX = '/www';

function isValidPollApiBaseUrl(raw) {
  const value = raw.trim();
  if (!value) {
    return false;
  }
  if (value === WWW_PREFIX || value.startsWith(`${WWW_PREFIX}/`)) {
    return true;
  }
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/$/, '') || '';
    return pathname === WWW_PREFIX;
  } catch {
    return false;
  }
}

let failed = false;

const apiBaseUrl = process.env[API_BASE_URL_ENV]?.trim() ?? '';
if (!isValidPollApiBaseUrl(apiBaseUrl)) {
  console.error(
    `Invalid ${API_BASE_URL_ENV}: must be "/www" or an absolute URL whose path is "/www" (got "${apiBaseUrl}")`,
  );
  failed = true;
}

const apiKey =
  process.env[TRAINING_API_KEY_ENV]?.trim() ||
  process.env[WWW_CRM_API_KEY_ENV]?.trim() ||
  '';
if (!apiKey) {
  console.error(
    `Missing or empty required env: ${TRAINING_API_KEY_ENV} (or ${WWW_CRM_API_KEY_ENV})`,
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}
