import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { CourseHighlightsContent } from '@/content';
import enContent from '@/content/en.json';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

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

const SECTION_BG = 'var(--figma-colors-frame-2147235259, #FFEEE3)';
const SECTION_BACKGROUND_IMAGE = 'url("/images/tree-background.png")';
const SECTION_BACKGROUND_SIZE = '1000px auto';
const HEADING_COLOR = HEADING_TEXT_COLOR;
const BODY_COLOR = BODY_TEXT_COLOR;
const GOLD_CARD = '#9E6D12';
const BLUE_CARD = 'var(--figma-colors-frame-2147235242, #174879)';
const WHITE = 'var(--figma-colors-desktop, #FFFFFF)';

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

const sectionEyebrowStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: 'var(--figma-fontsizes-18, 18px)',
};

const sectionTitleStyle: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(2.2rem, 6vw, var(--figma-fontsizes-55, 55px))',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight: 'clamp(2.9rem, 7.2vw, 70px)',
};

const sectionDescriptionStyle: CSSProperties = {
  color: BODY_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 2.2vw, var(--figma-fontsizes-28, 28px))',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  fontStyle: 'italic',
  lineHeight: 'clamp(1.5rem, 3vw, 50px)',
  letterSpacing:
    'calc(var(--figma-letterspacing-transform-your-auntie-into-a-montessori-guided-child-development-partner, 0.28) * 1px)',
};

const cardTitleStyle: CSSProperties = {
  color: WHITE,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.45rem, 3.4vw, var(--figma-fontsizes-37, 37px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight:
    'clamp(1.95rem, 4.6vw, calc(var(--figma-lineheights-age-specific-strategies, 50) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-age-specific-strategies, 0.37) * 1px)',
};

const cardDescriptionStyle: CSSProperties = {
  color: WHITE,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 2.2vw, var(--figma-fontsizes-22, 22px))',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight:
    'clamp(1.45rem, 2.8vw, calc(var(--figma-lineheights-scripts-workbooks-and-troubleshooting-guides-for-real-life-challenges, 36) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-scripts-workbooks-and-troubleshooting-guides-for-real-life-challenges, 0.3079999947547913) * 1px)',
};

const ctaStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.05rem, 2.3vw, var(--figma-fontsizes-28, 28px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-fontsizes-28, 28px)',
};

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

function DecorativeCardArrow() {
  return (
    <span
      aria-hidden='true'
      className='pointer-events-none absolute bottom-5 left-5 z-10 inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white/15 ring-1 ring-white/35 transition-all duration-300 lg:bottom-7 lg:left-7 lg:group-hover:h-[70px] lg:group-hover:w-[70px]'
    >
      <span className='inline-flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#ED622E] shadow-[0_4px_10px_rgba(0,0,0,0.18)]'>
        <svg
          aria-hidden='true'
          viewBox='0 0 20 20'
          className='h-4 w-4'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M7 4L13 10L7 16'
            stroke={WHITE}
            strokeWidth='2.2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </span>
    </span>
  );
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
      ariaLabel={sectionTitle}
      dataFigmaNode='Course Highlights'
      className='relative isolate overflow-hidden'
      style={{
        backgroundColor: SECTION_BG,
        backgroundImage: SECTION_BACKGROUND_IMAGE,
        backgroundPosition: 'center -400px',
        backgroundRepeat: 'no-repeat',
        backgroundSize: SECTION_BACKGROUND_SIZE,
        backgroundBlendMode: 'difference',
      }}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(circle at 16% 22%, rgba(23, 72, 121, 0.1) 0%, rgba(23, 72, 121, 0) 47%), radial-gradient(circle at 88% 78%, rgba(231, 108, 61, 0.16) 0%, rgba(231, 108, 61, 0) 52%)',
        }}
      />

      <div className='relative mx-auto w-full max-w-[1520px]'>
        <div className='mx-auto max-w-[1000px] text-center'>
          <SectionEyebrowChip
            label={sectionEyebrow}
            labelStyle={sectionEyebrowStyle}
            className='h-[46px] justify-center px-4 sm:px-5'
            style={{
              backgroundColor: WHITE,
              borderColor: '#FF9D59',
            }}
          />

          <h2 className='mt-6 text-balance' style={sectionTitleStyle}>
            {sectionTitle}
          </h2>
        </div>

        <ul className='mt-12 grid grid-cols-1 gap-5 sm:mt-14 sm:gap-6 md:grid-cols-2 xl:mt-16 xl:grid-cols-3'>
          {benefitCards.map((card, index) => {
            const cardBg = index % 2 === 0 ? GOLD_CARD : BLUE_CARD;

            return (
              <li key={card.id}>
                <article
                  className='group relative isolate flex min-h-[320px] overflow-hidden rounded-[25px] p-5 sm:min-h-[345px] sm:p-7 lg:min-h-[457px] lg:p-8'
                  style={{ backgroundColor: cardBg }}
                >
                  <div
                    aria-hidden='true'
                    className='pointer-events-none absolute inset-0 z-[1] bg-black/0 transition-all duration-300 lg:group-hover:bg-black/70 lg:group-hover:backdrop-blur-[4px]'
                  />
                  <div
                    aria-hidden='true'
                    className='pointer-events-none absolute bottom-0 right-0 z-0'
                  >
                    <Image
                      src={card.imageSrc}
                      alt=''
                      width={card.imageWidth}
                      height={card.imageHeight}
                      sizes='(max-width: 640px) 240px, (max-width: 1024px) 300px, 340px'
                      className={`${card.imageClassName} w-auto max-w-none`}
                    />
                  </div>
                  <DecorativeCardArrow />

                  <div className='relative z-10 flex h-full w-full flex-col'>
                    <div className='mt-auto space-y-4'>
                      <h3 className='max-w-[12ch] text-balance' style={cardTitleStyle}>
                        {card.title}
                      </h3>

                      {card.description && (
                        <p
                          className='max-w-[34ch] opacity-100 transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100'
                          style={cardDescriptionStyle}
                        >
                          {card.description}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        {sectionDescription && (
          <div className='mt-9 text-center sm:mt-11 lg:mt-12'>
            <p
              className='mx-auto max-w-[780px] text-balance'
              style={sectionDescriptionStyle}
            >
              {sectionDescription}
            </p>
          </div>
        )}

        <div className='mt-8 flex justify-center sm:mt-10 lg:mt-11'>
          <SectionCtaAnchor
            href={ctaHref}
            className='h-[62px] w-full max-w-[488px] gap-2 rounded-[8px] px-5 sm:h-[70px] sm:px-7 lg:h-[78px]'
            style={ctaStyle}
          >
            {ctaLabel}
          </SectionCtaAnchor>
        </div>
      </div>
    </SectionShell>
  );
}
