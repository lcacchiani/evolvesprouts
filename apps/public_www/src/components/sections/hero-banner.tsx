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
const HERO_IMAGE_SRC = '/images/hero/child-hero.webp';
const HEADLINE_HIGHLIGHT_WORD = 'Montessori';
const HERO_DECORATION =
  'radial-gradient(circle at 10% 22%, rgba(231, 108, 61, 0.18) 0%, rgba(231, 108, 61, 0) 44%), radial-gradient(circle at 84% 30%, rgba(93, 157, 73, 0.12) 0%, rgba(93, 157, 73, 0) 52%), radial-gradient(circle at 92% 88%, rgba(23, 72, 121, 0.1) 0%, rgba(23, 72, 121, 0) 46%)';

const headlineStyle: CSSProperties = {
  color: HEADLINE_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: '700',
  fontSize: 'clamp(2.15rem, 5.8vw, 60px)',
  lineHeight: 'clamp(2.65rem, 6.3vw, 66px)',
  letterSpacing: '0',
};

const subheadlineStyle: CSSProperties = {
  color: SUBHEADLINE_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  fontSize: 'clamp(1rem, 2.1vw, 25px)',
  lineHeight: 'clamp(1.45rem, 3.1vw, 44px)',
  letterSpacing: '0.5px',
};

const ctaStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: '600',
  fontSize: '18px',
  lineHeight: '1',
  letterSpacing: '0',
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
      className='relative w-full overflow-hidden px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8 lg:pb-16 lg:pt-0'
      style={{ backgroundColor: HERO_BACKGROUND }}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0'
        style={{ background: HERO_DECORATION }}
      />
      <div className='relative mx-auto grid w-full max-w-[1465px] items-center gap-8 lg:grid-cols-2 lg:gap-6'>
        <div className='max-w-[620px] lg:pb-4 lg:pr-8 lg:pt-[70px]'>
          <h1 style={headlineStyle}>{renderHeadline(content.headline)}</h1>
          <p className='mt-4 max-w-[610px] sm:mt-6' style={subheadlineStyle}>
            {content.subheadline}
          </p>
          <SectionCtaLink
            href='/training-courses'
            className='mt-6 h-[55px] rounded-[10px] px-[34px] focus-visible:outline-black/40'
            style={ctaStyle}
          >
            {content.cta}
          </SectionCtaLink>
        </div>
        <div className='mx-auto w-full max-w-[764px] lg:ml-auto lg:mr-0'>
          <Image
            src={HERO_IMAGE_SRC}
            alt=''
            width={764}
            height={841}
            priority
            fetchPriority='high'
            sizes='(max-width: 640px) 92vw, (max-width: 1024px) 70vw, 764px'
            className='h-auto w-full'
          />
        </div>
      </div>
    </section>
  );
}
