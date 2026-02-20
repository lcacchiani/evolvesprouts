import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { IdaContent } from '@/content';

interface IdaProps {
  content: IdaContent;
}

export function Ida({ content }: IdaProps) {
  return (
    <SectionShell
      id='ida'
      ariaLabel={content.title}
      dataFigmaNode='ida'
      className='es-ida-section overflow-hidden'
    >
      <SectionContainer className='grid items-center gap-7 lg:grid-cols-2 lg:gap-10'>
        <div className='order-1 relative z-10 lg:order-2 lg:pl-8 xl:pl-[110px]'>
          <SectionHeader
            title={content.title}
            titleAs='h1'
            align='left'
            titleClassName='!mt-0'
            description={content.subtitle}
            descriptionClassName='es-type-subtitle mt-4 max-w-[760px]'
          />
          <p className='es-type-body mt-4 max-w-[720px]'>
            {content.description}
          </p>
          <SectionCtaAnchor
            href={content.ctaHref}
            className='mt-8'
          >
            {content.ctaLabel}
          </SectionCtaAnchor>
        </div>

        <div className='order-2 lg:order-1'>
          <div className='w-full lg:ml-[-100px] lg:mr-[-50px] lg:w-[700px] xl:ml-[-180px] xl:mr-[-200px] xl:w-[1111px]'>
            <Image
              src='/images/about-us/ida-degregorio-evolvesprouts-1.webp'
              alt='Ida De Gregorio from Evolve Sprouts'
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
