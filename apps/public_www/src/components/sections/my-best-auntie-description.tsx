'use client';

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

const CARD_ICON_FALLBACK_CLASS = 'es-my-best-auntie-description-icon--training';
const CONTROL_ICON = TEXT_ICON_COLOR;
const CONTROL_ICON_DISABLED = TEXT_NEUTRAL_STRONG_COLOR;
const CARD_ICON_TONES = ['green', 'blue', 'red'] as const;

const iconMaskClassByKey: Record<string, string> = {
  training: 'es-my-best-auntie-description-icon--training',
  coaching: 'es-my-best-auntie-description-icon--coaching',
  call: 'es-my-best-auntie-description-icon--call',
  community: 'es-my-best-auntie-description-icon--community',
  toolbox: 'es-my-best-auntie-description-icon--toolbox',
  support: 'es-my-best-auntie-description-icon--support',
  review: 'es-my-best-auntie-description-icon--review',
  graduate: 'es-my-best-auntie-description-icon--graduation',
  graduation: 'es-my-best-auntie-description-icon--graduation',
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

function readIconMaskClass(icon: string): string {
  const normalizedKey = icon.trim().toLowerCase();
  return iconMaskClassByKey[normalizedKey] ?? CARD_ICON_FALLBACK_CLASS;
}

export function MyBestAuntieDescription({
  content,
}: MyBestAuntieDescriptionProps) {
  const cards = content.items;
  const previousButtonAriaLabel = content.previousButtonAriaLabel.trim();
  const nextButtonAriaLabel = content.nextButtonAriaLabel.trim();
  const {
    carouselRef,
    hasNavigation: hasMultipleCards,
    canScrollPrevious,
    canScrollNext,
    scrollByDirection,
  } = useHorizontalCarousel<HTMLDivElement>({
    itemCount: cards.length,
    loop: false,
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
              className='hidden gap-3 self-end md:flex md:self-auto md:pb-2'
            >
              <ButtonPrimitive
                variant='control'
                onClick={() => {
                  scrollByDirection('prev');
                }}
                aria-label={previousButtonAriaLabel}
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
                aria-label={nextButtonAriaLabel}
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
                  className='flex h-full min-h-[450px] flex-col rounded-card-xl p-6 sm:p-8 es-my-best-auntie-description-card'
                >
                  <div className='inline-flex h-[100px] w-[100px] items-center justify-center rounded-full es-bg-surface-muted'>
                    <span
                      aria-hidden='true'
                      data-testid='my-best-auntie-description-icon'
                      className={`es-my-best-auntie-description-icon ${readIconMaskClass(item.icon)} es-my-best-auntie-description-icon-tone--${CARD_ICON_TONES[index % CARD_ICON_TONES.length]}`}
                    />
                  </div>
                  <h3 className='mt-6 es-my-best-auntie-description-card-title'>
                    {item.title}
                  </h3>
                  <p className='mt-3 es-my-best-auntie-description-card-description'>
                    {item.description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
