export interface AppConfig {
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoUserPoolId: string;
  adminApiBaseUrl: string;
}

export const appConfig: AppConfig = {
  cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? '',
  cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
  cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
  adminApiBaseUrl: process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? '',
};

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeAdminApiBaseUrl(value: string): string {
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

export function getAdminApiConfigError(): string {
  if (!appConfig.adminApiBaseUrl.trim()) {
    return 'NEXT_PUBLIC_ADMIN_API_BASE_URL is missing.';
  }

  const normalizedBaseUrl = normalizeAdminApiBaseUrl(appConfig.adminApiBaseUrl);
  if (!normalizedBaseUrl) {
    return 'NEXT_PUBLIC_ADMIN_API_BASE_URL is invalid. Use an absolute URL or relative path.';
  }

  return '';
}

export function getAdminApiBaseUrl(): string {
  const configError = getAdminApiConfigError();
  if (configError) {
    throw new Error(configError);
  }
  return normalizeAdminApiBaseUrl(appConfig.adminApiBaseUrl);
}
