import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ConsultationsHeroContent } from '@/content';
import { resolveHeroImageMaxWidthClass } from '@/lib/page-hero-image';

interface ConsultationsHeroProps {
  content: ConsultationsHeroContent;
}

export function ConsultationsHero({ content }: ConsultationsHeroProps) {
  const heroImageMaxWidthClassName = resolveHeroImageMaxWidthClass(content);

  return (
    <SectionShell
      id='consultations-hero'
      ariaLabel={content.title}
      dataFigmaNode='consultations-hero'
      className='es-landing-page-hero-section es-bg-surface-white overflow-x-clip'
    >
      <SectionContainer className='grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]'>
        <div className='space-y-5'>
          <SectionHeader
            title={content.title}
            titleAs='h1'
            align='left'
            titleClassName='max-w-[720px]'
            description={content.subtitle}
            descriptionClassName='es-type-subtitle mt-4 max-w-[720px]'
          />
          <p className='max-w-[720px] es-type-body'>
            {renderQuotedDescriptionText(content.description)}
          </p>
          <SectionCtaAnchor
            href={content.ctaHref}
            variant='primary'
            className='max-w-[360px]'
          >
            {content.ctaLabel}
          </SectionCtaAnchor>
        </div>
        <div
          className={`es-landing-page-hero-image-wrap mx-auto w-full justify-self-center ${heroImageMaxWidthClassName}`}
        >
          <Image
            src={content.imageSrc}
            alt={content.imageAlt}
            width={1200}
            height={800}
            sizes='(max-width: 1024px) 120vw, 60vw'
            priority
            fetchPriority='high'
            className='relative z-10 h-auto w-full rounded-panel'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
