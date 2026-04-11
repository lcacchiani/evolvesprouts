import { type HTMLAttributes, type ReactNode, type RefObject } from 'react';

import enContent from '@/content/en.json';

const CAROUSEL_TRACK_BASE_CLASSES =
  'snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

interface CarouselTrackProps extends HTMLAttributes<HTMLDivElement> {
  carouselRef?: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
  /** Use `group` when the track is not a carousel (e.g. desktop grid) to avoid misleading roledescription. */
  presentation?: 'carousel' | 'group';
  ariaRoleDescription?: string;
  children: ReactNode;
  testId?: string;
}

export function CarouselTrack({
  carouselRef,
  ariaLabel,
  presentation = 'carousel',
  ariaRoleDescription = enContent.common.accessibility.carouselRoleDescription,
  className,
  children,
  testId,
  ...rest
}: CarouselTrackProps) {
  const isCarouselPresentation = presentation === 'carousel';

  return (
    <div
      ref={carouselRef}
      role={isCarouselPresentation ? 'region' : 'group'}
      aria-roledescription={
        isCarouselPresentation ? ariaRoleDescription : undefined
      }
      aria-label={ariaLabel}
      data-testid={testId}
      className={`${CAROUSEL_TRACK_BASE_CLASSES}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}
