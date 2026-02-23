'use client';

import { type MouseEvent, useCallback, useRef, useState } from 'react';
import Image from 'next/image';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { useOutsideClickClose } from '@/lib/hooks/use-outside-click-close';

const WHITE = 'var(--figma-colors-desktop, #FFFFFF)';
const DESKTOP_HOVER_QUERY = '(min-width: 1024px) and (hover: hover)';

export type CourseHighlightCardTone = 'gold' | 'green' | 'blue';

export interface CourseHighlightCardProps {
  id: string;
  title: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
  description?: string;
  tone: CourseHighlightCardTone;
}

const INTERACTIVE_ELEMENT_SELECTOR =
  'button, a, input, select, textarea, [role="button"]';

function isDesktopHoverMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(DESKTOP_HOVER_QUERY).matches;
}

export function CourseHighlightCard({
  title,
  imageSrc,
  imageWidth,
  imageHeight,
  imageClassName,
  description,
  tone,
}: CourseHighlightCardProps) {
  const [isActive, setIsActive] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const toneClassMap: Record<CourseHighlightCardTone, string> = {
    gold: 'es-course-highlight-card--gold',
    green: 'es-course-highlight-card--green',
    blue: 'es-course-highlight-card--blue',
  };
  const toneClassName = toneClassMap[tone];

  const handleDismiss = useCallback(() => {
    setIsActive(false);
  }, []);

  useOutsideClickClose({
    ref: articleRef,
    onOutsideClick: handleDismiss,
    isActive,
  });

  const handleArrowClick = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  const handleCardSurfaceClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const clickTarget = event.target as HTMLElement | null;
      if (clickTarget?.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
        return;
      }

      if (isDesktopHoverMode()) {
        return;
      }

      setIsActive((prev) => !prev);
    },
    [],
  );

  // Build conditional class fragments for the active (tapped) state.
  // Pointer hover continues to work independently via group-hover:*.
  const overlayActive = isActive
    ? 'bg-black/70 backdrop-blur-[4px]'
    : '';
  const arrowActive = isActive
    ? 'h-[70px] w-[70px]'
    : '';
  const descriptionVisibilityClassName = isActive
    ? 'opacity-100 transition-opacity duration-300'
    : 'opacity-0 transition-none';

  return (
    <article
      ref={articleRef}
      onClick={handleCardSurfaceClick}
      className={`group relative isolate flex min-h-[320px] overflow-hidden rounded-card p-5 sm:min-h-[345px] sm:p-7 lg:min-h-[457px] lg:p-8 ${toneClassName}`}
    >
      {/* Dark overlay — activated by pointer hover or tap */}
      <div
        aria-hidden='true'
        className={`pointer-events-none absolute inset-0 z-[1] transition-all duration-300 ${isActive ? '' : 'bg-black/0'} group-hover:bg-black/70 group-hover:backdrop-blur-[4px] ${overlayActive}`}
      />

      {/* Card illustration */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute bottom-0 right-0 z-0'
      >
        <Image
          src={imageSrc}
          alt=''
          width={imageWidth}
          height={imageHeight}
          sizes='(max-width: 640px) 240px, (max-width: 1024px) 300px, 340px'
          className={`${imageClassName} w-auto max-w-none`}
        />
      </div>

      {/* Arrow button — triggers reveal on tap */}
      <ButtonPrimitive
        variant='icon'
        aria-label={`Show details for ${title}`}
        aria-expanded={isActive}
        onClick={handleArrowClick}
        className={`absolute bottom-5 left-5 z-10 appearance-none rounded-full border-0 bg-white/15 p-0 ring-1 ring-white/35 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 lg:bottom-7 lg:left-7 ${isActive ? 'h-[70px] w-[70px]' : 'h-[54px] w-[54px]'} group-hover:h-[70px] group-hover:w-[70px] ${arrowActive}`}
      >
        <span className='inline-flex h-[44px] w-[44px] items-center justify-center rounded-full es-bg-brand-strong shadow-[0_4px_10px_rgba(0,0,0,0.18)]'>
          <svg
            aria-hidden='true'
            viewBox='0 0 20 20'
            className='h-4 w-4'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M7 4L13 10L7 16'
              stroke={WHITE}
              strokeWidth='2.2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </span>
      </ButtonPrimitive>

      {/* Card text content */}
      <div className='relative z-10 flex h-full w-full flex-col'>
        <div className='mt-auto space-y-4'>
          <h3 className='max-w-[12ch] text-balance es-course-highlight-title'>
            {title}
          </h3>

          {description && (
            <p
              className={`max-w-[34ch] es-course-highlight-description group-hover:opacity-100 group-hover:transition-opacity group-hover:duration-300 ${descriptionVisibilityClassName}`}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
