import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { IdaIntroContent } from '@/content';

interface IdaIntroProps {
  content: IdaIntroContent;
}

export function IdaIntro({ content }: IdaIntroProps) {
  return (
    <SectionShell
      id='ida-intro'
      ariaLabel={content.text}
      dataFigmaNode='ida-intro'
      className='es-ida-section overflow-hidden'
    >
      <SectionContainer
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--ida items-center',
        )}
      >
        <div className='order-2 relative z-10 lg:pl-8 xl:pl-[110px]'>
          <SectionHeader
            title={content.text}
            titleAs='h2'
            align='left'
            titleClassName='es-type-subtitle max-w-[720px]'
          />
          <SectionCtaAnchor
            href={content.ctaHref}
            className='mt-8'
          >
            {content.ctaLabel}
          </SectionCtaAnchor>
        </div>

        <div className='order-1'>
          <div className='w-full lg:ml-[-75px] lg:mr-[-38px] lg:w-[525px] xl:ml-[-135px] xl:mr-[-150px] xl:w-[833px]'>
            <Image
              src='/images/about-us/ida-degregorio-evolvesprouts-3.webp'
              alt={content.imageAlt}
              width={1112}
              height={840}
              sizes='(min-width: 1280px) 1111px, (min-width: 1024px) 700px, 100vw'
              className='h-auto w-full'
            />
          </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
