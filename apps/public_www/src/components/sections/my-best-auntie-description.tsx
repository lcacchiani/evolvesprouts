'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { MyBestAuntieDescriptionContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface MyBestAuntieDescriptionProps {
  content: MyBestAuntieDescriptionContent;
}

const SECTION_BACKGROUND = '#F8F8F8';
const CARD_BACKGROUND = '#FFFFFF';
const CARD_SHADOW =
  '0 8px 8px rgba(50, 50, 71, 0.08), 0 8px 16px rgba(50, 50, 71, 0.06)';
const CTA_COLOR = '#ED622E';
const CARD_ICON_FALLBACK =
  '/images/highlight-icon-live-training.png';
const CONTROL_BG = '#FFFFFF';
const CONTROL_ICON = '#3D3E3D';
const CONTROL_SHADOW = '0 1px 14px rgba(0, 0, 0, 0.08)';
const CONTROL_BG_DISABLED = '#E9E9E9';
const CONTROL_ICON_DISABLED = '#6B6B6B';

const iconByKey: Record<string, string> = {
  'live-training': '/images/highlight-icon-live-training.png',
  'auntie-review': '/images/highlight-icon-auntie-review.png',
  workbook: '/images/highlight-icon-workbook.png',
};

const eyebrowStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '18px',
  fontWeight: 500,
  lineHeight: 1,
};

const titleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: 1.15,
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
  color: CTA_COLOR,
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
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[920px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
            className='px-4 py-2.5 sm:px-5'
            style={{ borderColor: '#EECAB0', backgroundColor: '#FFFDF9' }}
          />
          <h2
            className='mt-6 text-[clamp(2rem,5.6vw,3.2rem)]'
            style={titleStyle}
          >
            {content.title}
          </h2>
        </div>

        {hasMultipleCards && (
          <div className='mt-8 flex justify-end gap-3'>
            <button
              type='button'
              onClick={() => {
                scrollCarousel('previous');
              }}
              aria-label='Previous highlight cards'
              disabled={!canScrollPrevious}
              className='inline-flex h-[58px] w-[58px] items-center justify-center rounded-full disabled:cursor-not-allowed sm:h-[68px] sm:w-[68px]'
              style={{
                backgroundColor: canScrollPrevious ? CONTROL_BG : CONTROL_BG_DISABLED,
                boxShadow: CONTROL_SHADOW,
              }}
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
              className='inline-flex h-[58px] w-[58px] items-center justify-center rounded-full disabled:cursor-not-allowed sm:h-[68px] sm:w-[68px]'
              style={{
                backgroundColor: canScrollNext ? CONTROL_BG : CONTROL_BG_DISABLED,
                boxShadow: CONTROL_SHADOW,
              }}
            >
              <ArrowIcon direction='right' isDisabled={!canScrollNext} />
            </button>
          </div>
        )}

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
                    boxShadow: CARD_SHADOW,
                  }}
                >
                  <div className='inline-flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[#F8F8F8]'>
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
                      className='inline-flex min-h-[52px] w-full items-center justify-center rounded-[10px] border px-6 text-center transition-colors duration-200 hover:bg-[#ED622E] hover:text-white'
                      style={{
                        ...ctaStyle,
                        borderColor: CTA_COLOR,
                      }}
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
