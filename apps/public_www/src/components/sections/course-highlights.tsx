'use client';

import { CourseHighlightCard } from '@/components/sections/course-highlight-card';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type { CourseHighlightsContent } from '@/content';
import enContent from '@/content/en.json';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';

interface CourseHighlightsProps {
  content: CourseHighlightsContent;
}

interface BenefitCard {
  id: string;
  title: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
  description?: string;
}

interface BenefitCardMeta {
  id: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
}

const CARD_TONES = ['green', 'blue'] as const;

const fallbackCourseHighlightsCopy = enContent.courseHighlights;

const benefitCardMeta: BenefitCardMeta[] = [
  {
    id: 'age-specific',
    imageSrc: '/images/course-highlights/course-card-1.webp',
    imageWidth: 344,
    imageHeight: 309,
    imageClassName: 'h-[235px] sm:h-[265px] lg:h-[305px]',
  },
  {
    id: 'small-group-learning',
    imageSrc: '/images/course-highlights/course-card-2.webp',
    imageWidth: 433,
    imageHeight: 424,
    imageClassName: 'h-[250px] sm:h-[285px] lg:h-[328px]',
  },
  {
    id: 'montessori-positive-discipline',
    imageSrc: '/images/course-highlights/course-card-3.webp',
    imageWidth: 282,
    imageHeight: 335,
    imageClassName: 'h-[230px] sm:h-[265px] lg:h-[305px]',
  },
  {
    id: 'ongoing-support',
    imageSrc: '/images/course-highlights/course-card-4.webp',
    imageWidth: 308,
    imageHeight: 323,
    imageClassName: 'h-[230px] sm:h-[258px] lg:h-[294px]',
  },
  {
    id: 'ready-to-use-tools',
    imageSrc: '/images/course-highlights/course-card-5.webp',
    imageWidth: 472,
    imageHeight: 457,
    imageClassName: 'h-[245px] sm:h-[282px] lg:h-[320px]',
  },
  {
    id: 'guaranteed-confidence',
    imageSrc: '/images/course-highlights/course-card-6.webp',
    imageWidth: 433,
    imageHeight: 443,
    imageClassName: 'h-[245px] sm:h-[282px] lg:h-[320px]',
  },
];

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`h-7 w-7 es-text-icon ${rotationClass}`}
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

function getBenefitCards(content: CourseHighlightsContent): BenefitCard[] {
  const activeItems =
    content.items.length > 0
      ? content.items
      : fallbackCourseHighlightsCopy.items;
  const itemById = new Map(activeItems.map((item) => [item.id, item]));
  const cards: BenefitCard[] = [];

  for (const meta of benefitCardMeta) {
    const cardCopy = itemById.get(meta.id);
    if (!cardCopy) {
      continue;
    }

    const descriptionText =
      typeof cardCopy.description === 'string'
        ? cardCopy.description.trim()
        : '';

    if (descriptionText) {
      cards.push({
        ...meta,
        title: cardCopy.title,
        description: descriptionText,
      });
    } else {
      cards.push({
        ...meta,
        title: cardCopy.title,
      });
    }
  }

  return cards;
}

export function CourseHighlights({ content }: CourseHighlightsProps) {
  const sectionTitle = content.title || fallbackCourseHighlightsCopy.title;
  const sectionDescription =
    content.description || fallbackCourseHighlightsCopy.description;
  const sectionEyebrow =
    content.eyebrow || fallbackCourseHighlightsCopy.eyebrow;
  const ctaLabel = content.ctaLabel || fallbackCourseHighlightsCopy.ctaLabel;
  const ctaHref = content.ctaHref || fallbackCourseHighlightsCopy.ctaHref;
  const scrollLeftAriaLabel =
    content.scrollLeftAriaLabel?.trim() || 'Scroll course highlights left';
  const scrollRightAriaLabel =
    content.scrollRightAriaLabel?.trim() || 'Scroll course highlights right';
  const benefitCards = getBenefitCards(content);
  const {
    carouselRef,
    hasNavigation: hasCarouselNavigation,
    canScrollPrevious,
    canScrollNext,
    scrollByDirection,
  } = useHorizontalCarousel<HTMLUListElement>({
    itemCount: benefitCards.length,
  });

  function handleCarouselNavigation(direction: 'prev' | 'next') {
    scrollByDirection(direction);
  }

  return (
    <SectionShell
      id='course-highlights'
      ariaLabel={sectionTitle}
      dataFigmaNode='course-highlights'
      className='es-section-bg-overlay es-course-highlights-section'
    >
      <div
        aria-hidden='true'
        className='es-course-highlights-overlay pointer-events-none absolute inset-0'
      />

      <SectionContainer>
        <SectionHeader
          eyebrow={sectionEyebrow}
          title={sectionTitle}
        />

        <div className='relative mt-12 sm:mt-14 xl:mt-16'>
          <div className='w-full min-w-0 overflow-hidden md:overflow-visible'>
            <ul
              ref={carouselRef}
              data-testid='course-highlights-mobile-carousel'
              className='-mx-1 flex min-w-0 snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-6 md:mx-0 md:grid md:grid-cols-2 md:snap-none md:gap-6 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3'
            >
              {benefitCards.map((card, index) => {
                const tone = CARD_TONES[index % CARD_TONES.length];

                return (
                  <li
                    key={card.id}
                    className='w-[84vw] max-w-[360px] shrink-0 snap-start sm:w-[68vw] md:w-auto md:max-w-none md:shrink md:snap-none'
                  >
                    <CourseHighlightCard
                      id={card.id}
                      title={card.title}
                      imageSrc={card.imageSrc}
                      imageWidth={card.imageWidth}
                      imageHeight={card.imageHeight}
                      imageClassName={card.imageClassName}
                      description={card.description}
                      tone={tone}
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          {hasCarouselNavigation && canScrollPrevious && (
            <ButtonPrimitive
              variant='control'
              onClick={() => {
                handleCarouselNavigation('prev');
              }}
              aria-label={scrollLeftAriaLabel}
              className='absolute left-0 top-1/2 z-20 -translate-x-1/3 -translate-y-1/2 md:hidden'
            >
              <ArrowIcon direction='left' />
            </ButtonPrimitive>
          )}

          {hasCarouselNavigation && canScrollNext && (
            <ButtonPrimitive
              variant='control'
              onClick={() => {
                handleCarouselNavigation('next');
              }}
              aria-label={scrollRightAriaLabel}
              className='absolute right-0 top-1/2 z-20 translate-x-1/3 -translate-y-1/2 md:hidden'
            >
              <ArrowIcon direction='right' />
            </ButtonPrimitive>
          )}
        </div>

        {sectionDescription && (
          <div className='mt-9 text-center sm:mt-11 lg:mt-12'>
            <p className='es-type-body-italic mx-auto max-w-[780px] text-balance'>
              {sectionDescription}
            </p>
          </div>
        )}

        <div className='mt-8 flex justify-center sm:mt-10 lg:mt-11'>
          <SectionCtaAnchor
            href={ctaHref}
            className='w-full max-w-[488px]'
          >
            {ctaLabel}
          </SectionCtaAnchor>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
