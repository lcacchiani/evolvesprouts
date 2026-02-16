import type { CSSProperties } from 'react';

const DEFAULT_SECTION_BG_IMAGE = 'url("/images/evolvesprouts-logo.svg")';
const DEFAULT_SECTION_BG_FILTER =
  'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)';

export interface SectionBackgroundOverlayOptions {
  backgroundColor: string;
  position: string;
  size: string;
  maskImage: string;
  image?: string;
  filter?: string;
}

export interface SectionBackgroundStyleOptions {
  backgroundColor: string;
  position: string;
  size: string;
  repeat?: CSSProperties['backgroundRepeat'];
  blendMode?: CSSProperties['backgroundBlendMode'];
  image?: string;
}

export const LOGO_OVERLAY_TOP: Omit<
  SectionBackgroundOverlayOptions,
  'backgroundColor'
> = {
  position: 'center -150px',
  size: '900px auto',
  maskImage: 'linear-gradient(to bottom, black 18%, transparent 20%)',
};

export const LOGO_OVERLAY_DEEP: Omit<
  SectionBackgroundOverlayOptions,
  'backgroundColor'
> = {
  position: 'center -900px',
  size: '2000px auto',
  maskImage: 'linear-gradient(to bottom, black 5%, transparent 15%)',
};

export function buildSectionBackgroundOverlayStyle({
  backgroundColor,
  position,
  size,
  maskImage,
  image = DEFAULT_SECTION_BG_IMAGE,
  filter = DEFAULT_SECTION_BG_FILTER,
}: SectionBackgroundOverlayOptions): CSSProperties {
  return {
    backgroundColor,
    ['--es-section-bg-image' as string]: image,
    ['--es-section-bg-position' as string]: position,
    ['--es-section-bg-size' as string]: size,
    ['--es-section-bg-filter' as string]: filter,
    ['--es-section-bg-mask-image' as string]: maskImage,
  } as CSSProperties;
}

export function buildSectionBackgroundStyle({
  backgroundColor,
  position,
  size,
  repeat = 'no-repeat',
  blendMode,
  image = DEFAULT_SECTION_BG_IMAGE,
}: SectionBackgroundStyleOptions): CSSProperties {
  return {
    backgroundColor,
    backgroundImage: image,
    backgroundPosition: position,
    backgroundRepeat: repeat,
    backgroundSize: size,
    ...(blendMode ? { backgroundBlendMode: blendMode } : {}),
  };
}
