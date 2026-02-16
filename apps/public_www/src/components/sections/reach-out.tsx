import type { CSSProperties } from 'react';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { ContactUsContent } from '@/content';
import {
  DEFAULT_SECTION_EYEBROW_STYLE,
  HEADING_TEXT_COLOR,
} from '@/lib/design-tokens';

interface ReachOutProps {
  content: ContactUsContent['reachOut'];
}

const SECTION_BACKGROUND = 'var(--figma-colors-frame-2147235259, #FFEEE3)';
const SECTION_BACKGROUND_IMAGE = 'url("/images/evolvesprouts-logo.svg")';
const SECTION_BACKGROUND_SIZE = '900px auto';
const eyebrowStyle: CSSProperties = DEFAULT_SECTION_EYEBROW_STYLE;

function ReachOutGlyph({ index }: { index: number }) {
  const colorMap = ['#C84A16', '#174879', '#9E6D12', '#5D9D49'] as const;
  const color = colorMap[index % colorMap.length];

  return (
    <span
      aria-hidden='true'
      className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-white'
      style={{ borderColor: `${color}40` }}
    >
      <svg
        viewBox='0 0 24 24'
        className='h-5 w-5'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M6 12.2L10.3 16.5L18 8.8'
          stroke={color}
          strokeWidth='2.4'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </span>
  );
}

export function ReachOut({ content }: ReachOutProps) {
  return (
    <SectionShell
      id='reach-out'
      ariaLabel={content.title}
      dataFigmaNode='reach-out'
      className='relative isolate overflow-hidden'
      style={{
        backgroundColor: SECTION_BACKGROUND,
        backgroundImage: SECTION_BACKGROUND_IMAGE,
        backgroundPosition: 'center -400px',
        backgroundRepeat: 'no-repeat',
        backgroundSize: SECTION_BACKGROUND_SIZE,
        backgroundBlendMode: 'difference',
      }}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[840px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
            className='px-4 py-2.5 sm:px-5'
            style={{ backgroundColor: '#FFF8F2', borderColor: '#EECAB0' }}
          />
          <h2 className='es-section-heading mt-6 text-balance'>{content.title}</h2>
        </div>

        <ul className='mt-10 grid grid-cols-1 gap-4 sm:gap-5 lg:mt-12 lg:grid-cols-2'>
          {content.items.map((item, index) => (
            <li key={item.title}>
              <article className='flex h-full gap-4 rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-[0_16px_28px_-24px_rgba(0,0,0,0.5)] sm:px-6 sm:py-6'>
                <ReachOutGlyph index={index} />
                <div className='space-y-1.5'>
                  <h3 className='es-section-heading text-[clamp(1.2rem,2.4vw,1.6rem)]'>
                    {item.title}
                  </h3>
                  <p className='es-section-body text-base leading-7'>
                    {item.description}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
