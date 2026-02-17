import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { WhyUsContent } from '@/content';
import { HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface WhyUsProps {
  content: WhyUsContent;
}

const SECTION_BACKGROUND = 'var(--es-color-surface-warm, #F7F2E1)';

const introTitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 600,
  lineHeight: '1.25',
  fontSize: 'clamp(1.05rem, 2.2vw, 24px)',
};

const pillarTitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 600,
  lineHeight: '1.25',
  fontSize: 'clamp(1.1rem, 1.9vw, 24px)',
};

export function WhyUs({ content }: WhyUsProps) {
  return (
    <SectionShell
      id='why-us'
      ariaLabel={content.title}
      dataFigmaNode='why-us'
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[980px] text-center'>
          <SectionEyebrowChip label={content.eyebrow} />
          <h2 className='es-type-title mt-6'>
            {content.title}
          </h2>
        </div>

        <div className='mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-8'>
          <div
            className='relative isolate overflow-hidden rounded-[26px] border es-border-soft-alt p-6'
            style={{ background: 'var(--es-gradient-why-us)' }}
          >
            <div
              aria-hidden='true'
              className='absolute -left-10 top-8 h-32 w-32 rounded-full blur-2xl'
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--es-color-brand-orange-soft) 35%, transparent)',
              }}
            />
            <div
              aria-hidden='true'
              className='absolute -bottom-12 right-7 h-36 w-36 rounded-full blur-3xl'
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--es-color-accent-green-soft) 30%, transparent)',
              }}
            />
            <div className='relative z-10 flex min-h-[280px] items-end rounded-[20px] border border-white/70 bg-white/78 p-6 shadow-[0_18px_36px_-30px_rgba(0,0,0,0.55)] sm:min-h-[320px]'>
              <Image
                src='/images/evolvesprouts-logo.svg'
                alt=''
                width={74}
                height={74}
                className='h-[74px] w-[74px] rounded-full bg-white p-1'
              />
            </div>
          </div>

          <div className='rounded-[26px] border es-border-soft-alt bg-white/85 p-6 sm:p-7'>
            <h3 style={introTitleStyle}>{content.introTitle}</h3>
            <ul className='mt-4 space-y-3'>
              {content.introItems.map((item) => (
                <li key={item} className='flex items-start gap-3'>
                  <span
                    aria-hidden='true'
                    className='mt-2 inline-flex h-2.5 w-2.5 shrink-0 rounded-full es-bg-brand-orange'
                  />
                  <p className='es-type-body-base'>{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className='es-type-body-base mt-8 rounded-[22px] border es-border-soft-alt bg-white/70 p-5 sm:p-6'>
          {content.communityText}
        </p>

        <ul className='mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {content.pillars.map((pillar) => (
            <li key={pillar.title}>
              <article className='h-full rounded-[18px] border es-border-soft-alt es-bg-surface-cream p-5'>
                <h3 style={pillarTitleStyle}>{pillar.title}</h3>
                <p className='es-section-body mt-3 text-[16px] leading-[1.5]'>
                  {pillar.description}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
