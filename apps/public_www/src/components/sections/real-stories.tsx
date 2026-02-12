'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { RealStoriesContent } from '@/content';

interface RealStoriesProps {
  content: RealStoriesContent;
}

interface NormalizedStory {
  quote?: string;
  author?: string;
  role?: string;
  metaLocation?: string;
  badgeLabel?: string;
  previousButtonLabel?: string;
  nextButtonLabel?: string;
  mainImageSrc?: string;
  mainImageAlt?: string;
  avatarImageSrc?: string;
  avatarImageAlt?: string;
}

const TEXT_PRIMARY =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const TEXT_SECONDARY = 'var(--figma-colors-home, #4A4A4A)';
const CONTROL_BG = 'var(--figma-colors-frame-1000007814, #1F1F1F)';
const CONTROL_ICON = 'var(--figma-colors-rectangle-240648655, #FFBA89)';
const DIVIDER_COLOR = 'rgba(31, 31, 31, 0.2)';
const BADGE_BORDER = '#EECAB0';
const PROFILE_CARD_BG = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const IMAGE_FALLBACK_BG = '#F3DCCB';
const FADE_DURATION_MS = 1000;
const HALF_FADE_DURATION_MS = FADE_DURATION_MS / 2;

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
  fontSize: 'clamp(1.3rem, 2.5vw, 2rem)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1.6',
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

function getStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getCandidate(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = getStringValue(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeStory(item: unknown): NormalizedStory | null {
  if (typeof item === 'string') {
    const quote = getStringValue(item);
    return quote ? { quote } : null;
  }

  if (typeof item !== 'object' || item === null) {
    return null;
  }

  const record = item as Record<string, unknown>;
  const story: NormalizedStory = {
    badgeLabel: getCandidate(record, ['badgeLabel', 'badge', 'eyebrow', 'label']),
    quote: getCandidate(record, [
      'quote',
      'testimonial',
      'text',
      'description',
      'content',
    ]),
    author: getCandidate(record, ['author', 'name', 'parentName']),
    role: getCandidate(record, ['role', 'subtitle', 'title']),
    metaLocation: getCandidate(record, [
      'metaLocation',
      'from',
      'location',
      'city',
    ]),
    previousButtonLabel: getCandidate(record, [
      'previousButtonLabel',
      'previousAriaLabel',
      'previousLabel',
    ]),
    nextButtonLabel: getCandidate(record, [
      'nextButtonLabel',
      'nextAriaLabel',
      'nextLabel',
    ]),
    mainImageSrc: getCandidate(record, [
      'mainImageSrc',
      'slideImageSrc',
      'imageSrc',
      'image',
    ]),
    mainImageAlt: getCandidate(record, ['mainImageAlt', 'imageAlt']),
    avatarImageSrc: getCandidate(record, [
      'avatarImageSrc',
      'authorImageSrc',
      'userImageSrc',
      'avatar',
    ]),
    avatarImageAlt: getCandidate(record, [
      'avatarImageAlt',
      'authorImageAlt',
      'userImageAlt',
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
        strokeWidth='2.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 43 32'
      className='h-8 w-11 sm:h-10 sm:w-12'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M18.8 0H6.1L0 12.2V32H19.3V12.2H9.4L13.6 4.1H18.8V0Z'
        fill='#E76C3D'
      />
      <path
        d='M42.7 0H30.1L24 12.2V32H43.3V12.2H33.4L37.6 4.1H42.7V0Z'
        fill='#E76C3D'
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

export function RealStories({ content }: RealStoriesProps) {
  const stories = useMemo(() => normalizeStories(content.items), [content.items]);
  const storyCount = stories.length;
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const story =
    storyCount > 0
      ? stories[getWrappedIndex(activeStoryIndex, storyCount)]
      : null;
  const hasMultipleStories = storyCount > 1;
  const badgeLabel = story?.badgeLabel ?? content.title;
  const quoteText = story?.quote ?? content.title;
  const descriptionText = content.description.trim();
  const previousButtonLabel = story?.previousButtonLabel ?? badgeLabel;
  const nextButtonLabel = story?.nextButtonLabel ?? badgeLabel;
  const showMeta =
    Boolean(story?.author) ||
    Boolean(story?.role) ||
    Boolean(story?.metaLocation);

  const clearTimers = useCallback(() => {
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }

    if (fadeInTimerRef.current) {
      clearTimeout(fadeInTimerRef.current);
      fadeInTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  function transitionToStory(nextIndex: number) {
    if (!hasMultipleStories || isTransitioning) {
      return;
    }

    clearTimers();
    setIsTransitioning(true);
    setIsFadingOut(true);

    fadeOutTimerRef.current = setTimeout(() => {
      setActiveStoryIndex(getWrappedIndex(nextIndex, storyCount));
      setIsFadingOut(false);

      fadeInTimerRef.current = setTimeout(() => {
        setIsTransitioning(false);
      }, HALF_FADE_DURATION_MS);
    }, HALF_FADE_DURATION_MS);
  }

  function goToPreviousStory() {
    transitionToStory(activeStoryIndex - 1);
  }

  function goToNextStory() {
    transitionToStory(activeStoryIndex + 1);
  }

  return (
    <SectionShell
      ariaLabel={content.title}
      dataFigmaNode='Real Stories'
      className='relative isolate overflow-hidden'
    >
      <div className='relative mx-auto w-full max-w-[1488px]'>
        <div className='flex flex-col items-center gap-6 lg:gap-8'>
          <div className='flex w-full flex-col items-center justify-between gap-4 sm:flex-row'>
            <SectionEyebrowChip
              label={badgeLabel}
              labelStyle={badgeTextStyle}
              className='px-4 py-2.5'
              style={{
                borderColor: BADGE_BORDER,
                backgroundColor: 'rgba(255, 255, 255, 0.64)',
              }}
            />

            <div className='flex items-center gap-[14px] sm:gap-[21px]'>
              <button
                type='button'
                onClick={goToPreviousStory}
                disabled={!hasMultipleStories || isTransitioning}
                aria-label={previousButtonLabel}
                className='inline-flex h-[72px] w-[72px] items-center justify-center rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-100 sm:h-[85px] sm:w-[86px]'
                style={{ backgroundColor: CONTROL_BG }}
              >
                <ChevronIcon direction='left' />
              </button>
              <button
                type='button'
                onClick={goToNextStory}
                disabled={!hasMultipleStories || isTransitioning}
                aria-label={nextButtonLabel}
                className='inline-flex h-[72px] w-[72px] items-center justify-center rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-100 sm:h-[85px] sm:w-[86px]'
                style={{ backgroundColor: CONTROL_BG }}
              >
                <ChevronIcon direction='right' />
              </button>
            </div>
          </div>

          <h2 className='max-w-[760px] text-balance text-center' style={headingStyle}>
            {content.title}
          </h2>

          {descriptionText && (
            <p className='max-w-[760px] text-center' style={descriptionTextStyle}>
              {descriptionText}
            </p>
          )}
        </div>

        <div className='mt-10 overflow-hidden rounded-[30px] border border-[#EFD7C7] bg-white shadow-[0_28px_70px_rgba(18,18,17,0.08)] lg:mt-14'>
          <div
            aria-live='polite'
            className='transition-opacity'
            style={{
              opacity: isFadingOut ? 0 : 1,
              transitionDuration: `${HALF_FADE_DURATION_MS}ms`,
            }}
          >
            <div className='grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]'>
              <div className='relative min-h-[260px] bg-[#F5DFCF] sm:min-h-[360px] lg:min-h-[540px]'>
                {story?.mainImageSrc ? (
                  <Image
                    src={story.mainImageSrc}
                    alt={
                      story.mainImageAlt ??
                      `${story.author ?? 'Parent'} testimonial image`
                    }
                    fill
                    sizes='(min-width: 1024px) 560px, 100vw'
                    className='object-cover'
                    priority={activeStoryIndex === 0}
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

              <div className='flex flex-col p-6 sm:p-9 lg:p-12'>
                <div className='flex items-start gap-3 sm:gap-5'>
                  <span className='shrink-0 pt-1'>
                    <QuoteIcon />
                  </span>
                  <p className='text-balance' style={quoteTextStyle}>
                    {quoteText}
                  </p>
                </div>

                {showMeta && (
                  <>
                    <div
                      aria-hidden='true'
                      className='mt-8 h-px w-full'
                      style={{ backgroundColor: DIVIDER_COLOR }}
                    />

                    <div className='mt-8 flex items-start gap-4 sm:gap-6'>
                      {story?.avatarImageSrc ? (
                        <Image
                          src={story.avatarImageSrc}
                          alt={
                            story.avatarImageAlt ??
                            `${story.author ?? 'Parent'} avatar`
                          }
                          width={123}
                          height={123}
                          className='h-[90px] w-[90px] shrink-0 rounded-[18px] object-cover sm:h-[123px] sm:w-[123px]'
                        />
                      ) : (
                        <span
                          className='inline-flex h-[90px] w-[90px] shrink-0 items-center justify-center rounded-[18px] sm:h-[123px] sm:w-[123px]'
                          style={{ backgroundColor: PROFILE_CARD_BG }}
                        >
                          <ParentIcon />
                        </span>
                      )}

                      <div className='min-w-0'>
                        {story?.author && <p style={authorStyle}>{story.author}</p>}
                        {story?.role && (
                          <p className={story.author ? 'mt-1' : ''} style={metaTextStyle}>
                            {story.role}
                          </p>
                        )}
                        {story?.metaLocation && (
                          <p className='mt-1' style={metaTextStyle}>
                            {story.metaLocation}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
