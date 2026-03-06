import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { FreeIntroSessionContent } from '@/content';

interface FreeIntroSessionProps {
  content: FreeIntroSessionContent;
  ctaHref: string;
}

export function FreeIntroSession({ content, ctaHref }: FreeIntroSessionProps) {
  return (
    <SectionShell
      id='free-intro-session'
      ariaLabel={content.heading}
      dataFigmaNode='free-intro-session'
      className='overflow-hidden es-free-intro-session-section'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 es-free-intro-session-overlay'
      />

      <SectionContainer>
        <div className='es-intro-community-layout'>
          <div className='es-intro-community-layout-content'>
            <Image
              src='/images/evolvesprouts-logo.svg'
              alt=''
              width={250}
              height={250}
              className='block h-auto w-[250px] es-free-intro-session-logo invisible sm:visible'
            />
            <SectionHeader
              title={content.heading}
              align='left'
              className='max-w-[620px]'
              titleClassName='leading-[1.12] sm:-mt-6 lg:-mt-[52px] es-free-intro-session-heading'
            />
            <p className='max-w-[500px] es-free-intro-session-support-paragraph'>
              {content.supportParagraph}
            </p>
          </div>
          <div className='es-intro-community-layout-cta'>
            <SectionCtaAnchor href={ctaHref} className='w-fit'>
              {content.ctaLabel}
            </SectionCtaAnchor>
          </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
