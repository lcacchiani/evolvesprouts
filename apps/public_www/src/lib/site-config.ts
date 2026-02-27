const INSTAGRAM_URL_ENV_NAME = 'NEXT_PUBLIC_INSTAGRAM_URL';
const LINKEDIN_URL_ENV_NAME = 'NEXT_PUBLIC_LINKEDIN_URL';
const WHATSAPP_URL_ENV_NAME = 'NEXT_PUBLIC_WHATSAPP_URL';
const CONTACT_EMAIL_ENV_NAME = 'NEXT_PUBLIC_EMAIL';
const BUSINESS_ADDRESS_ENV_NAME = 'NEXT_PUBLIC_BUSINESS_ADDRESS';
const BUSINESS_PHONE_ENV_NAME = 'NEXT_PUBLIC_BUSINESS_PHONE_NUMBER';

export interface PublicSiteConfig {
  instagramUrl?: string;
  linkedinUrl?: string;
  whatsappUrl?: string;
  contactEmail?: string;
  businessAddress?: string;
  businessPhoneNumber?: string;
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

function parseConfiguredUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAllowedPublicUrl(url: URL): boolean {
  const protocol = url.protocol.toLowerCase();
  if (protocol === 'https:') {
    return true;
  }

  return protocol === 'http:' && url.hostname.toLowerCase() === 'localhost';
}

function normalizeConfiguredUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsedUrl = parseConfiguredUrl(value);
  if (!parsedUrl || !isAllowedPublicUrl(parsedUrl)) {
    return undefined;
  }

  return parsedUrl.toString();
}

function normalizeConfiguredEmail(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function buildWhatsappPrefilledHref(
  baseWhatsappUrl: string | undefined,
  message: string | undefined,
): string {
  const normalizedBaseUrl = normalizeConfiguredUrl(baseWhatsappUrl);
  if (!normalizedBaseUrl) {
    return '';
  }

  const parsedUrl = parseConfiguredUrl(normalizedBaseUrl);
  if (!parsedUrl) {
    return '';
  }

  const normalizedMessage = message?.trim() ?? '';
  if (normalizedMessage) {
    parsedUrl.searchParams.set('text', normalizedMessage);
  }

  return parsedUrl.toString();
}

export function resolvePublicSiteConfig(): PublicSiteConfig {
  return {
    instagramUrl: normalizeConfiguredUrl(readOptionalEnv(INSTAGRAM_URL_ENV_NAME)),
    linkedinUrl: normalizeConfiguredUrl(readOptionalEnv(LINKEDIN_URL_ENV_NAME)),
    whatsappUrl: normalizeConfiguredUrl(readOptionalEnv(WHATSAPP_URL_ENV_NAME)),
    contactEmail: normalizeConfiguredEmail(readOptionalEnv(CONTACT_EMAIL_ENV_NAME)),
    businessAddress: readOptionalEnv(BUSINESS_ADDRESS_ENV_NAME),
    businessPhoneNumber: readOptionalEnv(BUSINESS_PHONE_ENV_NAME),
  };
}
