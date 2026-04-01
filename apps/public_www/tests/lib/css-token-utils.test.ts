import { afterEach, describe, expect, it } from 'vitest';

import { parseHexColorRgb, resolveCssColorToken, rgbaFromCssColor } from '@/lib/css-token-utils';

describe('css-token-utils', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('resolveCssColorToken reads custom property from document root', () => {
    document.documentElement.style.setProperty('--test-token', '#aabbcc');
    expect(resolveCssColorToken('--test-token', '#000000')).toBe('#aabbcc');
  });

  it('resolveCssColorToken returns fallback when variable is unset', () => {
    expect(resolveCssColorToken('--unset-test-token-xyz', '#112233')).toBe('#112233');
  });

  it('parseHexColorRgb parses 6-digit and 3-digit hex', () => {
    expect(parseHexColorRgb('#C84A16')).toEqual({ r: 200, g: 74, b: 22 });
    expect(parseHexColorRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseHexColorRgb('not-hex')).toBeNull();
  });

  it('rgbaFromCssColor builds rgba from hex', () => {
    expect(rgbaFromCssColor('#C84A16', 0.55, { r: 0, g: 0, b: 0 })).toBe(
      'rgba(200, 74, 22, 0.55)',
    );
  });
});
