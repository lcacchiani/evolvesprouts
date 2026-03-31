import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ConsultationsHeroContent } from '@/content';

interface ConsultationsHeroProps {
  content: ConsultationsHeroContent;
  resolvedCtaHref: string;
}

export function ConsultationsHero({
  content,
  resolvedCtaHref,
}: ConsultationsHeroProps) {
  return (
    <SectionShell
      id='consultations-hero'
      ariaLabel={content.title}
      dataFigmaNode='consultations-hero'
      className='es-section-bg-overlay overflow-hidden pt-0 sm:pt-[60px]'
    >
      <SectionContainer
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--hero items-center',
        )}
      >
        <div className='relative max-w-[720px]'>
          <SectionHeader
            title={content.title}
            titleAs='h1'
            align='left'
            titleClassName='max-w-[720px]'
            description={content.subtitle}
            descriptionClassName='es-type-subtitle mt-4 max-w-[720px]'
          />
          <div className='mt-8'>
            <SectionCtaAnchor
              href={resolvedCtaHref}
              variant='primary'
              className='max-w-[360px]'
              openInNewTab
            >
              {content.ctaLabel}
            </SectionCtaAnchor>
          </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
