import { CourseHighlightCard } from '@/components/sections/course-highlight-card';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { CourseHighlightsContent } from '@/content';
import enContent from '@/content/en.json';

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

const CARD_TONES = ['gold', 'blue'] as const;

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
  const benefitCards = getBenefitCards(content);

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

        <ul className='mt-12 grid grid-cols-1 gap-5 sm:mt-14 sm:gap-6 md:grid-cols-2 xl:mt-16 xl:grid-cols-3'>
          {benefitCards.map((card, index) => {
            const tone = CARD_TONES[index % CARD_TONES.length];

            return (
              <li key={card.id}>
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
