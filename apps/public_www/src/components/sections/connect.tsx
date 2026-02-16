import type { CSSProperties } from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { ContactUsContent } from '@/content';
import { DEFAULT_SECTION_EYEBROW_STYLE, HEADING_TEXT_COLOR } from '@/lib/design-tokens';
import { isHttpHref } from '@/lib/url-utils';

interface ConnectProps {
  content: ContactUsContent['connect'];
}

const SECTION_BACKGROUND = '#FFFFFF';
const SECTION_BACKGROUND_IMAGE = 'url("/images/evolvesprouts-logo.svg")';
const SECTION_BACKGROUND_SIZE = '900px auto';
const eyebrowStyle: CSSProperties = DEFAULT_SECTION_EYEBROW_STYLE;

const cardTitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.2rem, 2.5vw, 1.7rem)',
  fontWeight: 600,
  lineHeight: '1.25',
};

const ctaStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 600,
  fontSize: '18px',
  lineHeight: '1',
};

function ConnectGlyph({ index }: { index: number }) {
  const iconColor = ['#174879', '#5D9D49', '#C84A16'][index % 3];

  return (
    <span
      aria-hidden='true'
      className='inline-flex h-12 w-12 items-center justify-center rounded-full'
      style={{ backgroundColor: `${iconColor}1A` }}
    >
      <svg
        viewBox='0 0 20 20'
        className='h-5 w-5'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M4 10H16M10 4L16 10L10 16'
          stroke={iconColor}
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </span>
  );
}

export function Connect({ content }: ConnectProps) {
  return (
    <SectionShell
      id='connect'
      ariaLabel={content.title}
      dataFigmaNode='connect'
      className='relative isolate overflow-hidden bg-white'
      style={{
        backgroundColor: SECTION_BACKGROUND,
        backgroundImage: SECTION_BACKGROUND_IMAGE,
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: SECTION_BACKGROUND_SIZE,
      }}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[840px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
          />
          <h2 className='es-section-heading mt-6 text-balance'>{content.title}</h2>
        </div>

        <ul className='mt-10 grid grid-cols-1 gap-5 lg:mt-12 lg:grid-cols-3'>
          {content.cards.map((card, index) => (
            <li key={`${card.title}-${card.ctaHref}`}>
              <article className='flex h-full flex-col rounded-3xl border border-[#EEDCCD] bg-[#FFF9F4] p-5 shadow-[0_16px_34px_-24px_rgba(0,0,0,0.52)] sm:p-6'>
                <ConnectGlyph index={index} />
                <h3 className='mt-4' style={cardTitleStyle}>
                  {card.title}
                </h3>
                <p className='es-section-body mt-2 text-base leading-7'>
                  {card.description}
                </p>
                <SectionCtaAnchor
                  href={card.ctaHref}
                  className='mt-auto h-12 w-full rounded-[10px] px-4 text-base sm:h-[52px]'
                  style={ctaStyle}
                  {...(isHttpHref(card.ctaHref)
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {card.ctaLabel}
                </SectionCtaAnchor>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
