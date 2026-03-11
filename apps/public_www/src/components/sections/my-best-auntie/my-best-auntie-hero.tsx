import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { resolveMyBestAuntieHeroDescription } from '@/content/copy-normalizers';
import type { MyBestAuntieHeroContent } from '@/content';

interface MyBestAuntieHeroProps {
  content: MyBestAuntieHeroContent;
}

const MY_BEST_AUNTIE_HERO_CTA_CLASSNAME = 'mt-auto max-w-[360px]';

export function MyBestAuntieHero({ content }: MyBestAuntieHeroProps) {
  const description = resolveMyBestAuntieHeroDescription(content);

  return (
    <SectionShell
      id='my-best-auntie-hero'
      ariaLabel={content.title}
      dataFigmaNode='my-best-auntie-hero'
      className='es-my-best-auntie-hero-section overflow-hidden pt-0 sm:pt-[60px]'
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
              description={content.subtitle}
              descriptionClassName='es-type-subtitle mt-4 max-w-[720px]'
            />
            <p className='mt-4 max-w-[720px] es-type-body'>{description}</p>
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

        <div className='es-my-best-auntie-hero-image-wrap mx-auto w-full max-w-[500px] lg:order-1 lg:ml-0 lg:mr-auto'>
          <Image
            src='/images/hero/my-best-auntie-hero.webp'
            alt={content.imageAlt}
            width={1200}
            height={900}
            sizes='(max-width: 640px) 92vw, 500px'
            className='es-my-best-auntie-hero-image-flipped relative z-10 h-auto w-full'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
