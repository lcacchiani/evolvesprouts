export interface AppConfig {
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoUserPoolId: string;
  apiBaseUrl: string;
  publicSiteBaseUrl: string;
}

export const appConfig: AppConfig = {
  cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? '',
  cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
  cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  publicSiteBaseUrl: process.env.NEXT_PUBLIC_PUBLIC_SITE_BASE_URL ?? '',
};

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('/')) {
    const normalizedPath = `/${trimmed.replace(/^\/+/, '')}`;
    return trimTrailingSlashes(normalizedPath);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return '';
  }

  if (!['https:', 'http:'].includes(parsedUrl.protocol.toLowerCase())) {
    return '';
  }

  return trimTrailingSlashes(`${parsedUrl.origin}${parsedUrl.pathname}`);
}

export function getConfigErrors() {
  const errors: string[] = [];
  if (!appConfig.cognitoDomain.trim()) {
    errors.push('NEXT_PUBLIC_COGNITO_DOMAIN is missing.');
  }
  if (!appConfig.cognitoClientId.trim()) {
    errors.push('NEXT_PUBLIC_COGNITO_CLIENT_ID is missing.');
  }
  if (!appConfig.cognitoUserPoolId.trim()) {
    errors.push('NEXT_PUBLIC_COGNITO_USER_POOL_ID is missing.');
  }
  return errors;
}

export function getCognitoDomain() {
  const trimmed = appConfig.cognitoDomain.trim();
  if (!trimmed) {
    throw new Error('Cognito domain is not configured.');
  }
  const withScheme = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  return trimTrailingSlashes(withScheme);
}

export function getApiConfigError(): string {
  if (!appConfig.apiBaseUrl.trim()) {
    return 'NEXT_PUBLIC_API_BASE_URL is missing.';
  }

  const normalizedBaseUrl = normalizeApiBaseUrl(appConfig.apiBaseUrl);
  if (!normalizedBaseUrl) {
    return 'NEXT_PUBLIC_API_BASE_URL is invalid. Use an absolute URL or relative path.';
  }

  return '';
}

export function getApiBaseUrl(): string {
  const configError = getApiConfigError();
  if (configError) {
    throw new Error(configError);
  }
  return normalizeApiBaseUrl(appConfig.apiBaseUrl);
}

const FALLBACK_ADMIN_DEFAULT_CURRENCY = 'HKD';

/**
 * ISO 4217 code for admin UI defaults (expense currency, vendor spend column, FX target).
 * Set `NEXT_PUBLIC_ADMIN_DEFAULT_CURRENCY` (e.g. HKD). Invalid or empty values fall back to HKD.
 */
export function getPublicSiteBaseUrl(): string {
  const raw = appConfig.publicSiteBaseUrl.trim();
  if (!raw) {
    return '';
  }
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (!['https:', 'http:'].includes(parsed.protocol.toLowerCase())) {
      return '';
    }
    return trimTrailingSlashes(`${parsed.origin}${parsed.pathname}`);
  } catch {
    return '';
  }
}

export function getAdminDefaultCurrencyCode(): string {
  const raw = process.env.NEXT_PUBLIC_ADMIN_DEFAULT_CURRENCY?.trim().toUpperCase();
  if (raw && /^[A-Z]{3}$/.test(raw)) {
    return raw;
  }
  return FALLBACK_ADMIN_DEFAULT_CURRENCY;
}
