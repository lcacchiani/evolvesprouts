'use client';

import Image from 'next/image';
import {
  useMemo,
} from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import {
  readCandidateText,
  readOptionalText,
  toRecord,
} from '@/content/content-field-utils';
import type { TestimonialsContent } from '@/content';
import { useSwipePager } from '@/lib/hooks/use-swipe-pager';

interface TestimonialsProps {
  content: TestimonialsContent;
}

interface NormalizedStory {
  quote?: string;
  author?: string;
  role?: string;
  mainImageSrc?: string;
  avatarImageSrc?: string;
}

const SWIPE_THRESHOLD_PX = 48;
const TESTIMONIAL_CONTROL_BUTTON_CLASSNAME =
  'es-btn--control';

function normalizeStory(item: unknown): NormalizedStory | null {
  if (typeof item === 'string') {
    const quote = readOptionalText(item);
    return quote ? { quote } : null;
  }

  const record = toRecord(item);
  if (!record) {
    return null;
  }
  const story: NormalizedStory = {
    quote: readCandidateText(record, [
      'quote',
      'testimonial',
      'text',
      'description',
      'content',
    ]),
    author: readCandidateText(record, ['author', 'name', 'parentName']),
    role: readCandidateText(record, ['role', 'subtitle', 'title']),
    mainImageSrc: readCandidateText(record, [
      'mainImageSrc',
      'slideImageSrc',
      'imageSrc',
      'image',
    ]),
    avatarImageSrc: readCandidateText(record, [
      'avatarImageSrc',
      'authorImageSrc',
      'userImageSrc',
      'avatar',
    ]),
  };

  return Object.values(story).some(Boolean) ? story : null;
}

function normalizeStories(items: unknown): NormalizedStory[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => normalizeStory(item))
    .filter((item): item is NormalizedStory => item !== null);
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`h-8 w-8 es-text-icon ${rotationClass}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M8 4L16 12L8 20'
        stroke='currentColor'
        strokeWidth='2.4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function ParentIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 134 134'
      className='h-[58px] w-[58px] sm:h-[68px] sm:w-[68px] es-text-body'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle
        cx='67'
        cy='46'
        r='20'
        stroke='currentColor'
        strokeWidth='6'
        opacity='0.9'
      />
      <path
        d='M31 106C35.2 85.4 49.4 75 67 75C84.6 75 98.8 85.4 103 106'
        stroke='currentColor'
        strokeWidth='6'
        strokeLinecap='round'
        opacity='0.9'
      />
      <circle cx='95' cy='43' r='8' fill='currentColor' opacity='0.22' />
      <circle cx='39' cy='89' r='7' fill='currentColor' opacity='0.22' />
    </svg>
  );
}

export function Testimonials({ content }: TestimonialsProps) {
  const stories = useMemo(() => normalizeStories(content.items), [content.items]);
  const storiesToRender =
    stories.length > 0
      ? stories
      : [{ quote: content.title } satisfies NormalizedStory];
  const {
    activeIndex,
    hasMultiplePages: hasMultipleStories,
    goToPrevious: goToPreviousStory,
    goToNext: goToNextStory,
    handleTouchStart,
    handleTouchEnd,
    handleTouchCancel,
  } = useSwipePager<HTMLDivElement>({
    itemCount: storiesToRender.length,
    swipeThresholdPx: SWIPE_THRESHOLD_PX,
  });
  const activeStory = storiesToRender[activeIndex];
  const testimonialsRecord = content as Record<string, unknown>;
  const badgeLabel =
    readCandidateText(testimonialsRecord, [
      'badgeLabel',
      'badge',
      'eyebrow',
      'label',
    ]) ?? content.title;
  const descriptionText = content.description.trim();
  const previousButtonLabel =
    readCandidateText(testimonialsRecord, [
      'previousButtonLabel',
      'previousAriaLabel',
      'previousLabel',
    ]) ?? 'Previous testimonial';
  const nextButtonLabel =
    readCandidateText(testimonialsRecord, [
      'nextButtonLabel',
      'nextAriaLabel',
      'nextLabel',
    ]) ?? 'Next testimonial';

  return (
    <SectionShell
      ariaLabel={content.title}
      dataFigmaNode='Testimonials'
      className='es-section-bg-overlay es-testimonials-section'
    >
      <div className='relative z-10 mx-auto w-full max-w-[1488px]'>
        <SectionHeader
          eyebrow={badgeLabel}
          title={content.title}
          titleClassName='text-balance'
          description={descriptionText || undefined}
          descriptionClassName='es-type-body mt-3'
        />

        <div
          data-testid='testimonials-card'
          className='relative mt-10 overflow-hidden bg-white lg:mt-14'
        >
          <div
            className='overflow-hidden'
            aria-live='polite'
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
          >
            <article
              key={`${activeStory.author ?? 'story'}-${activeIndex}`}
              className='min-w-full'
            >
              <div className='grid lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)]'>
                <div className='relative min-h-[260px] overflow-hidden rounded-[30px] es-bg-surface-peach sm:min-h-[360px] lg:min-h-[540px]'>
                  {activeStory.mainImageSrc ? (
                    <Image
                      src={activeStory.mainImageSrc}
                      alt={`${activeStory.author ?? 'Parent'} testimonial image`}
                      fill
                      sizes='(min-width: 1024px) 500px, 100vw'
                      className='rounded-[30px] object-cover'
                      priority={activeIndex === 0}
                    />
                  ) : (
                    <div
                      className='flex h-full min-h-[260px] items-center justify-center rounded-[30px] sm:min-h-[360px] lg:min-h-[540px] es-testimonials-image-fallback'
                    >
                      <ParentIcon />
                    </div>
                  )}
                </div>

                <div className='flex flex-col p-6 sm:p-9 lg:px-12 lg:pb-10 lg:pt-12'>
                  <div className='flex flex-col items-start gap-4 border-b border-[rgba(31,31,31,0.2)] pb-8 sm:gap-5 lg:pb-[52px]'>
                    <span
                      aria-hidden='true'
                      className='es-testimonial-quote-icon h-9 w-9 sm:h-11 sm:w-11'
                    />
                    <p className='w-full text-balance es-testimonials-quote'>
                      {activeStory.quote ?? content.title}
                    </p>
                  </div>

                  {(activeStory.author || activeStory.role) && (
                    <div className='relative mt-6 flex items-center gap-4 sm:mt-8 sm:gap-6'>
                      {activeStory.avatarImageSrc ? (
                        <Image
                          src={activeStory.avatarImageSrc}
                          alt={`${activeStory.author ?? 'Parent'} avatar`}
                          width={100}
                          height={100}
                          className='h-[82px] w-[71px] shrink-0 rounded-[30px] object-cover sm:h-[100px] sm:w-[100px]'
                        />
                      ) : (
                        <span
                          className='inline-flex h-[82px] w-[71px] shrink-0 items-center justify-center rounded-[30px] sm:h-[100px] sm:w-[100px] es-testimonials-avatar-fallback'
                        >
                          <ParentIcon />
                        </span>
                      )}

                      <div className='min-w-0 lg:pr-[170px]'>
                        {activeStory.author && (
                          <p className='es-testimonials-author'>{activeStory.author}</p>
                        )}
                        {activeStory.role && (
                          <p
                            className={`max-w-[190px] es-testimonials-meta ${activeStory.author ? 'mt-1' : ''}`}
                          >
                            {activeStory.role}
                          </p>
                        )}
                      </div>

                      {hasMultipleStories && (
                        <div className='hidden lg:absolute lg:-right-4 lg:top-1/2 lg:flex lg:-translate-y-1/2 lg:items-center lg:gap-[14px]'>
                          <ButtonPrimitive
                            variant='control'
                            onClick={goToPreviousStory}
                            aria-label={previousButtonLabel}
                            className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
                          >
                            <ChevronIcon direction='left' />
                          </ButtonPrimitive>
                          <ButtonPrimitive
                            variant='control'
                            onClick={goToNextStory}
                            aria-label={nextButtonLabel}
                            className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
                          >
                            <ChevronIcon direction='right' />
                          </ButtonPrimitive>
                        </div>
                      )}
                    </div>
                  )}

                  {hasMultipleStories && !activeStory.author && !activeStory.role && (
                    <div className='mt-6 hidden justify-end lg:flex'>
                      <div className='flex items-center gap-[14px]'>
                        <ButtonPrimitive
                          variant='control'
                          onClick={goToPreviousStory}
                          aria-label={previousButtonLabel}
                          className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
                        >
                          <ChevronIcon direction='left' />
                        </ButtonPrimitive>
                        <ButtonPrimitive
                          variant='control'
                          onClick={goToNextStory}
                          aria-label={nextButtonLabel}
                          className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
                        >
                          <ChevronIcon direction='right' />
                        </ButtonPrimitive>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          </div>

          {hasMultipleStories && (
            <div className='flex items-center justify-center gap-[14px] px-6 pb-6 pt-5 sm:gap-[18px] sm:px-9 lg:hidden'>
              <ButtonPrimitive
                variant='control'
                onClick={goToPreviousStory}
                aria-label={previousButtonLabel}
                className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
              >
                <ChevronIcon direction='left' />
              </ButtonPrimitive>
              <ButtonPrimitive
                variant='control'
                onClick={goToNextStory}
                aria-label={nextButtonLabel}
                className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
              >
                <ChevronIcon direction='right' />
              </ButtonPrimitive>
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
