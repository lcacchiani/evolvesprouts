import type { CSSProperties } from 'react';

export const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
export const BODY_TEXT_COLOR = 'var(--figma-colors-home, #4A4A4A)';

export const DEFAULT_SECTION_EYEBROW_STYLE: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1',
};
