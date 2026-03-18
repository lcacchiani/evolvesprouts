import Image from 'next/image';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { LandingPageLocaleContent } from '@/content';

interface LandingPageHeroProps {
  content: LandingPageLocaleContent['hero'];
  title: string;
  chips: string[];
  ariaLabel?: string;
}

export function LandingPageHero({
  content,
  title,
  chips,
  ariaLabel,
}: LandingPageHeroProps) {
  return (
    <SectionShell
      id='landing-page-hero'
      ariaLabel={ariaLabel ?? title}
      dataFigmaNode='landing-page-hero'
      className='es-bg-surface-white'
    >
      <SectionContainer className='grid items-center gap-10 lg:grid-cols-2'>
        <div className='space-y-5'>
          <SectionHeader
            title={title}
            titleAs='h1'
            align='left'
          />
          <p className='es-type-subtitle-lg es-text-heading'>{content.subtitle}</p>
          <p className='es-type-body'>{content.description}</p>
          {chips.length > 0 ? (
            <div className='flex flex-wrap gap-3'>
              {chips.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className='rounded-full es-bg-surface-soft px-4 py-2 text-sm font-semibold es-text-heading'
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
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
