import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionCtaLink } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { WhyJoiningContent } from '@/content';
import enContent from '@/content/en.json';

interface WhyJoiningProps {
  content: WhyJoiningContent;
}

type BenefitCardTone = 'gold' | 'blue';

interface BenefitCard {
  id: string;
  title: string;
  tone: BenefitCardTone;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
  description?: string;
}

interface BenefitCardMeta {
  id: string;
  tone: BenefitCardTone;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
}

const SECTION_BG = 'var(--figma-colors-frame-2147235259, #FFEEE3)';
const HEADING_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const GOLD_CARD = 'var(--figma-colors-frame-2147235239, #AE7B1B)';
const BLUE_CARD = 'var(--figma-colors-frame-2147235242, #174879)';
const WHITE = 'var(--figma-colors-desktop, #FFFFFF)';
const CTA_BG = 'var(--figma-colors-frame-2147235222-2, #ED622E)';

const fallbackWhyJoiningCopy = enContent.whyJoining;

const benefitCardMeta: BenefitCardMeta[] = [
  {
    id: 'age-specific',
    tone: 'gold',
    imageSrc: '/images/why-joining/course-card-1.png',
    imageWidth: 344,
    imageHeight: 309,
    imageClassName: 'h-[235px] sm:h-[265px] lg:h-[305px]',
  },
  {
    id: 'small-group-learning',
    tone: 'blue',
    imageSrc: '/images/why-joining/course-card-2.png',
    imageWidth: 433,
    imageHeight: 424,
    imageClassName: 'h-[250px] sm:h-[285px] lg:h-[328px]',
  },
  {
    id: 'montessori-positive-discipline',
    tone: 'gold',
    imageSrc: '/images/why-joining/course-card-3.png',
    imageWidth: 282,
    imageHeight: 335,
    imageClassName: 'h-[230px] sm:h-[265px] lg:h-[305px]',
  },
  {
    id: 'ongoing-support',
    tone: 'gold',
    imageSrc: '/images/why-joining/course-card-4.png',
    imageWidth: 308,
    imageHeight: 323,
    imageClassName: 'h-[230px] sm:h-[258px] lg:h-[294px]',
  },
  {
    id: 'ready-to-use-tools',
    tone: 'blue',
    imageSrc: '/images/why-joining/course-card-5.png',
    imageWidth: 472,
    imageHeight: 457,
    imageClassName: 'h-[245px] sm:h-[282px] lg:h-[320px]',
  },
  {
    id: 'guaranteed-confidence',
    tone: 'gold',
    imageSrc: '/images/why-joining/course-card-6.png',
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
  backgroundColor: CTA_BG,
  color: WHITE,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1.05rem, 2.3vw, var(--figma-fontsizes-28, 28px))',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-fontsizes-28, 28px)',
};

function getBenefitCards(content: WhyJoiningContent): BenefitCard[] {
  const activeItems =
    content.items.length > 0 ? content.items : fallbackWhyJoiningCopy.items;
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

function BenefitIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 32 32'
      className='h-[31px] w-[31px]'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M16 4.75L19.95 12.74L28.77 14.02L22.38 20.25L23.89 29.03L16 24.88L8.11 29.03L9.62 20.25L3.23 14.02L12.05 12.74L16 4.75Z'
        stroke='var(--figma-colors-frame-1000007814, #1F1F1F)'
        strokeWidth='2'
      />
      <circle
        cx='16'
        cy='16'
        r='2.5'
        fill='var(--figma-colors-frame-1000007814, #1F1F1F)'
      />
    </svg>
  );
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

export function WhyJoining({ content }: WhyJoiningProps) {
  const sectionTitle = content.title || fallbackWhyJoiningCopy.title;
  const sectionDescription =
    content.description || fallbackWhyJoiningCopy.description;
  const sectionEyebrow = content.eyebrow || fallbackWhyJoiningCopy.eyebrow;
  const ctaLabel = content.ctaLabel || fallbackWhyJoiningCopy.ctaLabel;
  const ctaHref = content.ctaHref || fallbackWhyJoiningCopy.ctaHref;
  const benefitCards = getBenefitCards(content);

  return (
    <SectionShell
      ariaLabel={sectionTitle}
      dataFigmaNode='Why Joining Our Courses'
      className='relative isolate overflow-hidden'
      style={{ backgroundColor: SECTION_BG }}
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
          {benefitCards.map((card) => {
            const cardBg = card.tone === 'gold' ? GOLD_CARD : BLUE_CARD;

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
                    <span className='inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white'>
                      <BenefitIcon />
                    </span>

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
          <SectionCtaLink
            href={ctaHref}
            className='h-[62px] w-full max-w-[488px] gap-2 rounded-[8px] px-5 focus-visible:outline-black/40 sm:h-[70px] sm:px-7 lg:h-[78px]'
            style={ctaStyle}
          >
            <span>{ctaLabel}</span>
            <svg
              aria-hidden='true'
              viewBox='0 0 20 20'
              className='h-5 w-5 shrink-0'
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
          </SectionCtaLink>
        </div>
      </div>
    </SectionShell>
  );
}
