'use client';

import type { CSSProperties } from 'react';
import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';

import { useOutsideClickClose } from '@/lib/hooks/use-outside-click-close';

const WHITE = 'var(--figma-colors-desktop, #FFFFFF)';

const cardTitleStyle: CSSProperties = {
  color: WHITE,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.45rem, 3.4vw, var(--figma-fontsizes-37, 37px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight:
    'clamp(1.95rem, 4.6vw, calc(var(--figma-lineheights-age-specific-strategies, 50) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-age-specific-strategies, 0.37) * 1px)',
};

const cardDescriptionStyle: CSSProperties = {
  color: WHITE,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 2.2vw, var(--figma-fontsizes-22, 22px))',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight:
    'clamp(1.45rem, 2.8vw, calc(var(--figma-lineheights-scripts-workbooks-and-troubleshooting-guides-for-real-life-challenges, 36) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-scripts-workbooks-and-troubleshooting-guides-for-real-life-challenges, 0.3079999947547913) * 1px)',
};

export interface CourseHighlightCardProps {
  id: string;
  title: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
  description?: string;
  cardBg: string;
}

export function CourseHighlightCard({
  title,
  imageSrc,
  imageWidth,
  imageHeight,
  imageClassName,
  description,
  cardBg,
}: CourseHighlightCardProps) {
  const [isActive, setIsActive] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

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

  // Build conditional class fragments for the active (tapped) state.
  // Desktop hover continues to work independently via lg:group-hover:*.
  const overlayActive = isActive
    ? 'bg-black/70 backdrop-blur-[4px]'
    : '';
  const arrowActive = isActive
    ? 'h-[70px] w-[70px]'
    : '';
  const descriptionActive = isActive
    ? 'opacity-100'
    : '';

  return (
    <article
      ref={articleRef}
      className='group relative isolate flex min-h-[320px] overflow-hidden rounded-[25px] p-5 sm:min-h-[345px] sm:p-7 lg:min-h-[457px] lg:p-8'
      style={{ backgroundColor: cardBg }}
    >
      {/* Dark overlay — activated by desktop hover or mobile tap */}
      <div
        aria-hidden='true'
        className={`pointer-events-none absolute inset-0 z-[1] transition-all duration-300 ${isActive ? '' : 'bg-black/0'} lg:group-hover:bg-black/70 lg:group-hover:backdrop-blur-[4px] ${overlayActive}`}
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
      <button
        type='button'
        aria-label={`Show details for ${title}`}
        aria-expanded={isActive}
        onClick={handleArrowClick}
        className={`absolute bottom-5 left-5 z-10 inline-flex appearance-none items-center justify-center rounded-full border-0 bg-white/15 p-0 ring-1 ring-white/35 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 lg:bottom-7 lg:left-7 ${isActive ? 'h-[70px] w-[70px]' : 'h-[54px] w-[54px]'} lg:group-hover:h-[70px] lg:group-hover:w-[70px] ${arrowActive}`}
      >
        <span className='inline-flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#ED622E] shadow-[0_4px_10px_rgba(0,0,0,0.18)]'>
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
      </button>

      {/* Card text content */}
      <div className='relative z-10 flex h-full w-full flex-col'>
        <div className='mt-auto space-y-4'>
          <h3
            className='max-w-[12ch] text-balance'
            style={cardTitleStyle}
          >
            {title}
          </h3>

          {description && (
            <p
              className={`max-w-[34ch] transition-opacity duration-300 ${isActive ? '' : 'opacity-0'} lg:group-hover:opacity-100 ${descriptionActive}`}
              style={cardDescriptionStyle}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
