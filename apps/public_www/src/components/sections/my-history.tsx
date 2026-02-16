import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { MyHistoryContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface MyHistoryProps {
  content: MyHistoryContent;
}

const SECTION_BACKGROUND = '#F7F2E1';

const eyebrowStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 500,
  lineHeight: '1',
  fontSize: '18px',
};

const titleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: '1.14',
  fontSize: 'clamp(1.95rem, 4.7vw, 50px)',
};

const subtitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 500,
  lineHeight: '1.4',
  fontSize: 'clamp(1rem, 2.1vw, 22px)',
};

const bodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: '1.55',
  fontSize: 'clamp(1rem, 1.9vw, 22px)',
};

export function MyHistory({ content }: MyHistoryProps) {
  return (
    <SectionShell
      id='my-history'
      ariaLabel={content.title}
      dataFigmaNode='my-history'
      style={{
        backgroundColor: SECTION_BACKGROUND,
        backgroundImage: 'url("/images/evolvesprouts-logo.svg")',
        backgroundPosition: 'left top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
      }}
    >
      <div className='mx-auto grid w-full max-w-[1465px] items-center gap-8 lg:grid-cols-2 lg:gap-12'>
        <div>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
          />
          <h2 className='mt-6 max-w-[780px]' style={titleStyle}>
            {content.title}
          </h2>
          <p className='mt-4 max-w-[760px]' style={subtitleStyle}>
            {content.subtitle}
          </p>
          <p className='mt-4 max-w-[760px]' style={bodyStyle}>
            {content.description}
          </p>
        </div>

        <div>
          <Image
            src='/images/about-us/ida-degregorio-evolvesprouts-2.webp'
            alt='A brief history image from Evolve Sprouts'
            width={925}
            height={780}
            sizes='(min-width: 1280px) 651px, (min-width: 1024px) 44vw, 100vw'
            className='h-auto w-full max-w-[651px] lg:ml-auto'
          />
        </div>
      </div>
    </SectionShell>
  );
}
