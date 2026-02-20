import { Fragment, type ReactNode } from 'react';
import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { HeroContent } from '@/content';
import { ROUTES } from '@/lib/routes';

interface HeroBannerProps {
  content: HeroContent;
}

const HERO_IMAGE_SRC = '/images/hero/child-hero.webp';
const HEADLINE_HIGHLIGHT_WORD = 'Montessori';

function renderHeadline(headline: string): ReactNode {
  const sections = headline.split(HEADLINE_HIGHLIGHT_WORD);
  if (sections.length === 1) {
    return headline;
  }

  return sections.map((section, index) => (
    <Fragment key={`${section}-${index}`}>
      {section}
      {index < sections.length - 1 && (
        <span className='es-hero-highlight-word'>
          {HEADLINE_HIGHLIGHT_WORD}
        </span>
      )}
    </Fragment>
  ));
}

export function HeroBanner({ content }: HeroBannerProps) {
  return (
    <SectionShell
      id='hero-banner'
      ariaLabel={content.headline}
      dataFigmaNode='banner'
      className='relative w-full overflow-hidden es-hero-section'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute left-0 top-0 bg-no-repeat es-hero-frame-bg'
      />
      <SectionContainer
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--hero items-center',
        )}
      >
        <div className='relative max-w-size-620 lg:pb-4 lg:pr-8 lg:pt-[70px]'>
          <div className='relative z-10'>
            <SectionHeader
              title={renderHeadline(content.headline)}
              titleAs='h1'
              align='left'
              className='max-w-size-620'
              titleClassName='es-hero-headline'
              description={content.subheadline}
              descriptionClassName='mt-4 max-w-size-620 sm:mt-6 es-hero-subheadline'
            />
            <SectionCtaAnchor
              href={ROUTES.servicesMyBestAuntieTrainingCourse}
              className='mt-6'
            >
              {content.cta}
            </SectionCtaAnchor>
          </div>
        </div>
        <div className='mx-auto w-full max-w-size-620 lg:ml-auto lg:mr-0'>
          <Image
            src={HERO_IMAGE_SRC}
            alt=''
            width={764}
            height={841}
            priority
            fetchPriority='high'
            sizes='(max-width: 640px) 92vw, (max-width: 1024px) 70vw, 764px'
            className='h-auto w-full'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
