'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import {
  readCandidateText,
  readOptionalText,
  toRecord,
} from '@/content/content-field-utils';
import type { TestimonialsContent } from '@/content';

interface TestimonialsProps {
  content: TestimonialsContent;
}

interface NormalizedStory {
  quote?: string;
  author?: string;
  service?: string;
  mainImageSrc?: string;
}

const TESTIMONIAL_CONTROL_BUTTON_CLASSNAME = 'es-btn--control';
const CLONE_SETTLE_DELAY_MS = 120;

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
    service: readCandidateText(record, ['service', 'subtitle', 'title']),
    mainImageSrc: readCandidateText(record, [
      'mainImageSrc',
      'slideImageSrc',
      'imageSrc',
      'image',
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

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function getSlideItemWidth(carousel: HTMLElement): number {
  const firstChild = carousel.firstElementChild;
  if (!firstChild) {
    return carousel.clientWidth;
  }
  const gap = parseFloat(getComputedStyle(carousel).columnGap || '0');
  return firstChild.clientWidth + gap;
}

function getActiveDomIndex(carousel: HTMLElement): number {
  const itemWidth = getSlideItemWidth(carousel);
  if (itemWidth <= 0) {
    return 0;
  }
  return Math.round(carousel.scrollLeft / itemWidth);
}

function TestimonialSlide({
  story,
  fallbackQuote,
  isClone,
  showAttribution,
}: {
  story: NormalizedStory;
  fallbackQuote: string;
  isClone?: boolean;
  showAttribution?: boolean;
}) {
  return (
    <article
      className='flex min-w-full max-w-full shrink-0 snap-center'
      aria-hidden={isClone || undefined}
    >
      <div
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--testimonials',
        )}
      >
        <div className='relative mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-card-lg es-bg-surface-peach lg:mx-0 lg:mt-[70px]'>
          {story.mainImageSrc ? (
            <Image
              src={story.mainImageSrc}
              alt={isClone ? '' : `${story.author ?? 'Parent'} testimonial image`}
              fill
              sizes='200px'
              className='rounded-card-lg object-cover'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center rounded-card-lg es-testimonials-image-fallback'>
              <ParentIcon />
            </div>
          )}
        </div>

        <div className='flex flex-col px-6 sm:px-9 lg:px-12'>
          <div className='flex flex-col items-start gap-4 border-b border-[rgba(31,31,31,0.2)] pb-8 sm:gap-5 lg:pb-[52px]'>
            <span
              aria-hidden='true'
              className='es-testimonial-quote-icon h-9 w-9 sm:h-11 sm:w-11'
            />
            <p className='w-full text-balance es-testimonials-quote'>
              {story.quote ?? fallbackQuote}
            </p>
          </div>

          {showAttribution && (story.author || story.service) && (
            <div className='relative mt-6 sm:mt-8'>
              <div className='min-w-0'>
                {story.author && (
                  <p className='es-testimonials-author'>{story.author}</p>
                )}
                {story.service && (
                  <p
                    className={`max-w-[190px] es-testimonials-meta ${story.author ? 'mt-1' : ''}`}
                  >
                    {story.service}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function AuthorStrip({
  stories,
  activeIndex,
}: {
  stories: NormalizedStory[];
  activeIndex: number;
}) {
  const count = stories.length;
  const nextIndex = wrapIndex(activeIndex + 1, count);
  const secondNextIndex = wrapIndex(activeIndex + 2, count);

  const currentAuthor = stories[activeIndex]?.author ?? '';
  const currentService = stories[activeIndex]?.service ?? '';
  const nextAuthor = stories[nextIndex]?.author ?? '';
  const secondNextAuthor = stories[secondNextIndex]?.author ?? '';

  return (
    <div
      data-testid='testimonials-author-strip'
      className='mt-6 grid grid-cols-4 items-start gap-x-2 px-4 sm:px-6'
      aria-hidden='true'
    >
      <div className='col-span-2 min-w-0 text-left'>
        <span className='block truncate text-sm font-semibold es-text-heading sm:text-base'>
          {currentAuthor}
        </span>
        {currentService && (
          <span className='block truncate text-xs es-text-neutral-strong sm:text-sm'>
            {currentService}
          </span>
        )}
      </div>

      <span className='col-span-1 min-w-0 truncate pt-1 text-left text-[11px] opacity-40 es-text-heading sm:text-xs'>
        {nextAuthor}
      </span>

      <span className='col-span-1 min-w-0 truncate pt-1 text-left text-[11px] opacity-40 es-text-heading sm:text-xs'>
        {secondNextAuthor}
      </span>
    </div>
  );
}

export function Testimonials({ content }: TestimonialsProps) {
  const stories = useMemo(() => normalizeStories(content.items), [content.items]);
  const storiesToRender =
    stories.length > 0
      ? stories
      : [{ quote: content.title } satisfies NormalizedStory];

  const hasMultipleStories = storiesToRender.length > 1;
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRepositioningRef = useRef(false);
  const [activeRealIndex, setActiveRealIndex] = useState(0);

  const realCount = storiesToRender.length;

  const badgeLabel = content.badgeLabel.trim() || content.title;
  const descriptionText = content.description.trim();
  const previousButtonLabel = content.previousButtonLabel.trim();
  const nextButtonLabel = content.nextButtonLabel.trim();

  const teleportToDomIndex = useCallback((carousel: HTMLElement, domIndex: number) => {
    const itemWidth = getSlideItemWidth(carousel);
    isRepositioningRef.current = true;
    carousel.style.scrollSnapType = 'none';
    carousel.scrollLeft = domIndex * itemWidth;
    void carousel.offsetHeight;
    carousel.style.scrollSnapType = '';
    requestAnimationFrame(() => {
      isRepositioningRef.current = false;
    });
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || !hasMultipleStories) {
      return;
    }

    teleportToDomIndex(carousel, 1);
  }, [hasMultipleStories, teleportToDomIndex]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || !hasMultipleStories) {
      return;
    }

    function handleScroll() {
      const el = carouselRef.current;
      if (!el || isRepositioningRef.current) {
        return;
      }

      const domIndex = getActiveDomIndex(el);
      const realIndex = domIndex - 1;
      setActiveRealIndex(wrapIndex(realIndex, realCount));

      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
      }

      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        const current = carouselRef.current;
        if (!current || isRepositioningRef.current) {
          return;
        }

        const settledDomIndex = getActiveDomIndex(current);

        if (settledDomIndex === 0) {
          teleportToDomIndex(current, realCount);
          setActiveRealIndex(realCount - 1);
        } else if (settledDomIndex === realCount + 1) {
          teleportToDomIndex(current, 1);
          setActiveRealIndex(0);
        }
      }, CLONE_SETTLE_DELAY_MS);
    }

    carousel.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      carousel.removeEventListener('scroll', handleScroll);
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [hasMultipleStories, realCount, teleportToDomIndex]);

  function scrollByOne(direction: 'prev' | 'next') {
    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    const itemWidth = getSlideItemWidth(carousel);
    const offset = direction === 'prev' ? -itemWidth : itemWidth;
    carousel.scrollBy({ left: offset, behavior: 'smooth' });
  }

  return (
    <SectionShell
      id='testimonials'
      ariaLabel={content.title}
      dataFigmaNode='testimonials'
      className='es-section-bg-overlay es-testimonials-section'
    >
      <SectionContainer>
        <div className='mx-auto w-full max-w-[1116px]'>
        <SectionHeader
          eyebrow={badgeLabel}
          title={content.title}
          description={descriptionText || undefined}
          descriptionClassName='es-type-body mt-3'
        />

        <div
          data-testid='testimonials-card'
          className='relative mt-10 overflow-hidden bg-white lg:mt-14'
        >
          <CarouselTrack
            carouselRef={carouselRef}
            testId='testimonials-carousel-track'
            ariaLabel={`${content.title} carousel`}
            className='flex gap-4 pb-2'
            aria-live='polite'
          >
            {hasMultipleStories && (
              <TestimonialSlide
                key='clone-last'
                story={storiesToRender[realCount - 1]}
                fallbackQuote={content.title}
                isClone
                showAttribution={!hasMultipleStories}
              />
            )}

            {storiesToRender.map((story, index) => (
              <TestimonialSlide
                key={`${story.author ?? 'story'}-${index}`}
                story={story}
                fallbackQuote={content.title}
                showAttribution={!hasMultipleStories}
              />
            ))}

            {hasMultipleStories && (
              <TestimonialSlide
                key='clone-first'
                story={storiesToRender[0]}
                fallbackQuote={content.title}
                isClone
                showAttribution={!hasMultipleStories}
              />
            )}
          </CarouselTrack>

          {hasMultipleStories && (
            <AuthorStrip stories={storiesToRender} activeIndex={activeRealIndex} />
          )}

          {hasMultipleStories && (
            <div className='mt-4 hidden justify-end lg:flex'>
              <div className='flex items-center gap-[14px]'>
                <ButtonPrimitive
                  variant='control'
                  onClick={() => {
                    scrollByOne('prev');
                  }}
                  aria-label={previousButtonLabel}
                  className={TESTIMONIAL_CONTROL_BUTTON_CLASSNAME}
                >
                  <ChevronIcon direction='left' />
                </ButtonPrimitive>
                <ButtonPrimitive
                  variant='control'
                  onClick={() => {
                    scrollByOne('next');
                  }}
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
      </SectionContainer>
    </SectionShell>
  );
}
