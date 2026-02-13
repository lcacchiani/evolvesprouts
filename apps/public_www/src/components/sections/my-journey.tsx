import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { MyJourneyContent } from '@/content';

interface MyJourneyProps {
  content: MyJourneyContent;
}

const SECTION_BACKGROUND = '#FFFFFF';
const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_TEXT_COLOR = 'var(--figma-colors-home, #4A4A4A)';

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

const tagStyle: CSSProperties = {
  color: '#C84A16',
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 700,
  lineHeight: '1',
  fontSize: '14px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const bodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: '1.55',
  fontSize: 'clamp(1rem, 1.85vw, 22px)',
};

export function MyJourney({ content }: MyJourneyProps) {
  return (
    <SectionShell
      id='my-journey'
      ariaLabel={content.title}
      dataFigmaNode='my-journey'
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[980px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
            className='px-4 py-[11px] sm:px-5'
            style={{ borderColor: '#EECAB0' }}
          />
          <h2 className='mt-6' style={titleStyle}>
            {content.title}
          </h2>
        </div>

        <div className='mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-8'>
          <div className='relative isolate overflow-hidden rounded-[28px] border border-[#ECD5C3] bg-[linear-gradient(165deg,#FFEFE4_0%,#FFF8F3_100%)] p-6'>
            <div
              aria-hidden='true'
              className='absolute -top-9 right-6 h-24 w-24 rounded-full bg-[#A8D6A2]/35 blur-2xl'
            />
            <div
              aria-hidden='true'
              className='absolute -bottom-12 left-7 h-32 w-32 rounded-full bg-[#F2A975]/35 blur-2xl'
            />
            <div className='relative z-10 flex min-h-[340px] flex-col justify-between rounded-[20px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.6)]'>
              <Image
                src='/images/evolvesprouts-logo.svg'
                alt=''
                width={68}
                height={68}
                className='h-[68px] w-[68px] rounded-full bg-white p-1'
              />
              <div className='grid grid-cols-2 gap-3'>
                <div className='h-20 rounded-xl bg-[#FFF5EC]' />
                <div className='h-20 rounded-xl bg-[#F4FAF2]' />
              </div>
            </div>
          </div>

          <ul className='space-y-4'>
            {content.cards.map((card) => (
              <li key={card.tag}>
                <article className='rounded-[20px] border border-[#ECD5C3] bg-[#FFF9F5] p-5 sm:p-6'>
                  <span style={tagStyle}>{card.tag}</span>
                  <p className='mt-3' style={bodyStyle}>
                    {card.description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
