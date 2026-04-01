import { describe, expect, it } from 'vitest';

import {
  SITE_PRIMARY_FONT_STACK,
  STRIPE_APPEARANCE_CSS_VARS,
  STRIPE_APPEARANCE_FALLBACK_HEX,
} from '@/lib/design-tokens';

describe('design-tokens', () => {
  it('maps every Stripe appearance CSS var to a fallback hex', () => {
    for (const key of Object.keys(STRIPE_APPEARANCE_CSS_VARS) as Array<
      keyof typeof STRIPE_APPEARANCE_CSS_VARS
    >) {
      expect(STRIPE_APPEARANCE_CSS_VARS[key].startsWith('--')).toBe(true);
      expect(STRIPE_APPEARANCE_FALLBACK_HEX[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(Object.keys(STRIPE_APPEARANCE_CSS_VARS).length).toBe(
      Object.keys(STRIPE_APPEARANCE_FALLBACK_HEX).length,
    );
  });

  it('exports a non-empty Stripe font stack string', () => {
    expect(SITE_PRIMARY_FONT_STACK.length).toBeGreaterThan(10);
    expect(SITE_PRIMARY_FONT_STACK).toContain('Lato');
  });
});
