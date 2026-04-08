import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ConsultationsHeroContent } from '@/content';

interface ConsultationsHeroProps {
  content: ConsultationsHeroContent;
}

export function ConsultationsHero({ content }: ConsultationsHeroProps) {
  return (
    <SectionShell
      id='consultations-hero'
      ariaLabel={content.title}
      dataFigmaNode='consultations-hero'
      className='es-bg-surface-white overflow-hidden pt-0 sm:pt-[60px]'
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
          <p className='mt-4 max-w-[720px] es-type-body'>
            {renderQuotedDescriptionText(content.description)}
          </p>
          <div className='mt-8'>
            <SectionCtaAnchor
              href={content.ctaHref}
              variant='primary'
              className='max-w-[360px]'
            >
              {content.ctaLabel}
            </SectionCtaAnchor>
          </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
