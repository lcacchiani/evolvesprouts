import type { CSSProperties } from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionHeader } from '@/components/section-header';
import { SectionShell } from '@/components/section-shell';
import type { ContactUsContent } from '@/content';
import {
  BRAND_ORANGE,
  HEADING_TEXT_COLOR,
  SURFACE_WHITE,
} from '@/lib/design-tokens';
import { buildSectionBackgroundStyle } from '@/lib/section-backgrounds';

interface ConnectProps {
  content: ContactUsContent['connect'];
}

const SECTION_STYLE = buildSectionBackgroundStyle({
  backgroundColor: SURFACE_WHITE,
  position: 'center top',
  size: '900px auto',
});

const cardTitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.2rem, 2.5vw, 1.7rem)',
  fontWeight: 600,
  lineHeight: '1.25',
};

function ConnectGlyph({ index }: { index: number }) {
  const iconTones = [
    {
      stroke: 'var(--figma-colors-frame-2147235242, #174879)',
      background:
        'color-mix(in srgb, var(--figma-colors-frame-2147235242, #174879) 10%, transparent)',
    },
    {
      stroke: 'var(--es-color-accent-green, #5D9D49)',
      background:
        'color-mix(in srgb, var(--es-color-accent-green, #5D9D49) 10%, transparent)',
    },
    {
      stroke: BRAND_ORANGE,
      background:
        `color-mix(in srgb, ${BRAND_ORANGE} 10%, transparent)`,
    },
  ] as const;
  const tone = iconTones[index % iconTones.length];

  return (
    <span
      aria-hidden='true'
      className='inline-flex h-12 w-12 items-center justify-center rounded-full'
      style={{ backgroundColor: tone.background }}
    >
      <svg
        viewBox='0 0 20 20'
        className='h-5 w-5'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M4 10H16M10 4L16 10L10 16'
          stroke={tone.stroke}
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </span>
  );
}

export function Connect({ content }: ConnectProps) {
  return (
    <SectionShell
      id='connect'
      ariaLabel={content.title}
      dataFigmaNode='connect'
      className='relative isolate overflow-hidden bg-white'
      style={SECTION_STYLE}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={content.title}
          titleClassName='text-balance'
        />

        <ul className='mt-10 grid grid-cols-1 gap-5 lg:mt-12 lg:grid-cols-3'>
          {content.cards.map((card, index) => (
            <li key={`${card.title}-${card.ctaHref}`}>
              <article className='flex h-full flex-col rounded-3xl border es-border-warm-1 es-bg-surface-soft p-5 shadow-[0_16px_34px_-24px_rgba(0,0,0,0.52)] sm:p-6'>
                <ConnectGlyph index={index} />
                <h3 className='mt-4' style={cardTitleStyle}>
                  {card.title}
                </h3>
                <p className='es-section-body mt-2 text-base leading-7'>
                  {card.description}
                </p>
                <SectionCtaAnchor
                  href={card.ctaHref}
                  className='mt-auto w-full'
                >
                  {card.ctaLabel}
                </SectionCtaAnchor>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
