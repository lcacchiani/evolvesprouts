import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionContainer } from '@/components/section-container';
import { SectionShell } from '@/components/section-shell';
import type { SproutsSquadCommunityContent } from '@/content';
import { HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface SproutsSquadCommunityProps {
  content: SproutsSquadCommunityContent;
}

const SECTION_BACKGROUND =
  'var(--figma-colors-frame-2147235259, #FFEEE3)';
const FOREGROUND_LOGO_FILTER =
  'sepia(1) opacity(50%) saturate(150%)';
const FOREGROUND_LOGO_MASK_IMAGE =
  'linear-gradient(to bottom, black 50%, transparent 63%)';

const headingStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  letterSpacing:
    'calc(var(--figma-letterspacing-join-our-sprouts-squad-community, 0.77) * 1px)',
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

      <SectionContainer className='flex min-h-[420px] flex-col justify-center gap-7 px-4 py-14 sm:min-h-[530px] sm:px-6 sm:py-20 lg:min-h-[740px] lg:gap-9 lg:px-8'>
        <Image
          src='/images/evolvesprouts-logo.svg'
          alt=''
          width={250}
          height={250}
          className='h-auto w-[250px]'
          style={{
            filter: FOREGROUND_LOGO_FILTER,
            maskImage: FOREGROUND_LOGO_MASK_IMAGE,
            WebkitMaskImage: FOREGROUND_LOGO_MASK_IMAGE,
          }}
        />
        <h2
          className='max-w-[620px] text-[clamp(1.9rem,6vw,55px)] leading-[1.12] sm:-mt-6 lg:-mt-[52px]'
          style={headingStyle}
        >
          {content.heading}
        </h2>

        <SectionCtaAnchor
          href={content.ctaHref}
          className='w-full max-w-[500px] lg:max-w-[410px]'
        >
          {content.ctaLabel}
        </SectionCtaAnchor>
      </SectionContainer>
    </SectionShell>
  );
}
