import Image from 'next/image';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { WhyUsContent } from '@/content';

interface WhyUsProps {
  content: WhyUsContent;
}

export function WhyUs({ content }: WhyUsProps) {
  return (
    <SectionShell
      id='why-us'
      ariaLabel={content.title}
      dataFigmaNode='why-us'
      className='es-why-us-section'
    >
      <SectionContainer>
        <SectionHeader eyebrow={content.eyebrow} title={content.title} />

        <div className='mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-8'>
          <div
            className='relative isolate overflow-hidden rounded-[26px] border es-border-soft-alt p-6 es-why-us-hero-card'
          >
            <div
              aria-hidden='true'
              className='absolute -left-10 top-8 h-32 w-32 rounded-full blur-2xl es-why-us-glow-orange'
            />
            <div
              aria-hidden='true'
              className='absolute -bottom-12 right-7 h-36 w-36 rounded-full blur-3xl es-why-us-glow-green'
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
            <h3 className='es-why-us-intro-title'>{content.introTitle}</h3>
            <ul className='mt-4 space-y-3'>
              {content.introItems.map((item) => (
                <li key={item} className='flex items-start gap-3'>
                  <span
                    aria-hidden='true'
                    className='mt-2 inline-flex h-2.5 w-2.5 shrink-0 rounded-full es-bg-brand-orange'
                  />
                  <p className='es-type-body'>{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className='es-type-body mt-8 rounded-[22px] border es-border-soft-alt bg-white/70 p-5 sm:p-6'>
          {content.communityText}
        </p>

        <ul className='mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {content.pillars.map((pillar) => (
            <li key={pillar.title}>
              <article className='h-full rounded-[18px] border es-border-soft-alt es-bg-surface-cream p-5'>
                <h3 className='es-why-us-pillar-title'>{pillar.title}</h3>
                <p className='es-section-body mt-3 text-[16px] leading-[1.5]'>
                  {pillar.description}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </SectionContainer>
    </SectionShell>
  );
}
