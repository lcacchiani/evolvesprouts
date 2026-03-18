import Image from 'next/image';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { LandingPageLocaleContent } from '@/content';

interface LandingPageHeroProps {
  content: LandingPageLocaleContent['hero'];
  ariaLabel?: string;
}

export function LandingPageHero({
  content,
  ariaLabel,
}: LandingPageHeroProps) {
  return (
    <SectionShell
      id='landing-page-hero'
      ariaLabel={ariaLabel ?? content.title}
      dataFigmaNode='landing-page-hero'
      className='es-section-bg-overlay'
    >
      <SectionContainer className='grid items-center gap-10 lg:grid-cols-2'>
        <div className='space-y-5'>
          <SectionHeader
            title={content.title}
            titleAs='h1'
            align='left'
            description={content.subtitle}
          />
          <p className='es-type-body'>{content.description}</p>
          <div className='flex flex-wrap gap-3'>
            <span className='rounded-full es-bg-surface-soft px-4 py-2 text-sm font-semibold es-text-heading-alt'>
              {content.dateLabel}
            </span>
            <span className='rounded-full es-bg-surface-soft px-4 py-2 text-sm font-semibold es-text-heading-alt'>
              {content.locationLabel}
            </span>
          </div>
        </div>
        <div className='w-full'>
          {content.imageMobileSrc ? (
            <>
              <Image
                src={content.imageMobileSrc}
                alt={content.imageAlt}
                width={720}
                height={720}
                sizes='100vw'
                className='h-auto w-full rounded-panel sm:hidden'
              />
              <Image
                src={content.imageSrc}
                alt={content.imageAlt}
                width={1200}
                height={900}
                sizes='(max-width: 1024px) 100vw, 50vw'
                className='hidden h-auto w-full rounded-panel sm:block'
              />
            </>
          ) : (
            <Image
              src={content.imageSrc}
              alt={content.imageAlt}
              width={1200}
              height={900}
              sizes='(max-width: 1024px) 100vw, 50vw'
              className='h-auto w-full rounded-panel'
            />
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
