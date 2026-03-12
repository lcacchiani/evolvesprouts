import { type HTMLAttributes, type ReactNode, type RefObject } from 'react';

import enContent from '@/content/en.json';

const CAROUSEL_TRACK_BASE_CLASSES =
  'snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

interface CarouselTrackProps extends HTMLAttributes<HTMLDivElement> {
  carouselRef?: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
  ariaRoleDescription?: string;
  children: ReactNode;
  testId?: string;
}

export function CarouselTrack({
  carouselRef,
  ariaLabel,
  ariaRoleDescription = enContent.common.accessibility.carouselRoleDescription,
  className,
  children,
  testId,
  ...rest
}: CarouselTrackProps) {
  return (
    <div
      ref={carouselRef}
      role='region'
      aria-roledescription={ariaRoleDescription}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`${CAROUSEL_TRACK_BASE_CLASSES}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}
