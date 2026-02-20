import { describe, expect, it } from 'vitest';

import {
  BODY_FONT_FAMILY,
  BODY_TEXT_COLOR,
  BRAND_ORANGE,
  BRAND_ORANGE_SOFT,
  BRAND_ORANGE_STRONG,
  HEADING_FONT_FAMILY,
  HEADING_TEXT_COLOR,
  TOKEN_FALLBACK_HEX,
} from '@/lib/design-tokens';

describe('design tokens constants', () => {
  it('exposes expected fallback token values', () => {
    expect(TOKEN_FALLBACK_HEX['--es-color-brand-orange']).toBe('#C84A16');
    expect(TOKEN_FALLBACK_HEX['--es-color-brand-orange-soft']).toBe('#F2A975');
    expect(TOKEN_FALLBACK_HEX['--es-color-brand-orange-strong']).toBe('#ED622E');
  });

  it('builds CSS var expressions with stable fallback values', () => {
    expect(BRAND_ORANGE).toContain('var(--es-color-brand-orange');
    expect(BRAND_ORANGE).toContain('#C84A16');
    expect(BRAND_ORANGE_SOFT).toContain('#F2A975');
    expect(BRAND_ORANGE_STRONG).toContain('#ED622E');
    expect(HEADING_TEXT_COLOR).toContain('var(--site-heading-text');
    expect(BODY_TEXT_COLOR).toContain('var(--site-primary-text');
  });

  it('keeps typography token references available to components', () => {
    expect(HEADING_FONT_FAMILY).toContain('--figma-fontfamilies-poppins');
    expect(BODY_FONT_FAMILY).toContain('--figma-fontfamilies-lato');
  });
});
