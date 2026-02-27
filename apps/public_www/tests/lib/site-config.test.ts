import { afterEach, describe, expect, it } from 'vitest';

import {
  buildWhatsappPrefilledHref,
  resolvePublicSiteConfig,
} from '@/lib/site-config';

const CONTACT_EMAIL_ENV_NAME = 'NEXT_PUBLIC_EMAIL';
const originalContactEmail = process.env[CONTACT_EMAIL_ENV_NAME];

afterEach(() => {
  if (typeof originalContactEmail === 'string') {
    process.env[CONTACT_EMAIL_ENV_NAME] = originalContactEmail;
    return;
  }

  delete process.env[CONTACT_EMAIL_ENV_NAME];
});

describe('site-config', () => {
  it('builds a WhatsApp href with prefilled text while preserving existing query params', () => {
    const href = buildWhatsappPrefilledHref(
      'https://wa.me/message/ABCDEFG?src=qr',
      "Hi, I'd like to book a free session!",
    );

    const parsed = new URL(href);
    expect(parsed.searchParams.get('src')).toBe('qr');
    expect(parsed.searchParams.get('text')).toBe(
      "Hi, I'd like to book a free session!",
    );
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
});
