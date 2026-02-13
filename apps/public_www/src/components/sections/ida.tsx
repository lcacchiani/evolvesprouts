import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionShell } from '@/components/section-shell';
import type { IdaContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface IdaProps {
  content: IdaContent;
}

const SECTION_BACKGROUND = '#FFFFFF';

const titleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: '1.15',
  fontSize: 'clamp(2rem, 6vw, 58px)',
};

const subtitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 500,
  lineHeight: '1.4',
  fontSize: 'clamp(1.05rem, 2.2vw, 26px)',
};

const bodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: '1.5',
  fontSize: 'clamp(1rem, 1.95vw, 24px)',
};

const ctaStyle: CSSProperties = {
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 600,
  lineHeight: '1',
  fontSize: '18px',
};

export function Ida({ content }: IdaProps) {
  return (
    <SectionShell
      id='ida'
      ariaLabel={content.title}
      dataFigmaNode='ida'
      style={{ backgroundColor: SECTION_BACKGROUND }}
      className='overflow-hidden'
    >
      <div className='mx-auto grid w-full max-w-[1465px] items-center gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10'>
        <div className='order-2 lg:order-1'>
          <h1 style={titleStyle}>{content.title}</h1>
          <p className='mt-4 max-w-[760px]' style={subtitleStyle}>
            {content.subtitle}
          </p>
          <p className='mt-4 max-w-[720px]' style={bodyStyle}>
            {content.description}
          </p>
          <SectionCtaAnchor
            href={content.ctaHref}
            className='mt-8 h-[56px] rounded-[10px] px-6 sm:h-[62px]'
            style={ctaStyle}
          >
            {content.ctaLabel}
          </SectionCtaAnchor>
        </div>

        <div className='order-1 lg:order-2'>
          <div className='relative isolate mx-auto min-h-[320px] max-w-[680px] overflow-hidden rounded-[34px] border border-[#F2D8C4] bg-[linear-gradient(170deg,#FFEBDD_0%,#FFF8F2_100%)] p-5 sm:min-h-[380px] sm:p-6 lg:min-h-[430px] lg:p-8'>
            <div
              aria-hidden='true'
              className='absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[#F1BD99]/45 blur-3xl'
            />
            <div
              aria-hidden='true'
              className='absolute -bottom-16 -right-12 h-56 w-56 rounded-full bg-[#A8D6A2]/40 blur-3xl'
            />

            <div className='relative z-10 flex h-full flex-col justify-between'>
              <div className='flex items-center justify-between'>
                <div className='h-9 w-40 rounded-full border border-[#EECAB0] bg-white/80' />
                <Image
                  src='/images/evolvesprouts-logo.svg'
                  alt=''
                  width={52}
                  height={52}
                  className='h-[52px] w-[52px] rounded-full bg-white p-1'
                />
              </div>

              <div className='grid gap-3 sm:grid-cols-3'>
                <div className='h-20 rounded-2xl bg-white/85 shadow-[0_14px_32px_-26px_rgba(0,0,0,0.55)]' />
                <div className='h-20 rounded-2xl bg-white/85 shadow-[0_14px_32px_-26px_rgba(0,0,0,0.55)]' />
                <div className='h-20 rounded-2xl bg-white/85 shadow-[0_14px_32px_-26px_rgba(0,0,0,0.55)]' />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
