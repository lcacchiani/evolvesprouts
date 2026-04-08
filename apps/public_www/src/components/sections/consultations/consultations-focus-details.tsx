/* eslint-disable @next/next/no-img-element -- static SVG icons from /public/images */

'use client';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import enContent from '@/content/en.json';
import type {
  CommonAccessibilityContent,
  ConsultationsFocusDetailsContent,
} from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';

/** Matches My Best Auntie description: muted circle, no border or shadow. */
const FOCUS_ICON_CIRCLE_CLASSNAME =
  'inline-flex h-[100px] w-[100px] shrink-0 items-center justify-center rounded-full es-bg-surface-muted';

const FOCUS_ICON_TONES = ['green', 'blue', 'red'] as const;

const FOCUS_ICON_MASK_FALLBACK = 'es-consultations-focus-details-icon--home-assessment';

const focusIconMaskClassByAreaId: Record<string, string> = {
  'home-assessment': 'es-consultations-focus-details-icon--home-assessment',
  'auntie-child': 'es-consultations-focus-details-icon--auntie-child',
  'parent-child': 'es-consultations-focus-details-icon--parent-child',
};

function readFocusIconMaskClass(areaId: string): string {
  return focusIconMaskClassByAreaId[areaId] ?? FOCUS_ICON_MASK_FALLBACK;
}

interface ConsultationsFocusDetailsProps {
  content: ConsultationsFocusDetailsContent;
  commonAccessibility?: CommonAccessibilityContent;
}

function ArrowIcon({
  direction,
  isDisabled,
}: {
  direction: 'left' | 'right';
  isDisabled: boolean;
}) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';
  const toneClass = isDisabled ? 'es-text-neutral-strong' : 'es-text-icon';

  return (
    <span
      aria-hidden
      className={`es-ui-icon-mask es-ui-icon-mask--chevron-right inline-block h-7 w-7 shrink-0 ${rotationClass} ${toneClass}`}
    />
  );
}

export function ConsultationsFocusDetails({
  content,
  commonAccessibility = enContent.common.accessibility,
}: ConsultationsFocusDetailsProps) {
  const areas = content.areas;
  const previousButtonAriaLabel = content.previousButtonAriaLabel.trim();
  const nextButtonAriaLabel = content.nextButtonAriaLabel.trim();

  const {
    carouselRef,
    hasNavigation: hasMultipleCards,
    canScrollPrevious,
    canScrollNext,
    scrollByDirection,
  } = useHorizontalCarousel<HTMLDivElement>({
    itemCount: areas.length,
    snapToItem: true,
  });

  const showCarouselControls =
    hasMultipleCards && (canScrollPrevious || canScrollNext);

  return (
    <SectionShell
      id='consultations-focus-details'
      ariaLabel={content.title}
      dataFigmaNode='consultations-focus-details'
      className='es-section-bg-overlay es-consultations-focus-details-section'
    >
      <SectionContainer>
        <div
          data-testid='consultations-focus-details-header'
          className='flex flex-col gap-5 md:flex-row md:items-end md:justify-between'
        >
          <SectionHeader
            eyebrow={content.eyebrow}
            title={content.title}
            description={content.description}
            align='left'
            className='min-w-0 flex-1'
          />

          {showCarouselControls && (
            <div
              data-testid='consultations-focus-details-controls'
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

        <CarouselTrack
          carouselRef={carouselRef}
          ariaLabel={formatContentTemplate(
            commonAccessibility.sliderLabelTemplate,
            { title: content.title },
          )}
          ariaRoleDescription={commonAccessibility.carouselRoleDescription}
          className='mt-6 pb-2 scroll-smooth'
        >
          <ul className='flex gap-5 sm:gap-6'>
            {areas.map((area, index) => (
              <li
                key={area.id}
                className='w-[calc(88%-20px)] shrink-0 snap-center sm:w-[48%] md:w-[calc((100%-3rem)/3)] md:snap-start'
              >
                <article
                  className='flex h-full flex-col rounded-card-xl p-6 sm:p-8 es-consultations-focus-details-card'
                >
                  <div className='flex justify-center'>
                    <span
                      aria-hidden='true'
                      className={FOCUS_ICON_CIRCLE_CLASSNAME}
                    >
                      <span
                        data-testid='consultations-focus-details-focus-icon'
                        className={`es-my-best-auntie-description-icon ${readFocusIconMaskClass(area.id)} es-my-best-auntie-description-icon-tone--${FOCUS_ICON_TONES[index % FOCUS_ICON_TONES.length]}`}
                      />
                    </span>
                  </div>
                  <h3 className='mt-6 es-consultations-focus-details-card-title'>
                    {area.title}
                  </h3>

                  <hr className='mt-5 border-0 border-t es-border-soft' />

                  <div className='mt-5'>
                    <div className='flex items-center gap-2'>
                      <img
                        src={content.essentialsIconSrc}
                        alt=''
                        width={20}
                        height={20}
                        className='h-5 w-5 shrink-0 object-contain'
                      />
                      <p className='es-consultations-focus-details-card-label'>
                        {content.essentialsLabel}
                      </p>
                    </div>
                    <p className='mt-2 es-consultations-focus-details-card-body es-text-dim'>
                      {area.essentials}
                    </p>
                  </div>

                  <hr className='mt-5 border-0 border-t es-border-soft' />

                  <div className='mt-5'>
                    <div className='flex items-center gap-2'>
                      <img
                        src={content.deepDiveIconSrc}
                        alt=''
                        width={20}
                        height={20}
                        className='h-5 w-5 shrink-0 object-contain'
                      />
                      <p className='es-consultations-focus-details-card-label'>
                        {content.deepDiveLabel}
                      </p>
                    </div>
                    <p className='mt-2 es-consultations-focus-details-card-body es-text-dim'>
                      {area.deepDive}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </CarouselTrack>
      </SectionContainer>
    </SectionShell>
  );
}
