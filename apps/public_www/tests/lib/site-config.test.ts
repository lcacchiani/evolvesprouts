import { afterEach, describe, expect, it } from 'vitest';

import {
  buildWhatsappPrefilledHref,
  resolvePublicSiteConfig,
} from '@/lib/site-config';

const ENV_KEYS = [
  'NEXT_PUBLIC_EMAIL',
  'NEXT_PUBLIC_WHATSAPP_URL',
  'NEXT_PUBLIC_INSTAGRAM_URL',
  'NEXT_PUBLIC_LINKEDIN_URL',
] as const;
const originalEnvValues = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

afterEach(() => {
  for (const key of ENV_KEYS) {
    const originalValue = originalEnvValues[key];
    if (typeof originalValue === 'string') {
      process.env[key] = originalValue;
    } else {
      delete process.env[key];
    }
  }
});

describe('site-config', () => {
  it('builds a direct wa.me/<phone> href when base URL is a short link and phone is provided', () => {
    const href = buildWhatsappPrefilledHref(
      'https://wa.me/message/ABCDEFG?src=qr',
      "Hi, I'd like to book a free session!",
      '+852 9876 5432',
    );

    const parsed = new URL(href);
    expect(parsed.pathname).toBe('/85298765432');
    expect(parsed.searchParams.get('text')).toBe(
      "Hi, I'd like to book a free session!",
    );
  });

  it('returns the short link URL unchanged when no phone number is provided', () => {
    const href = buildWhatsappPrefilledHref(
      'https://wa.me/message/ABCDEFG?src=qr',
      "Hi, I'd like to book a free session!",
    );

    const parsed = new URL(href);
    expect(parsed.pathname).toBe('/message/ABCDEFG');
    expect(parsed.searchParams.get('src')).toBe('qr');
    expect(parsed.searchParams.has('text')).toBe(false);
  });

  it('appends text param to direct wa.me/<phone> URLs without needing a separate phone number', () => {
    const href = buildWhatsappPrefilledHref(
      'https://wa.me/85298765432',
      'Hello!',
    );

    const parsed = new URL(href);
    expect(parsed.pathname).toBe('/85298765432');
    expect(parsed.searchParams.get('text')).toBe('Hello!');
  });

  it('returns an empty value when the base WhatsApp URL is invalid', () => {
    expect(buildWhatsappPrefilledHref('/contact-us', 'hello')).toBe('');
  });

  it('returns configured contact email when NEXT_PUBLIC_EMAIL is valid', () => {
    process.env.NEXT_PUBLIC_EMAIL = 'hello@example.com';

    const siteConfig = resolvePublicSiteConfig();
    expect(siteConfig.contactEmail).toBe('hello@example.com');
  });

  it('returns no contact email when NEXT_PUBLIC_EMAIL is invalid', () => {
    process.env.NEXT_PUBLIC_EMAIL = 'not-an-email';

    const siteConfig = resolvePublicSiteConfig();
    expect(siteConfig.contactEmail).toBeUndefined();
  });

  it('normalizes schemeless social URLs by prepending https', () => {
    process.env.NEXT_PUBLIC_WHATSAPP_URL = 'wa.me/message/ZQHVW4DEORD5A1?src=qr';
    process.env.NEXT_PUBLIC_INSTAGRAM_URL = 'instagram.com/evolvesprouts';
    process.env.NEXT_PUBLIC_LINKEDIN_URL = 'www.linkedin.com/company/evolve-sprouts';

    const siteConfig = resolvePublicSiteConfig();
    expect(siteConfig.whatsappUrl).toBe('https://wa.me/message/ZQHVW4DEORD5A1?src=qr');
    expect(siteConfig.instagramUrl).toBe('https://instagram.com/evolvesprouts');
    expect(siteConfig.linkedinUrl).toBe('https://www.linkedin.com/company/evolve-sprouts');
  });

  it('rejects schemeless values that are not host-like URLs', () => {
    process.env.NEXT_PUBLIC_WHATSAPP_URL = 'not-a-url';

    const siteConfig = resolvePublicSiteConfig();
    expect(siteConfig.whatsappUrl).toBeUndefined();
  });
});
