'use client';

import Image from 'next/image';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { MyBestAuntieDescriptionContent } from '@/content';
import {
  TEXT_ICON_COLOR,
  TEXT_NEUTRAL_STRONG_COLOR,
} from '@/lib/design-tokens';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';

interface MyBestAuntieDescriptionProps {
  content: MyBestAuntieDescriptionContent;
}

const CARD_ICON_FALLBACK =
  '/images/training.svg';
const CONTROL_ICON = TEXT_ICON_COLOR;
const CONTROL_ICON_DISABLED = TEXT_NEUTRAL_STRONG_COLOR;

const iconByKey: Record<string, string> = {
  'live-training': '/images/training.svg',
  'auntie-review': '/images/review.svg',
  workbook: '/images/workbook.svg',
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
  const cards = content.items.slice(0, 6);
  const {
    carouselRef,
    hasNavigation: hasMultipleCards,
    canScrollPrevious,
    canScrollNext,
    scrollByDirection,
  } = useHorizontalCarousel<HTMLDivElement>({
    itemCount: cards.length,
  });

  return (
    <SectionShell
      id='my-best-auntie-description'
      ariaLabel={content.title}
      dataFigmaNode='my-best-auntie-description'
      className='es-section-bg-overlay es-my-best-auntie-description-section'
    >
      <SectionContainer>
        <div
          data-testid='my-best-auntie-description-header'
          className='flex flex-col gap-5 md:flex-row md:items-end md:justify-between'
        >
          <SectionHeader
            eyebrow={content.eyebrow}
            title={content.title}
            align='left'
            className='min-w-0 flex-1'
          />

          {hasMultipleCards && (
            <div
              data-testid='my-best-auntie-description-controls'
              className='flex gap-3 self-end md:self-auto md:pb-2'
            >
              <ButtonPrimitive
                variant='control'
                onClick={() => {
                  scrollByDirection('prev');
                }}
                aria-label='Previous highlight cards'
                disabled={!canScrollPrevious}
                className='disabled:cursor-not-allowed'
              >
                <ArrowIcon direction='left' isDisabled={!canScrollPrevious} />
              </ButtonPrimitive>
              <ButtonPrimitive
                variant='control'
                onClick={() => {
                  scrollByDirection('next');
                }}
                aria-label='Next highlight cards'
                disabled={!canScrollNext}
                className='disabled:cursor-not-allowed'
              >
                <ArrowIcon direction='right' isDisabled={!canScrollNext} />
              </ButtonPrimitive>
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
                  className='flex h-full min-h-[520px] flex-col rounded-card-xl p-6 sm:p-8 es-my-best-auntie-description-card'
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
                  <h3 className='mt-6 es-my-best-auntie-description-card-title'>
                    {item.title}
                  </h3>
                  <p className='mt-3 es-my-best-auntie-description-card-description'>
                    {item.description}
                  </p>
                  <div className='mt-auto pt-8'>
                    <ButtonPrimitive
                      href={item.ctaHref}
                      variant='outline'
                      className='min-h-[52px] w-full rounded-control px-6 text-center text-lg font-semibold leading-none transition-colors duration-200'
                    >
                      {item.ctaLabel}
                    </ButtonPrimitive>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
