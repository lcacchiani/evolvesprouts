'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { MyBestAuntieDescriptionContent } from '@/content';
import {
  BODY_TEXT_COLOR,
  HEADING_TEXT_COLOR,
  SURFACE_WHITE,
  TEXT_ICON_COLOR,
  TEXT_NEUTRAL_STRONG_COLOR,
} from '@/lib/design-tokens';
import {
  buildSectionBackgroundOverlayStyle,
  LOGO_OVERLAY_DEEP,
} from '@/lib/section-backgrounds';

interface MyBestAuntieDescriptionProps {
  content: MyBestAuntieDescriptionContent;
}

const SECTION_STYLE = buildSectionBackgroundOverlayStyle({
  ...LOGO_OVERLAY_DEEP,
  backgroundColor: 'var(--es-color-surface-muted, #F8F8F8)',
});
const CARD_BACKGROUND = SURFACE_WHITE;
const CARD_ICON_FALLBACK =
  '/images/training.svg';
const CONTROL_ICON = TEXT_ICON_COLOR;
const CONTROL_ICON_DISABLED = TEXT_NEUTRAL_STRONG_COLOR;

const iconByKey: Record<string, string> = {
  'live-training': '/images/training.svg',
  'auntie-review': '/images/review.svg',
  workbook: '/images/workbook.svg',
};

const cardTitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: '24px',
  fontWeight: 600,
  lineHeight: '30px',
};

const descriptionStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '18px',
  fontWeight: 400,
  lineHeight: '30px',
};

const ctaStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '18px',
  fontWeight: 600,
  lineHeight: 1,
};

function ArrowIcon({
  direction,
  isDisabled,
}: {
  direction: 'left' | 'right';
  isDisabled: boolean;
}) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';
  const strokeColor = isDisabled ? CONTROL_ICON_DISABLED : CONTROL_ICON;

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`h-7 w-7 ${rotationClass}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M8 4L16 12L8 20'
        stroke={strokeColor}
        strokeWidth='2.4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function readIconSrc(icon: string): string {
  const normalizedKey = icon.trim().toLowerCase();
  return iconByKey[normalizedKey] ?? CARD_ICON_FALLBACK;
}

export function MyBestAuntieDescription({
  content,
}: MyBestAuntieDescriptionProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const cards = content.items.slice(0, 6);
  const hasMultipleCards = cards.length > 1;
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(hasMultipleCards);

  const updateCarouselControls = useCallback(() => {
    const carouselElement = carouselRef.current;
    if (!carouselElement || !hasMultipleCards) {
      setCanScrollPrevious(false);
      setCanScrollNext(false);
      return;
    }

    const maxScrollLeft = carouselElement.scrollWidth - carouselElement.clientWidth;
    const threshold = 2;
    setCanScrollPrevious(carouselElement.scrollLeft > threshold);
    setCanScrollNext(carouselElement.scrollLeft < maxScrollLeft - threshold);
  }, [hasMultipleCards]);

  useEffect(() => {
    const carouselElement = carouselRef.current;
    if (!carouselElement) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      updateCarouselControls();
    });

    function handleScroll() {
      updateCarouselControls();
    }

    carouselElement.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.cancelAnimationFrame(frameId);
      carouselElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [cards.length, updateCarouselControls]);

  const scrollCarousel = useCallback((direction: 'previous' | 'next') => {
    const carouselElement = carouselRef.current;
    if (!carouselElement) {
      return;
    }

    if (direction === 'previous' && !canScrollPrevious) {
      return;
    }

    if (direction === 'next' && !canScrollNext) {
      return;
    }

    const shiftBy = carouselElement.clientWidth;
    const movement = direction === 'next' ? shiftBy : -shiftBy;

    carouselElement.scrollBy({
      left: movement,
      behavior: 'smooth',
    });
  }, [canScrollNext, canScrollPrevious]);

  return (
    <SectionShell
      id='my-best-auntie-description'
      ariaLabel={content.title}
      dataFigmaNode='courseHiglit_sec'
      className='es-section-bg-overlay'
      style={SECTION_STYLE}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div
          data-testid='my-best-auntie-description-header'
          className='flex flex-col gap-5 md:flex-row md:items-end md:justify-between'
        >
          <div className='max-w-[920px] text-left'>
            <SectionEyebrowChip label={content.eyebrow} />
            <h2 className='es-type-title mt-6'>
              {content.title}
            </h2>
          </div>

          {hasMultipleCards && (
            <div
              data-testid='my-best-auntie-description-controls'
              className='flex gap-3 self-end md:self-auto md:pb-2'
            >
              <button
                type='button'
                onClick={() => {
                  scrollCarousel('previous');
                }}
                aria-label='Previous highlight cards'
                disabled={!canScrollPrevious}
                className={`inline-flex h-[58px] w-[58px] items-center justify-center rounded-full sm:h-[68px] sm:w-[68px] ${canScrollPrevious ? 'es-control-button' : 'es-control-button es-control-button-disabled disabled:cursor-not-allowed'}`}
              >
                <ArrowIcon direction='left' isDisabled={!canScrollPrevious} />
              </button>
              <button
                type='button'
                onClick={() => {
                  scrollCarousel('next');
                }}
                aria-label='Next highlight cards'
                disabled={!canScrollNext}
                className={`inline-flex h-[58px] w-[58px] items-center justify-center rounded-full sm:h-[68px] sm:w-[68px] ${canScrollNext ? 'es-control-button' : 'es-control-button es-control-button-disabled disabled:cursor-not-allowed'}`}
              >
                <ArrowIcon direction='right' isDisabled={!canScrollNext} />
              </button>
            </div>
          )}
        </div>

        <div
          ref={carouselRef}
          className='scrollbar-hide -mx-1 mt-6 overflow-x-auto px-1 pb-2 scroll-smooth'
          role='region'
          aria-label={`${content.title} slider`}
        >
          <ul className='flex gap-5 sm:gap-6'>
            {cards.map((item, index) => (
              <li
                key={`${item.title}-${index}`}
                className='w-[88%] shrink-0 sm:w-[48%] lg:w-[32%]'
              >
                <article
                  className='flex h-full min-h-[520px] flex-col rounded-[32px] p-6 sm:p-8'
                  style={{
                    backgroundColor: CARD_BACKGROUND,
                  }}
                >
                  <div className='inline-flex h-[100px] w-[100px] items-center justify-center rounded-full es-bg-surface-muted'>
                    <Image
                      src={readIconSrc(item.icon)}
                      alt=''
                      aria-hidden='true'
                      width={50}
                      height={50}
                      className='h-[50px] w-[50px] object-contain'
                    />
                  </div>
                  <h3 className='mt-6' style={cardTitleStyle}>
                    {item.title}
                  </h3>
                  <p className='mt-3' style={descriptionStyle}>
                    {item.description}
                  </p>
                  <div className='mt-auto pt-8'>
                    <a
                      href={item.ctaHref}
                      className='es-card-action-outline inline-flex min-h-[52px] w-full items-center justify-center rounded-[10px] border px-6 text-center transition-colors duration-200'
                      style={ctaStyle}
                    >
                      {item.ctaLabel}
                    </a>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
