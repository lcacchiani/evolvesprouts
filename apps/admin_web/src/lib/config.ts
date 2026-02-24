export interface AppConfig {
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoUserPoolId: string;
}

export const appConfig: AppConfig = {
  cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? '',
  cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
  cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
};

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
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
