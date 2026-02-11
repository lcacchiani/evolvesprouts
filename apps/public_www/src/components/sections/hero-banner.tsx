import { Fragment, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';

import { SectionCtaLink } from '@/components/section-cta-link';
import type { HeroContent } from '@/content';

interface HeroBannerProps {
  content: HeroContent;
}

const HERO_BACKGROUND =
  'var(--figma-colors-frame-2147235259, #FFEEE3)';
const HEADLINE_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const HEADLINE_HIGHLIGHT =
  'var(--figma-colors-frame-2147235222-2, #ED622E)';
const SUBHEADLINE_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const CTA_BACKGROUND = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT_COLOR = 'var(--figma-colors-desktop, #FFFFFF)';
const HERO_IMAGE_SRC = '/images/hero/child-hero.png';
const HEADLINE_HIGHLIGHT_WORD = 'Montessori';

const headlineStyle: CSSProperties = {
  color: HEADLINE_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: '700',
  fontSize: 'clamp(2.2rem, 6vw, 60px)',
  lineHeight: 'clamp(2.7rem, 6.5vw, 66px)',
};

const subheadlineStyle: CSSProperties = {
  color: SUBHEADLINE_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  fontSize: 'clamp(1rem, 2vw, 25px)',
  lineHeight: 'clamp(1.45rem, 3vw, 44px)',
};

const ctaStyle: CSSProperties = {
  backgroundColor: CTA_BACKGROUND,
  color: CTA_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: '600',
  fontSize: '18px',
  lineHeight: '1',
};

const highlightedWordStyle: CSSProperties = {
  color: HEADLINE_HIGHLIGHT,
};

function renderHeadline(headline: string): ReactNode {
  const sections = headline.split(HEADLINE_HIGHLIGHT_WORD);
  if (sections.length === 1) {
    return headline;
  }

  return sections.map((section, index) => (
    <Fragment key={`${section}-${index}`}>
      {section}
      {index < sections.length - 1 && (
        <span style={highlightedWordStyle}>
          {HEADLINE_HIGHLIGHT_WORD}
        </span>
      )}
    </Fragment>
  ));
}

export function HeroBanner({ content }: HeroBannerProps) {
  return (
    <section
      aria-label={content.headline}
      data-figma-node='banner'
      className='w-full overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16'
      style={{ backgroundColor: HERO_BACKGROUND }}
    >
      <div className='mx-auto grid w-full max-w-[1495px] items-center gap-8 lg:grid-cols-2 lg:gap-10'>
        <div className='max-w-[630px] space-y-6 sm:space-y-8'>
          <h1 style={headlineStyle}>{renderHeadline(content.headline)}</h1>
          <p className='max-w-[610px]' style={subheadlineStyle}>
            {content.subheadline}
          </p>
          <SectionCtaLink
            href='/training-courses'
            className='h-[56px] w-full max-w-[380px] rounded-[10px] px-6 focus-visible:outline-black/40 sm:w-auto'
            style={ctaStyle}
          >
            {content.cta}
          </SectionCtaLink>
        </div>
        <div className='mx-auto w-full max-w-[764px] lg:mx-0 lg:justify-self-end'>
          <Image
            src={HERO_IMAGE_SRC}
            alt=''
            width={764}
            height={841}
            priority
            className='h-auto w-full'
          />
        </div>
      </div>
    </section>
  );
}
