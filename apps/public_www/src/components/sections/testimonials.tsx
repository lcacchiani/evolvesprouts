'use client';

import Image from 'next/image';
import {
  type CSSProperties,
  type TouchEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import {
  readCandidateText,
  readOptionalText,
} from '@/content/content-field-utils';
import type { TestimonialsContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

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
const CONTROL_BG = '#FFFFFF';
const CONTROL_ICON = '#3D3E3D';
const BADGE_BORDER = '#EECAB0';
const PROFILE_CARD_BG = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const IMAGE_FALLBACK_BG = '#F3DCCB';
const CONTROL_SHADOW = '0px 1px 6px 2px rgba(0, 0, 0, 0.18)';
const SWIPE_THRESHOLD_PX = 48;
const QUOTE_ICON_SRC = '/images/orange-quote.png';
const SECTION_BACKGROUND_IMAGE = 'url("/images/tree-background.png")';
const SECTION_BACKGROUND_SIZE = '900px auto';
const TESTIMONIAL_CONTROL_BUTTON_CLASSNAME =
  'es-testimonial-control-button h-[60px] w-[60px] sm:h-[70px] sm:w-[70px]';

const badgeTextStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: 'var(--figma-lineheights-testimonials, 100%)',
};

const headingStyle: CSSProperties = {
  color: TEXT_PRIMARY,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(2rem, 5.8vw, var(--figma-fontsizes-55, 55px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight:
    'clamp(2.6rem, 7vw, calc(var(--figma-lineheights-real-stories-from-parents-in-hong-kong, 70) * 1px))',
};

const descriptionTextStyle: CSSProperties = {
  color: TEXT_SECONDARY,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: 'var(--figma-lineheights-home, 28px)',
  letterSpacing: 'var(--figma-letterspacing-home, 0.5px)',
};

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
      className='relative isolate overflow-hidden bg-white'
      style={{
        backgroundImage: SECTION_BACKGROUND_IMAGE,
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: SECTION_BACKGROUND_SIZE,
      }}
    >
      <div className='relative mx-auto w-full max-w-[1488px]'>
        <div className='mx-auto max-w-[760px] text-center'>
          <SectionEyebrowChip
            label={badgeLabel}
            labelStyle={badgeTextStyle}
            className='px-4 py-2.5'
            style={{
              borderColor: BADGE_BORDER,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
            }}
          />

          <h2 className='mt-6 text-balance' style={headingStyle}>
            {content.title}
          </h2>

          {descriptionText && (
            <p className='mt-3' style={descriptionTextStyle}>
              {descriptionText}
            </p>
          )}
        </div>

        <div className='relative mt-10 overflow-hidden rounded-[30px] border border-[#EFD7C7] bg-white shadow-[0_28px_70px_rgba(18,18,17,0.08)] lg:mt-14'>
          <div
            className='overflow-hidden'
            aria-live='polite'
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
              touchStartXRef.current = null;
            }}
          >
            <div
              className='flex transition-transform duration-500 ease-out'
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {storiesToRender.map((story, index) => {
                const quoteText = story.quote ?? content.title;
                const showMeta = Boolean(story.author) || Boolean(story.role);

                return (
                  <article
                    key={`${story.author ?? 'story'}-${index}`}
                    className='min-w-full'
                  >
                    <div className='grid lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)]'>
                      <div className='relative min-h-[260px] bg-[#F5DFCF] sm:min-h-[360px] lg:min-h-[540px]'>
                        {story.mainImageSrc ? (
                          <Image
                            src={story.mainImageSrc}
                            alt={`${story.author ?? 'Parent'} testimonial image`}
                            fill
                            sizes='(min-width: 1024px) 500px, 100vw'
                            className='object-cover'
                            priority={index === 0}
                          />
                        ) : (
                          <div
                            className='flex h-full min-h-[260px] items-center justify-center sm:min-h-[360px] lg:min-h-[540px]'
                            style={{ backgroundColor: IMAGE_FALLBACK_BG }}
                          >
                            <ParentIcon />
                          </div>
                        )}
                      </div>

                      <div className='flex flex-col p-6 sm:p-9 lg:px-12 lg:pb-10 lg:pt-12'>
                        <div className='flex flex-col items-start gap-4 border-b border-[rgba(31,31,31,0.2)] pb-8 sm:gap-5 lg:pb-[52px]'>
                          <Image
                            src={QUOTE_ICON_SRC}
                            alt=''
                            aria-hidden='true'
                            width={43}
                            height={43}
                            className='h-9 w-9 sm:h-11 sm:w-11'
                          />
                          <p className='w-full text-balance' style={quoteTextStyle}>
                            {quoteText}
                          </p>
                        </div>

                        {showMeta && (
                          <div className='mt-6 flex items-start gap-4 sm:mt-8 sm:gap-6'>
                            {story.avatarImageSrc ? (
                              <Image
                                src={story.avatarImageSrc}
                                alt={`${story.author ?? 'Parent'} avatar`}
                                width={100}
                                height={100}
                                className='h-[82px] w-[71px] shrink-0 rounded-[16px] object-cover sm:h-[100px] sm:w-[100px] sm:rounded-[20px]'
                              />
                            ) : (
                              <span
                                className='inline-flex h-[82px] w-[71px] shrink-0 items-center justify-center rounded-[16px] sm:h-[100px] sm:w-[100px] sm:rounded-[20px]'
                                style={{ backgroundColor: PROFILE_CARD_BG }}
                              >
                                <ParentIcon />
                              </span>
                            )}

                            <div className='min-w-0'>
                              {story.author && (
                                <p style={authorStyle}>{story.author}</p>
                              )}
                              {story.role && (
                                <p
                                  className={`max-w-[190px] ${story.author ? 'mt-1' : ''}`}
                                  style={metaTextStyle}
                                >
                                  {story.role}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {hasMultipleStories && (
            <div className='flex items-center justify-center gap-[14px] px-6 pb-6 pt-5 sm:gap-[18px] sm:px-9 lg:absolute lg:bottom-8 lg:right-8 lg:gap-[14px] lg:p-0'>
              <button
                type='button'
                onClick={goToPreviousStory}
                aria-label={previousButtonLabel}
                className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
                style={{
                  backgroundColor: CONTROL_BG,
                  boxShadow: CONTROL_SHADOW,
                }}
              >
                <ChevronIcon direction='left' />
              </button>
              <button
                type='button'
                onClick={goToNextStory}
                aria-label={nextButtonLabel}
                className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
                style={{
                  backgroundColor: CONTROL_BG,
                  boxShadow: CONTROL_SHADOW,
                }}
              >
                <ChevronIcon direction='right' />
              </button>
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
