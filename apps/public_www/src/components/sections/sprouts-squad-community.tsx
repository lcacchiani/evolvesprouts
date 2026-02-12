import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { SectionShell } from '@/components/section-shell';
import type { SproutsSquadCommunityContent } from '@/content';

interface SproutsSquadCommunityProps {
  content: SproutsSquadCommunityContent;
}

const SECTION_BACKGROUND =
  'var(--figma-colors-frame-2147235259, #FFEEE3)';
const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const CTA_BACKGROUND = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT_COLOR = 'var(--figma-colors-desktop, #FFFFFF)';

const headingStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  letterSpacing:
    'calc(var(--figma-letterspacing-join-our-sprouts-squad-community, 0.77) * 1px)',
};

const ctaStyle: CSSProperties = {
  backgroundColor: CTA_BACKGROUND,
  color: CTA_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight:
    'var(--figma-lineheights-sign-up-to-our-monthly-newsletter, 100%)',
};

export function SproutsSquadCommunity({
  content,
}: SproutsSquadCommunityProps) {
  return (
    <SectionShell
      id='sprouts-squad-community'
      ariaLabel={content.heading}
      dataFigmaNode='sprouts-squad-community'
      className='relative isolate overflow-hidden !px-0 !py-0'
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <Image
        src='/images/footer-community-bg.webp'
        alt=''
        fill
        sizes='100vw'
        className='object-cover object-top'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(circle at center top, rgba(255,255,255,0) 15%, rgba(255,238,227,0.74) 68%)',
        }}
      />

      <div className='relative z-10 mx-auto flex min-h-[420px] w-full max-w-[1465px] flex-col justify-center gap-7 px-4 py-14 sm:min-h-[530px] sm:px-6 sm:py-20 lg:min-h-[740px] lg:gap-9 lg:px-8'>
        <Image
          src='/images/community-badge.webp'
          alt=''
          width={241}
          height={247}
          className='h-auto w-[82px] sm:w-[96px] lg:w-[118px]'
        />
        <h2
          className='max-w-[620px] text-[clamp(1.9rem,6vw,55px)] leading-[1.12] sm:-mt-6 lg:-mt-[52px]'
          style={headingStyle}
        >
          {content.heading}
        </h2>

        <Link
          href={content.ctaHref}
          className='inline-flex h-14 w-full max-w-[500px] items-center justify-center rounded-[10px] px-5 text-center text-base transition-opacity hover:opacity-90 sm:h-[62px] sm:text-lg lg:h-[74px] lg:max-w-[410px] lg:text-[26px]'
          style={ctaStyle}
        >
          {content.ctaLabel}
        </Link>
      </div>
    </SectionShell>
  );
}
