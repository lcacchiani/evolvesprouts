export const TOKEN_FALLBACK_HEX = {
  '--es-color-brand-orange': '#C84A16',
  '--es-color-brand-orange-strong': '#ED622E',
  '--es-color-brand-orange-soft': '#F2A975',
  '--es-color-brand-peach-bg': '#FFF0E5',
  '--es-color-brand-peach-border': '#EECAB0',
  '--es-color-booking-highlight-icon': '#B42318',
  '--es-color-border-date': '#CAD6E5',
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
export const BOOKING_HIGHLIGHT_ICON_COLOR = `var(--es-color-booking-highlight-icon, ${TOKEN_FALLBACK_HEX['--es-color-booking-highlight-icon']})`;
export const BORDER_DATE_COLOR = `var(--es-color-border-date, ${TOKEN_FALLBACK_HEX['--es-color-border-date']})`;
export const SURFACE_WHITE = `var(--es-color-surface-white, ${TOKEN_FALLBACK_HEX['--es-color-surface-white']})`;
export const TEXT_HEADING_STRONG = `var(--es-color-text-heading, ${TOKEN_FALLBACK_HEX['--es-color-text-heading']})`;
export const TEXT_ICON_COLOR = `var(--es-color-text-icon, ${TOKEN_FALLBACK_HEX['--es-color-text-icon']})`;
export const TEXT_NEUTRAL_STRONG_COLOR = `var(--es-color-text-neutral-strong, ${TOKEN_FALLBACK_HEX['--es-color-text-neutral-strong']})`;
export const HEADING_FONT_FAMILY =
  'var(--figma-fontfamilies-poppins, Poppins), sans-serif';
export const BODY_FONT_FAMILY = 'var(--figma-fontfamilies-lato, Lato), sans-serif';
