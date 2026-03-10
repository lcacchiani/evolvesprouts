import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { MyBestAuntieHeroContent } from '@/content';

interface MyBestAuntieHeroProps {
  content: MyBestAuntieHeroContent;
}

const MY_BEST_AUNTIE_HERO_CTA_CLASSNAME = 'mt-auto max-w-[360px]';

export function MyBestAuntieHero({ content }: MyBestAuntieHeroProps) {
  return (
    <SectionShell
      id='my-best-auntie-hero'
      ariaLabel={content.title}
      dataFigmaNode='my-best-auntie-hero'
      className='es-my-best-auntie-hero-section overflow-hidden'
    >
      <SectionContainer
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--hero items-center',
        )}
      >
        <div className='relative max-w-[620px] lg:order-2 lg:pb-4 lg:pl-8'>
          <div className='relative z-10'>
            <SectionHeader
              title={content.title}
              titleAs='h1'
              align='left'
              titleClassName='max-w-[720px]'
              description={content.body}
              descriptionClassName='mt-4 max-w-[720px] es-type-body'
            />
            <div className='mt-8'>
              <SectionCtaAnchor
                href={content.ctaHref}
                variant='primary'
                className={MY_BEST_AUNTIE_HERO_CTA_CLASSNAME}
              >
                {content.ctaLabel}
              </SectionCtaAnchor>
            </div>
          </div>
        </div>

        <div className='es-my-best-auntie-hero-image-wrap mx-auto w-full max-w-[400px] lg:order-1 lg:ml-0 lg:mr-auto'>
          <Image
            src='/images/about-us/ida-degregorio-evolvesprouts-3.webp'
            alt={content.imageAlt}
            width={764}
            height={841}
            sizes='(max-width: 640px) 92vw, 400px'
            className='relative z-10 h-auto w-full'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
