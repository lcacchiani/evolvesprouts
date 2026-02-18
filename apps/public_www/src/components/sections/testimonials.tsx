'use client';

import Image from 'next/image';
import {
  type CSSProperties,
  type TouchEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ButtonPrimitive } from '@/components/button-primitive';
import { SectionHeader } from '@/components/section-header';
import { SectionShell } from '@/components/section-shell';
import {
  readCandidateText,
  readOptionalText,
} from '@/content/content-field-utils';
import type { TestimonialsContent } from '@/content';
import {
  BODY_TEXT_COLOR,
  HEADING_TEXT_COLOR,
  SURFACE_WHITE,
  TEXT_ICON_COLOR,
} from '@/lib/design-tokens';
import {
  buildSectionBackgroundOverlayStyle,
  LOGO_OVERLAY_TOP,
} from '@/lib/section-backgrounds';

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

const TEXT_PRIMARY = HEADING_TEXT_COLOR;
const TEXT_SECONDARY = BODY_TEXT_COLOR;
const CONTROL_ICON = TEXT_ICON_COLOR;
const PROFILE_CARD_BG = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const IMAGE_FALLBACK_BG = 'var(--es-color-surface-peach, #F5DFCF)';
const SWIPE_THRESHOLD_PX = 48;
const SECTION_STYLE = buildSectionBackgroundOverlayStyle({
  ...LOGO_OVERLAY_TOP,
  backgroundColor: SURFACE_WHITE,
});
const TESTIMONIAL_CONTROL_BUTTON_CLASSNAME =
  'es-btn--control';

const quoteTextStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.25rem, 2.3vw, 28px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1.7',
  letterSpacing: '0.01em',
};

const authorStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.4rem, 2.8vw, var(--figma-fontsizes-32, 32px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight: '1.15',
};

const metaTextStyle: CSSProperties = {
  color: TEXT_SECONDARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 2.1vw, 1.2rem)',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: '1.5',
  letterSpacing: 'var(--figma-letterspacing-mom-of-2, 0.5px)',
};

function normalizeStory(item: unknown): NormalizedStory | null {
  if (typeof item === 'string') {
    const quote = readOptionalText(item);
    return quote ? { quote } : null;
  }

  if (typeof item !== 'object' || item === null) {
    return null;
  }

  const record = item as Record<string, unknown>;
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

function getWrappedIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return ((index % total) + total) % total;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`h-8 w-8 ${rotationClass}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M8 4L16 12L8 20'
        stroke={CONTROL_ICON}
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
      className='h-[58px] w-[58px] sm:h-[68px] sm:w-[68px]'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle
        cx='67'
        cy='46'
        r='20'
        stroke={TEXT_SECONDARY}
        strokeWidth='6'
        opacity='0.9'
      />
      <path
        d='M31 106C35.2 85.4 49.4 75 67 75C84.6 75 98.8 85.4 103 106'
        stroke={TEXT_SECONDARY}
        strokeWidth='6'
        strokeLinecap='round'
        opacity='0.9'
      />
      <circle cx='95' cy='43' r='8' fill={TEXT_SECONDARY} opacity='0.22' />
      <circle cx='39' cy='89' r='7' fill={TEXT_SECONDARY} opacity='0.22' />
    </svg>
  );
}

export function Testimonials({ content }: TestimonialsProps) {
  const stories = useMemo(() => normalizeStories(content.items), [content.items]);
  const storiesToRender =
    stories.length > 0
      ? stories
      : [{ quote: content.title } satisfies NormalizedStory];
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const activeIndex = getWrappedIndex(activeStoryIndex, storiesToRender.length);
  const activeStory = storiesToRender[activeIndex];
  const hasMultipleStories = storiesToRender.length > 1;
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

  function goToPreviousStory() {
    if (!hasMultipleStories) {
      return;
    }

    setActiveStoryIndex((currentIndex) =>
      getWrappedIndex(currentIndex - 1, storiesToRender.length),
    );
  }

  function goToNextStory() {
    if (!hasMultipleStories) {
      return;
    }

    setActiveStoryIndex((currentIndex) =>
      getWrappedIndex(currentIndex + 1, storiesToRender.length),
    );
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!hasMultipleStories) {
      return;
    }

    const touch = event.changedTouches[0];
    touchStartXRef.current = touch ? touch.clientX : null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!hasMultipleStories || touchStartXRef.current === null) {
      touchStartXRef.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      touchStartXRef.current = null;
      return;
    }

    const deltaX = touch.clientX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) {
      return;
    }

    if (deltaX > 0) {
      goToPreviousStory();
      return;
    }

    goToNextStory();
  }

  return (
    <SectionShell
      ariaLabel={content.title}
      dataFigmaNode='Testimonials'
      className='es-section-bg-overlay'
      style={SECTION_STYLE}
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
            onTouchCancel={() => {
              touchStartXRef.current = null;
            }}
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
                      className='flex h-full min-h-[260px] items-center justify-center rounded-[30px] sm:min-h-[360px] lg:min-h-[540px]'
                      style={{ backgroundColor: IMAGE_FALLBACK_BG }}
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
                    <p className='w-full text-balance' style={quoteTextStyle}>
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
                          className='inline-flex h-[82px] w-[71px] shrink-0 items-center justify-center rounded-[30px] sm:h-[100px] sm:w-[100px]'
                          style={{ backgroundColor: PROFILE_CARD_BG }}
                        >
                          <ParentIcon />
                        </span>
                      )}

                      <div className='min-w-0 lg:pr-[170px]'>
                        {activeStory.author && <p style={authorStyle}>{activeStory.author}</p>}
                        {activeStory.role && (
                          <p
                            className={`max-w-[190px] ${activeStory.author ? 'mt-1' : ''}`}
                            style={metaTextStyle}
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
