import type { CSSProperties } from 'react';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { MyBestAuntieDescriptionContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface MyBestAuntieDescriptionProps {
  content: MyBestAuntieDescriptionContent;
}

const SECTION_BACKGROUND = 'var(--figma-colors-frame-2147235259, #FFEEE3)';
const CARD_BACKGROUND = '#FFFFFF';

const eyebrowStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '18px',
  fontWeight: 500,
  lineHeight: 1,
};

const titleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: 1.15,
};

const descriptionStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: 1.55,
};

function cardTone(index: number): string {
  if (index % 3 === 0) {
    return '#FFF7F0';
  }

  if (index % 3 === 1) {
    return '#FFF3E7';
  }

  return '#FFF8F4';
}

function iconSymbol(icon: string): string {
  const normalized = icon.trim().toLowerCase();
  if (normalized.includes('live')) {
    return 'LT';
  }
  if (normalized.includes('review')) {
    return 'AR';
  }
  if (normalized.includes('workbook')) {
    return 'WB';
  }

  return 'ES';
}

export function MyBestAuntieDescription({
  content,
}: MyBestAuntieDescriptionProps) {
  return (
    <SectionShell
      id='my-best-auntie-description'
      ariaLabel={content.title}
      dataFigmaNode='courseHiglit_sec'
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[920px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
            className='px-4 py-2.5 sm:px-5'
            style={{ borderColor: '#EECAB0', backgroundColor: '#FFFFFF' }}
          />
          <h2
            className='mt-6 text-[clamp(2rem,5.6vw,3.2rem)]'
            style={titleStyle}
          >
            {content.title}
          </h2>
        </div>

        <ul className='mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
          {content.items.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <article
                className='group h-full rounded-[24px] border border-[#E7D0BC] p-5 transition-transform duration-200 hover:-translate-y-1 sm:p-6'
                style={{
                  backgroundColor: CARD_BACKGROUND,
                  boxShadow: '0 20px 45px -40px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div
                  className='inline-flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold'
                  style={{
                    backgroundColor: cardTone(index),
                    color: '#C84A16',
                    border: '1px solid #EECAB0',
                  }}
                >
                  {iconSymbol(item.icon)}
                </div>
                <h3 className='mt-4 text-[1.4rem] font-semibold text-[#333333]'>
                  {item.title}
                </h3>
                <p className='mt-3 text-base text-[#4A4A4A]' style={descriptionStyle}>
                  {item.description}
                </p>
                <a
                  href={item.ctaHref}
                  className='mt-5 inline-flex text-sm font-semibold text-[#C84A16] underline underline-offset-2'
                >
                  {item.ctaLabel}
                </a>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
