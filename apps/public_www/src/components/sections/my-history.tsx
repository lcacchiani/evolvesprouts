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
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <div className='mx-auto grid w-full max-w-[1465px] items-center gap-8 lg:grid-cols-2 lg:gap-12'>
        <div>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
            className='px-4 py-[11px] sm:px-5'
            style={{ borderColor: '#EECAB0', backgroundColor: '#FFFDF8' }}
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
          <div className='relative isolate overflow-hidden rounded-[30px] border border-[#EBCFB5] bg-[linear-gradient(170deg,#FFF7ED_0%,#FFEEE3_100%)] p-8 sm:p-10'>
            <div
              aria-hidden='true'
              className='absolute -top-10 right-8 h-28 w-28 rounded-full bg-[#F2A975]/35 blur-2xl'
            />
            <div
              aria-hidden='true'
              className='absolute -bottom-10 left-10 h-32 w-32 rounded-full bg-[#5D9D49]/25 blur-2xl'
            />
            <div className='relative z-10 flex min-h-[280px] items-end justify-between rounded-[22px] border border-white/70 bg-white/75 p-6 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.5)] sm:min-h-[330px]'>
              <Image
                src='/images/evolvesprouts-logo.svg'
                alt=''
                width={66}
                height={66}
                className='h-[66px] w-[66px] rounded-full bg-white p-1'
              />
              <div className='h-[145px] w-[145px] rounded-full border border-dashed border-[#D2A07A] bg-[#FFF6EF]' />
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
