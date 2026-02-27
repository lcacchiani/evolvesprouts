import { describe, expect, it } from 'vitest';

import { buildWhatsappPrefilledHref } from '@/lib/site-config';

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
});
