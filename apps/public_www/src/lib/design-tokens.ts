import type { CSSProperties } from 'react';

export const TOKEN_FALLBACK_HEX = {
  '--es-color-brand-orange': '#C84A16',
  '--es-color-brand-orange-strong': '#E76C3D',
  '--es-color-brand-orange-soft': '#F2A975',
  '--es-color-brand-peach-bg': '#FFF0E5',
  '--es-color-brand-peach-border': '#EECAB0',
  '--es-color-surface-white': '#FFFFFF',
  '--es-color-text-heading': '#333333',
  '--es-color-text-icon': '#3D3E3D',
  '--es-color-text-neutral-strong': '#5A5A5A',
} as const;

export const HEADING_TEXT_COLOR =
  'var(--site-heading-text, var(--figma-colors-join-our-sprouts-squad-community, #333333))';
export const BODY_TEXT_COLOR = 'var(--site-primary-text, var(--figma-colors-home, #4A4A4A))';
export const BRAND_ORANGE = `var(--es-color-brand-orange, ${TOKEN_FALLBACK_HEX['--es-color-brand-orange']})`;
export const BRAND_ORANGE_STRONG = `var(--es-color-brand-orange-strong, ${TOKEN_FALLBACK_HEX['--es-color-brand-orange-strong']})`;
export const BRAND_ORANGE_SOFT = `var(--es-color-brand-orange-soft, ${TOKEN_FALLBACK_HEX['--es-color-brand-orange-soft']})`;
export const BRAND_PEACH_BG = `var(--es-color-brand-peach-bg, ${TOKEN_FALLBACK_HEX['--es-color-brand-peach-bg']})`;
export const BRAND_PEACH_BORDER = `var(--es-color-brand-peach-border, ${TOKEN_FALLBACK_HEX['--es-color-brand-peach-border']})`;
export const SURFACE_WHITE = `var(--es-color-surface-white, ${TOKEN_FALLBACK_HEX['--es-color-surface-white']})`;
export const TEXT_HEADING_STRONG = `var(--es-color-text-heading, ${TOKEN_FALLBACK_HEX['--es-color-text-heading']})`;
export const TEXT_ICON_COLOR = `var(--es-color-text-icon, ${TOKEN_FALLBACK_HEX['--es-color-text-icon']})`;
export const TEXT_NEUTRAL_STRONG_COLOR = `var(--es-color-text-neutral-strong, ${TOKEN_FALLBACK_HEX['--es-color-text-neutral-strong']})`;
export const HEADING_FONT_FAMILY =
  'var(--figma-fontfamilies-poppins, Poppins), sans-serif';
export const BODY_FONT_FAMILY = 'var(--figma-fontfamilies-lato, Lato), sans-serif';

export const DEFAULT_SECTION_EYEBROW_STYLE: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: BODY_FONT_FAMILY,
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1',
};

function mergeStyle(
  baseStyle: CSSProperties,
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
}

export function headingTextStyle(
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return mergeStyle(
    {
      color: HEADING_TEXT_COLOR,
      fontFamily: HEADING_FONT_FAMILY,
      fontWeight: 700,
      lineHeight: 1.2,
    },
    overrides,
  );
}

export function bodyTextStyle(
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return mergeStyle(
    {
      color: BODY_TEXT_COLOR,
      fontFamily: BODY_FONT_FAMILY,
      fontWeight: 400,
      lineHeight: 1.5,
    },
    overrides,
  );
}

export function eyebrowTextStyle(
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return mergeStyle(DEFAULT_SECTION_EYEBROW_STYLE, overrides);
}

export function ctaTextStyle(
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return mergeStyle(
    {
      fontFamily: BODY_FONT_FAMILY,
      fontWeight: 600,
      lineHeight: 1,
    },
    overrides,
  );
}
