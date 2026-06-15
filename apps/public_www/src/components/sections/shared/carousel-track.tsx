import { type HTMLAttributes, type ReactNode, type RefObject } from 'react';

const CAROUSEL_TRACK_BASE_CLASSES =
  'snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

type CarouselTrackBaseProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  carouselRef?: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
  children: ReactNode;
  testId?: string;
};

type CarouselTrackCarouselProps = CarouselTrackBaseProps & {
  presentation?: 'carousel';
  ariaRoleDescription: string;
};

type CarouselTrackGroupProps = CarouselTrackBaseProps & {
  presentation: 'group';
  ariaRoleDescription?: string;
};

export type CarouselTrackProps = CarouselTrackCarouselProps | CarouselTrackGroupProps;

export function CarouselTrack({
  carouselRef,
  ariaLabel,
  presentation = 'carousel',
  ariaRoleDescription,
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
