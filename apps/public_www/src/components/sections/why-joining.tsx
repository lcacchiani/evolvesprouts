import type { CSSProperties } from 'react';
import Link from 'next/link';

import type { WhyJoiningContent } from '@/content';
import enContent from '@/content/en.json';

interface WhyJoiningProps {
  content: WhyJoiningContent;
}

type BenefitCardTone = 'gold' | 'blue';
type BenefitCardArt =
  | 'age'
  | 'confidence'
  | 'group'
  | 'montessori'
  | 'support'
  | 'tools';

interface BenefitCard {
  id: string;
  title: string;
  tone: BenefitCardTone;
  art: BenefitCardArt;
  description?: string;
}

interface BenefitCardMeta {
  id: string;
  tone: BenefitCardTone;
  art: BenefitCardArt;
}

const SECTION_BG = 'var(--figma-colors-frame-2147235259, #FFEEE3)';
const HEADING_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const GOLD_CARD = 'var(--figma-colors-frame-2147235239, #AE7B1B)';
const BLUE_CARD = 'var(--figma-colors-frame-2147235242, #174879)';
const WHITE = 'var(--figma-colors-desktop, #FFFFFF)';
const CTA_BG = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const DARK_SCRIM =
  'var(--figma-colors-rectangle-240648659, rgba(0, 0, 0, 0.7))';

const fallbackWhyJoiningCopy = enContent.whyJoining;

const benefitCardMeta: BenefitCardMeta[] = [
  {
    id: 'age-specific',
    tone: 'gold',
    art: 'age',
  },
  {
    id: 'guaranteed-confidence',
    tone: 'blue',
    art: 'confidence',
  },
  {
    id: 'small-group-learning',
    tone: 'blue',
    art: 'group',
  },
  {
    id: 'montessori-positive-discipline',
    tone: 'gold',
    art: 'montessori',
  },
  {
    id: 'ongoing-support',
    tone: 'blue',
    art: 'support',
  },
  {
    id: 'ready-to-use-tools',
    tone: 'gold',
    art: 'tools',
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
  fontSize: 'clamp(1.05rem, 2.4vw, var(--figma-fontsizes-28, 28px))',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight:
    'clamp(1.75rem, 3.2vw, calc(var(--figma-lineheights-transform-your-auntie-into-a-montessori-guided-child-development-partner, 50) * 1px))',
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

  return benefitCardMeta
    .map((meta) => {
      const cardCopy = itemById.get(meta.id);
      if (!cardCopy) {
        return null;
      }

      const descriptionText =
        typeof cardCopy.description === 'string'
          ? cardCopy.description.trim()
          : '';
      return {
        ...meta,
        title: cardCopy.title,
        description: descriptionText ? descriptionText : undefined,
      };
    })
    .filter((card): card is BenefitCard => card !== null);
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

function CardArtwork({
  tone,
  art,
  supportChipLabel,
}: {
  tone: BenefitCardTone;
  art: BenefitCardArt;
  supportChipLabel: string;
}) {
  const edgeGlow =
    tone === 'gold' ? 'rgba(255, 216, 189, 0.36)' : 'rgba(191, 217, 239, 0.3)';
  const innerGlow =
    tone === 'gold' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.14)';
  const accentGlow =
    tone === 'gold' ? 'rgba(231, 108, 61, 0.26)' : 'rgba(168, 203, 68, 0.24)';

  return (
    <>
      <div
        aria-hidden='true'
        className='absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl'
        style={{ backgroundColor: edgeGlow }}
      />
      <div
        aria-hidden='true'
        className='absolute -left-14 bottom-[-70px] h-56 w-56 rounded-full blur-3xl'
        style={{ backgroundColor: accentGlow }}
      />
      <div
        aria-hidden='true'
        className='absolute bottom-[-72px] right-3 h-[240px] w-[240px] rounded-[42px] border border-white/25 bg-white/10'
        style={{ transform: 'rotate(17deg)' }}
      />

      {art === 'age' && (
        <div
          aria-hidden='true'
          className='absolute bottom-[-36px] right-0 h-[245px] w-[220px] rounded-[34px] border border-white/20'
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.04) 100%)',
            transform: 'rotate(-9deg)',
          }}
        />
      )}

      {art === 'confidence' && (
        <>
          <div
            aria-hidden='true'
            className='absolute bottom-[-58px] left-[-30px] h-[240px] w-[210px] rounded-[34px] border border-white/25'
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 100%)',
              transform: 'rotate(8deg)',
            }}
          />
          <div
            aria-hidden='true'
            className='absolute bottom-7 right-8 h-[90px] w-[90px] rounded-full border border-white/30'
            style={{ backgroundColor: innerGlow }}
          />
        </>
      )}

      {art === 'group' && (
        <>
          <div
            aria-hidden='true'
            className='absolute bottom-[-80px] right-[-20px] h-[260px] w-[280px] rounded-[54px] border border-white/25'
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.03) 100%)',
              transform: 'rotate(-7deg)',
            }}
          />
          <div
            aria-hidden='true'
            className='absolute bottom-8 left-8 h-[80px] w-[160px] rounded-full border border-white/25'
            style={{ backgroundColor: innerGlow }}
          />
        </>
      )}

      {art === 'montessori' && (
        <>
          <div
            aria-hidden='true'
            className='absolute bottom-[-68px] left-[-8px] h-[252px] w-[230px] rounded-[40px] border border-white/20'
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.04) 100%)',
              transform: 'rotate(-10deg)',
            }}
          />
          <div
            aria-hidden='true'
            className='absolute bottom-7 right-10 h-[66px] w-[66px] rounded-full border border-white/30'
            style={{ backgroundColor: innerGlow }}
          />
        </>
      )}

      {art === 'support' && (
        <>
          <div
            aria-hidden='true'
            className='absolute bottom-[24px] left-[18px] h-[154px] w-[146px] rounded-[24px] border border-white/25'
            style={{
              backgroundColor: 'rgba(255, 238, 227, 0.18)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div
            aria-hidden='true'
            className='absolute bottom-[6px] right-3 h-[190px] w-[165px] rounded-[26px] border border-white/25 bg-white/10'
          />
          <div
            aria-hidden='true'
            className='absolute bottom-[120px] left-[52px] rounded-[6px] px-3 py-1'
            style={{ backgroundColor: CTA_BG }}
          >
            <span
              style={{
                color: WHITE,
                fontFamily:
                  'var(--figma-fontfamilies-plus-jakarta-sans, Plus Jakarta Sans), sans-serif',
                fontSize: 'var(--figma-fontsizes-11, 11px)',
                fontWeight: 'var(--figma-fontweights-500, 500)',
                lineHeight: 'var(--figma-lineheights-connect-now, 100%)',
              }}
            >
              {supportChipLabel}
            </span>
          </div>
        </>
      )}

      {art === 'tools' && (
        <>
          <div
            aria-hidden='true'
            className='absolute inset-0'
            style={{
              background:
                'linear-gradient(170deg, rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 0.35) 100%)',
            }}
          />
          <div
            aria-hidden='true'
            className='absolute inset-0 rounded-[28px]'
            style={{ backgroundColor: DARK_SCRIM, opacity: 0.2 }}
          />
        </>
      )}
    </>
  );
}

export function WhyJoining({ content }: WhyJoiningProps) {
  const sectionTitle = content.title || fallbackWhyJoiningCopy.title;
  const sectionDescription =
    content.description || fallbackWhyJoiningCopy.description;
  const sectionEyebrow = content.eyebrow || fallbackWhyJoiningCopy.eyebrow;
  const ctaLabel = content.ctaLabel || fallbackWhyJoiningCopy.ctaLabel;
  const ctaHref = content.ctaHref || fallbackWhyJoiningCopy.ctaHref;
  const supportChipLabel =
    content.supportChipLabel || fallbackWhyJoiningCopy.supportChipLabel;
  const benefitCards = getBenefitCards(content);

  return (
    <section
      aria-label={sectionTitle}
      data-figma-node='Why Joining Our Courses'
      className='relative isolate w-full overflow-hidden px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24'
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
          <span
            className='inline-flex h-[46px] items-center justify-center gap-2 rounded-full border px-4 sm:px-5'
            style={{
              backgroundColor: WHITE,
              borderColor: '#FF9D59',
            }}
          >
            <span
              aria-hidden='true'
              className='relative inline-flex h-[23px] w-[31px] items-center justify-center'
            >
              <span
                className='absolute left-0 top-[6px] h-[10px] w-[10px] rounded-full'
                style={{
                  backgroundColor: 'var(--figma-colors-frame-2147235242, #174879)',
                }}
              />
              <span
                className='absolute right-0 top-[6px] h-[10px] w-[10px] rounded-full'
                style={{ backgroundColor: '#B31D1F' }}
              />
              <span
                className='absolute bottom-0 left-1/2 h-[10px] w-[10px] -translate-x-1/2 rounded-full'
                style={{ backgroundColor: '#5D9D49' }}
              />
            </span>
            <span style={sectionEyebrowStyle}>{sectionEyebrow}</span>
          </span>

          <h2 className='mt-6 text-balance' style={sectionTitleStyle}>
            {sectionTitle}
          </h2>

          {sectionDescription && (
            <p
              className='mx-auto mt-5 max-w-[920px] text-balance'
              style={sectionDescriptionStyle}
            >
              {sectionDescription}
            </p>
          )}
        </div>

        <ul className='mt-12 grid grid-cols-1 gap-5 sm:mt-14 sm:gap-6 md:grid-cols-2 xl:mt-16 xl:grid-cols-3'>
          {benefitCards.map((card) => {
            const cardBg = card.tone === 'gold' ? GOLD_CARD : BLUE_CARD;

            return (
              <li key={card.id}>
                <article
                  className='relative isolate flex min-h-[320px] overflow-hidden rounded-[28px] p-5 sm:min-h-[380px] sm:p-7 lg:min-h-[457px] lg:p-8'
                  style={{ backgroundColor: cardBg }}
                >
                  <CardArtwork
                    tone={card.tone}
                    art={card.art}
                    supportChipLabel={supportChipLabel}
                  />

                  <div className='relative z-10 flex h-full w-full flex-col'>
                    <span className='inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white'>
                      <BenefitIcon />
                    </span>

                    <div className='mt-auto space-y-4'>
                      <h3 className='max-w-[12ch] text-balance' style={cardTitleStyle}>
                        {card.title}
                      </h3>

                      {card.description && (
                        <p className='max-w-[34ch]' style={cardDescriptionStyle}>
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

        <div className='mt-10 flex justify-center sm:mt-12 lg:mt-14'>
          <Link
            href={ctaHref}
            className='inline-flex h-[62px] w-full max-w-[488px] items-center justify-center gap-2 rounded-[8px] px-5 text-center transition-transform duration-200 hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40 sm:h-[70px] sm:px-7 lg:h-[78px]'
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
          </Link>
        </div>
      </div>
    </section>
  );
}
