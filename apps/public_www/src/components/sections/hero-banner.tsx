import type { CSSProperties } from 'react';
import Image from 'next/image';

import { BackgroundGlow } from '@/components/background-glow';
import { SectionCtaAnchor } from '@/components/section-cta-link';
import type { HeroContent } from '@/content';

interface HeroBannerProps {
  content: HeroContent;
}

const HERO_BACKGROUND =
  'var(--figma-colors-frame-2147235259, #FFEEE3)';
const HEADLINE_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const SUBHEADLINE_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const CTA_BACKGROUND = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT_COLOR = 'var(--figma-colors-desktop, #FFFFFF)';
const PANEL_COLOR_PRIMARY =
  'var(--figma-colors-frame-2147235228, #B2DDA4)';
const PANEL_COLOR_ACCENT =
  'var(--figma-colors-frame-2147235230, #FFA988)';
const PANEL_COLOR_SOFT =
  'var(--figma-colors-frame-2147235267, #F6DECD)';
const VISUAL_SHADOW =
  'var(--figma-boxshadow-freepik-enhance-86742-1, -22px 24px 77px 0px rgba(0, 0, 0, 0.1))';
const ACCENT_BLUE = '#548CC4';
const ACCENT_GREEN_LIGHT = '#A8CB44';
const ACCENT_GREEN = '#5D9D49';
const ACCENT_ORANGE = '#F98A5B';
const HERO_IMAGE_DESKTOP_SRC = '/images/hero/hero-banner-main.jpg';
const HERO_IMAGE_MOBILE_SRC = '/images/hero/hero-banner-mobile.jpg';

const headlineStyle: CSSProperties = {
  color: HEADLINE_COLOR,
  fontFamily: 'var(--figma-fontfamilies-urbanist, Urbanist), sans-serif',
  fontWeight: 'var(--figma-fontweights-800, 800)',
  fontSize: 'clamp(2.25rem, 6vw, var(--figma-fontsizes-77, 77px))',
  lineHeight:
    'clamp(2.8rem, 7vw, calc(var(--figma-lineheights-transform-auntie-into-your-childs-montessori-ally, 95) * 1px))',
};

const subheadlineStyle: CSSProperties = {
  color: SUBHEADLINE_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  fontSize:
    'clamp(1.08rem, 2.35vw, var(--figma-fontsizes-25-83224868774414, 25.83224868774414px))',
  lineHeight:
    'clamp(1.75rem, 3.1vw, calc(var(--figma-lineheights-foster-independence-joy-and-confidence-with-training-that-turns-screen-time-into-meaningful-play, 44.130088806152344) * 1px))',
  letterSpacing:
    'calc(var(--figma-letterspacing-foster-independence-joy-and-confidence-with-training-that-turns-screen-time-into-meaningful-play, 0.2583224868774414) * 1px)',
};

const ctaStyle: CSSProperties = {
  backgroundColor: CTA_BACKGROUND,
  color: CTA_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  fontSize: 'clamp(1.1rem, 2.2vw, var(--figma-fontsizes-28, 28px))',
  lineHeight: 'var(--figma-fontsizes-28, 28px)',
};

const audienceHeadlineStyle: CSSProperties = {
  color: CTA_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-urbanist, Urbanist), sans-serif',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  lineHeight: 'var(--figma-lineheights-1-5k-auntie, 100%)',
};

const audienceBodyStyle: CSSProperties = {
  color: CTA_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-urbanist, Urbanist), sans-serif',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  lineHeight: 'var(--figma-lineheights-enjoy-our-programs, 100%)',
};

const visualMediaStyle: CSSProperties = {
  boxShadow: VISUAL_SHADOW,
  backgroundColor: 'var(--figma-colors-frame-2147235242, #174879)',
};

export function HeroBanner({ content }: HeroBannerProps) {
  return (
    <section
      aria-label={content.headline}
      data-figma-node='banner'
      className='relative isolate w-full overflow-hidden px-4 pb-14 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:min-h-[841px] lg:px-8 lg:pb-20 lg:pt-20'
      style={{ backgroundColor: HERO_BACKGROUND }}
    >
      <BackgroundGlow
        className='-left-40 top-1/2 hidden h-[48rem] w-[36rem] -translate-y-1/2 blur-3xl xl:block'
        background='radial-gradient(circle at 50% 50%, rgba(23, 72, 121, 0.34), rgba(231, 108, 61, 0.22) 48%, rgba(178, 221, 164, 0.18) 78%, rgba(255, 255, 255, 0) 100%)'
        opacity={0.5}
      />

      <div className='mx-auto grid w-full max-w-[1735px] items-center gap-10 lg:grid-cols-[minmax(0,622px)_minmax(0,764px)] lg:justify-between lg:gap-14'>
        <div className='relative z-10 max-w-[622px] space-y-8'>
          <div className='space-y-6 sm:space-y-8'>
            <h1 style={headlineStyle}>{content.headline}</h1>
            <p className='max-w-[573px]' style={subheadlineStyle}>
              {content.subheadline}
            </p>
          </div>

          <SectionCtaAnchor
            href='#courses'
            className='h-[64px] w-full max-w-[491px] rounded-[10px] px-5 focus-visible:outline-black/40 sm:h-[72px] sm:px-7 lg:h-[81px]'
            style={ctaStyle}
          >
            {content.cta}
          </SectionCtaAnchor>
        </div>

        <div className='relative mx-auto w-full max-w-[764px] lg:mx-0 lg:justify-self-end'>
          <div className='relative aspect-[720/841] w-full'>
            <div
              aria-hidden='true'
              className='absolute left-0 top-[21%] h-[26%] w-[94%] rounded-[32px]'
              style={{ backgroundColor: PANEL_COLOR_PRIMARY }}
            />
            <div
              aria-hidden='true'
              className='absolute left-0 top-[21%] h-[26%] w-[37%] rounded-[32px]'
              style={{ backgroundColor: PANEL_COLOR_ACCENT }}
            />
            <div
              aria-hidden='true'
              className='absolute right-[4%] top-[51%] h-[26%] w-[46%] rounded-[32px]'
              style={{ backgroundColor: PANEL_COLOR_SOFT }}
            />
            <div
              aria-hidden='true'
              className='absolute bottom-0 left-0 h-[26%] w-[94%] rounded-[32px]'
              style={{ backgroundColor: PANEL_COLOR_SOFT }}
            />
            <div
              aria-hidden='true'
              className='absolute bottom-0 left-0 h-[26%] w-[37%] rounded-[32px]'
              style={{ backgroundColor: PANEL_COLOR_SOFT }}
            />

            <div
              aria-hidden='true'
              className='absolute inset-x-[5%] bottom-0 top-0 overflow-hidden rounded-[32px]'
              style={visualMediaStyle}
            >
              <Image
                src={HERO_IMAGE_MOBILE_SRC}
                alt=''
                fill
                priority
                sizes='(max-width: 1023px) 88vw'
                className='object-cover object-center lg:hidden'
              />
              <Image
                src={HERO_IMAGE_DESKTOP_SRC}
                alt=''
                fill
                priority
                sizes='(min-width: 1024px) 720px'
                className='hidden object-cover object-center lg:block'
              />
              <div className='absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/20' />
              <div className='absolute inset-[9%] rounded-[28px] border border-white/15 bg-white/5' />
              <BackgroundGlow
                className='-left-[11%] bottom-[12%] h-[36%] w-[44%] blur-3xl'
                background='rgba(249, 138, 91, 0.27)'
              />
              <BackgroundGlow
                className='-right-[8%] top-[38%] h-[30%] w-[42%] blur-3xl'
                background='rgba(255, 255, 255, 0.1)'
              />
            </div>

            <div className='absolute left-[8%] top-[7%] z-20 rounded-2xl bg-black/40 px-4 py-3 text-white backdrop-blur-sm sm:px-5 sm:py-4'>
              <p style={audienceHeadlineStyle}>1.5k Auntie</p>
              <p className='mt-1' style={audienceBodyStyle}>
                Enjoy our programs
              </p>
            </div>

            <svg
              aria-hidden='true'
              className='absolute right-[3%] top-[15%] h-16 w-16 sm:h-20 sm:w-20'
              viewBox='0 0 80 74'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M6 39C16 8 64 8 74 39'
                stroke={ACCENT_BLUE}
                strokeWidth='7'
                strokeLinecap='round'
              />
              <path
                d='M17 61C30 44 50 44 63 61'
                stroke={ACCENT_BLUE}
                strokeWidth='6'
                strokeLinecap='round'
              />
            </svg>

            <svg
              aria-hidden='true'
              className='absolute right-[12%] top-[46%] h-12 w-12 sm:h-14 sm:w-14'
              viewBox='0 0 60 58'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M30 2V20M30 38V56M2 29H20M40 29H58M11 10L22 21M38 37L49 48M49 10L38 21M22 37L11 48'
                stroke={ACCENT_ORANGE}
                strokeWidth='6'
                strokeLinecap='round'
              />
            </svg>

            <span
              aria-hidden='true'
              className='absolute bottom-[14%] right-[11%] block h-[46px] w-[46px] rounded-full'
              style={{ backgroundColor: ACCENT_GREEN_LIGHT }}
            />
            <span
              aria-hidden='true'
              className='absolute bottom-[9%] right-[4%] block h-[45px] w-[48px] rounded-full'
              style={{ backgroundColor: ACCENT_GREEN }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
