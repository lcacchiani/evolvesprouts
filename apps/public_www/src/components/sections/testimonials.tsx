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
  formatContentTemplate,
  readCandidateText,
  readOptionalText,
  toRecord,
} from '@/content/content-field-utils';
import enContent from '@/content/en.json';
import type {
  CommonAccessibilityContent,
  TestimonialsContent,
} from '@/content';
interface TestimonialsProps {
  content: TestimonialsContent;
  commonAccessibility?: CommonAccessibilityContent;
}

interface NormalizedStory {
  quote?: string;
  author?: string;
  service?: string;
  mainImageSrc?: string;
}

const TESTIMONIAL_CONTROL_BUTTON_CLASSNAME = 'es-btn--control';
const CLONE_SETTLE_DELAY_MS = 120;
const AUTHOR_ANIM_DURATION_MS = 300;

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
    <span
      aria-hidden
      className={`es-ui-icon-mask es-ui-icon-mask--chevron-right inline-block h-8 w-8 shrink-0 es-text-icon ${rotationClass}`}
    />
  );
}

function ParentIcon() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG asset from /public/images */}
      <img
        src='/images/testimonials-parent-icon.svg'
        alt=''
        aria-hidden
        className='h-[58px] w-[58px] sm:h-[68px] sm:w-[68px]'
      />
    </>
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
  a11yContent,
  isClone,
}: {
  story: NormalizedStory;
  fallbackQuote: string;
  a11yContent: TestimonialsContent['a11y'];
  isClone?: boolean;
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
              alt={
                isClone
                  ? ''
                  : formatContentTemplate(a11yContent.imageAltTemplate, {
                      author: story.author ?? a11yContent.imageAltFallbackAuthor,
                    })
              }
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
            <p className='w-full text-balance es-testimonials-quote es-testimonials-quote--desktop-four-lines'>
              {story.quote ?? fallbackQuote}
            </p>
          </div>

          {(story.author || story.service) && (
            <div className='relative mt-6 sm:mt-8 sm:hidden'>
              <div
                data-testid='testimonial-author-row'
                className='mx-auto w-full max-w-[500px] text-center lg:pr-[200px]'
              >
                {story.author && (
                  <p className='mx-auto max-w-[350px] es-testimonials-author'>
                    {story.author}
                  </p>
                )}
                {story.service && (
                  <p
                    className={`mx-auto max-w-[350px] es-testimonials-meta ${story.author ? 'mt-1' : ''}`}
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


function getInitials(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '');
  return letters.slice(0, 2).toUpperCase();
}

function arcPosition(offset: number): string {
  switch (offset) {
    case -2: return '-translate-x-[106px] translate-y-8 opacity-25';
    case -1: return '-translate-x-[62px] translate-y-2 opacity-60';
    case 0:  return '-translate-x-[18px] translate-y-0 opacity-100';
    case 1:  return 'translate-x-[26px] translate-y-2 opacity-60';
    case 2:  return 'translate-x-[70px] translate-y-8 opacity-25';
    default: return '-translate-x-[18px] translate-y-0 opacity-0';
  }
}

const STRIP_SWIPE_THRESHOLD_PX = 30;

const AUTHOR_CIRCLE_BASE =
  'absolute left-1/2 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-[#D98E50] bg-[#F2A975] text-xs font-semibold transition-all duration-300 ease-in-out es-text-heading';

function AuthorStrip({
  stories,
  activeIndex,
  onNavigate,
  a11yContent,
}: {
  stories: NormalizedStory[];
  activeIndex: number;
  onNavigate: (offset: number) => void;
  a11yContent: TestimonialsContent['a11y'];
}) {
  const count = stories.length;
  const touchStartXRef = useRef<number | null>(null);

  const visibleSlots = [-2, -1, 0, 1, 2].map((offset) => {
    const storyIndex = wrapIndex(activeIndex + offset, count);
    return { storyIndex, offset, author: stories[storyIndex]?.author ?? '' };
  });

  return (
    <div
      data-testid='testimonials-author-strip'
      className='relative mx-auto mt-6 h-[68px] w-full touch-pan-y sm:hidden'
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartXRef.current;
        touchStartXRef.current = null;
        if (delta > STRIP_SWIPE_THRESHOLD_PX) onNavigate(-1);
        else if (delta < -STRIP_SWIPE_THRESHOLD_PX) onNavigate(1);
      }}
      onTouchCancel={() => {
        touchStartXRef.current = null;
      }}
    >
      {visibleSlots.map(({ storyIndex, offset, author }) => (
        <button
          key={count >= 5 ? storyIndex : `${storyIndex}-${offset}`}
          type='button'
          onClick={offset !== 0 ? () => onNavigate(offset) : undefined}
          aria-label={
            offset === 0
              ? formatContentTemplate(a11yContent.currentAuthorLabelTemplate, {
                  author: author || a11yContent.imageAltFallbackAuthor,
                })
              : formatContentTemplate(a11yContent.goToAuthorLabelTemplate, {
                  author: author || a11yContent.imageAltFallbackAuthor,
                })
          }
          aria-current={offset === 0 ? 'true' : undefined}
          className={`${AUTHOR_CIRCLE_BASE} ${arcPosition(offset)} ${offset === 0 ? 'cursor-default' : 'cursor-pointer hover:brightness-110'}`}
        >
          {getInitials(author)}
        </button>
      ))}
    </div>
  );
}

function DesktopAuthorRow({
  stories,
  activeIndex,
  directionRef,
  onPrevious,
  onNext,
  previousButtonLabel,
  nextButtonLabel,
}: {
  stories: NormalizedStory[];
  activeIndex: number;
  directionRef: { readonly current: 'next' | 'prev' };
  onPrevious: () => void;
  onNext: () => void;
  previousButtonLabel: string;
  nextButtonLabel: string;
}) {
  const prevIndexRef = useRef(activeIndex);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anim, setAnim] = useState<{
    slots: { index: number; state: 'visible' | 'exiting' | 'entering' }[];
    dir: 'next' | 'prev';
  }>({
    slots: [{ index: activeIndex, state: 'visible' }],
    dir: 'next',
  });

  useEffect(() => {
    if (activeIndex === prevIndexRef.current) return;
    const oldIndex = prevIndexRef.current;
    const dir = directionRef.current;
    prevIndexRef.current = activeIndex;

    if (animTimerRef.current !== null) {
      clearTimeout(animTimerRef.current);
    }

    setAnim({
      slots: [
        { index: oldIndex, state: 'exiting' },
        { index: activeIndex, state: 'entering' },
      ],
      dir,
    });

    animTimerRef.current = setTimeout(() => {
      setAnim({
        slots: [{ index: activeIndex, state: 'visible' }],
        dir,
      });
      animTimerRef.current = null;
    }, AUTHOR_ANIM_DURATION_MS + 50);

    return () => {
      if (animTimerRef.current !== null) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
    };
  }, [activeIndex, directionRef]);

  return (
    <div
      data-testid='testimonials-desktop-controls'
      className='hidden px-6 sm:block sm:px-9 lg:px-12'
    >
      <div className='mt-6 mb-6'>
        <div className='mx-auto flex w-full max-w-[500px] items-center gap-3'>
          <ButtonPrimitive
            variant='control'
            onClick={onPrevious}
            aria-label={previousButtonLabel}
            className={`${TESTIMONIAL_CONTROL_BUTTON_CLASSNAME} shrink-0`}
          >
            <ChevronIcon direction='left' />
          </ButtonPrimitive>
          <div className='relative min-w-0 flex-1 overflow-hidden text-center'>
            {anim.slots.map(({ index, state }) => {
              const story = stories[index];
              if (!story?.author && !story?.service) return null;
              let slotClassName = '';
              if (state === 'exiting') {
                slotClassName =
                  anim.dir === 'next'
                    ? 'es-author-exit-left absolute inset-x-0 top-0'
                    : 'es-author-exit-right absolute inset-x-0 top-0';
              } else if (state === 'entering') {
                slotClassName =
                  anim.dir === 'next'
                    ? 'es-author-enter-from-right'
                    : 'es-author-enter-from-left';
              }
              return (
                <div
                  key={`${index}-${state}`}
                  className={slotClassName || undefined}
                >
                  {story.author && (
                    <p className='mx-auto max-w-[350px] es-testimonials-author'>
                      {story.author}
                    </p>
                  )}
                  {story.service && (
                    <p
                      className={`mx-auto max-w-[350px] es-testimonials-meta ${story.author ? 'mt-1' : ''}`}
                    >
                      {story.service}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <ButtonPrimitive
            variant='control'
            onClick={onNext}
            aria-label={nextButtonLabel}
            className={`${TESTIMONIAL_CONTROL_BUTTON_CLASSNAME} shrink-0`}
          >
            <ChevronIcon direction='right' />
          </ButtonPrimitive>
        </div>
      </div>
    </div>
  );
}

export function Testimonials({
  content,
  commonAccessibility = enContent.common.accessibility,
}: TestimonialsProps) {
  const a11yContent = content.a11y ?? enContent.testimonials.a11y;
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
  const directionRef = useRef<'next' | 'prev'>('next');
  const lastScrollLeftRef = useRef(0);

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
    lastScrollLeftRef.current = carousel.scrollLeft;
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

      if (el.scrollLeft > lastScrollLeftRef.current) {
        directionRef.current = 'next';
      } else if (el.scrollLeft < lastScrollLeftRef.current) {
        directionRef.current = 'prev';
      }
      lastScrollLeftRef.current = el.scrollLeft;

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
          lastScrollLeftRef.current = current.scrollLeft;
        } else if (settledDomIndex === realCount + 1) {
          teleportToDomIndex(current, 1);
          setActiveRealIndex(0);
          lastScrollLeftRef.current = current.scrollLeft;
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
    directionRef.current = direction;
    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    const itemWidth = getSlideItemWidth(carousel);
    const offset = direction === 'prev' ? -itemWidth : itemWidth;
    carousel.scrollBy({ left: offset, behavior: 'smooth' });
  }

  function navigateByOffset(offset: number) {
    if (offset === 0) {
      return;
    }

    directionRef.current = offset > 0 ? 'next' : 'prev';

    if (Math.abs(offset) === 1) {
      scrollByOne(offset > 0 ? 'next' : 'prev');
      return;
    }

    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    const targetRealIndex = wrapIndex(activeRealIndex + offset, realCount);
    teleportToDomIndex(carousel, targetRealIndex + 1);
    lastScrollLeftRef.current = carousel.scrollLeft;
    setActiveRealIndex(targetRealIndex);
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
            ariaLabel={formatContentTemplate(
              commonAccessibility.carouselLabelTemplate,
              { title: content.title },
            )}
            ariaRoleDescription={commonAccessibility.carouselRoleDescription}
            className='flex gap-4 pb-2'
            aria-live='polite'
          >
            {hasMultipleStories && (
              <TestimonialSlide
                key='clone-last'
                story={storiesToRender[realCount - 1]}
                fallbackQuote={content.title}
                a11yContent={a11yContent}
                isClone
              />
            )}

            {storiesToRender.map((story, index) => (
              <TestimonialSlide
                key={`${story.author ?? 'story'}-${index}`}
                story={story}
                fallbackQuote={content.title}
                a11yContent={a11yContent}
              />
            ))}

            {hasMultipleStories && (
              <TestimonialSlide
                key='clone-first'
                story={storiesToRender[0]}
                fallbackQuote={content.title}
                a11yContent={a11yContent}
                isClone
              />
            )}
          </CarouselTrack>

          {hasMultipleStories && (
            <DesktopAuthorRow
              stories={storiesToRender}
              activeIndex={activeRealIndex}
              directionRef={directionRef}
              onPrevious={() => {
                scrollByOne('prev');
              }}
              onNext={() => {
                scrollByOne('next');
              }}
              previousButtonLabel={previousButtonLabel}
              nextButtonLabel={nextButtonLabel}
            />
          )}

          {hasMultipleStories && (
            <AuthorStrip
              stories={storiesToRender}
              activeIndex={activeRealIndex}
              onNavigate={navigateByOffset}
              a11yContent={a11yContent}
            />
          )}
        </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
