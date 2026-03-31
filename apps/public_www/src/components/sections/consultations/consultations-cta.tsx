import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ConsultationsCtaContent } from '@/content';

interface ConsultationsCtaProps {
  content: ConsultationsCtaContent;
  resolvedPrimaryCtaHref: string;
  resolvedSecondaryCtaHref: string;
}

export function ConsultationsCta({
  content,
  resolvedPrimaryCtaHref,
  resolvedSecondaryCtaHref,
}: ConsultationsCtaProps) {
  return (
    <SectionShell
      id='consultations-cta'
      ariaLabel={content.title}
      dataFigmaNode='consultations-cta'
    >
      <SectionContainer>
        <SectionHeader title={content.title} />

        <div className='mt-8 flex flex-col items-center gap-6'>
          <SectionCtaAnchor
            href={resolvedPrimaryCtaHref}
            variant='primary'
            className='w-fit'
            openInNewTab
          >
            {content.primaryCtaLabel}
          </SectionCtaAnchor>

          <p className='max-w-[520px] text-center es-type-body es-text-dim'>
            {content.secondaryDescription}
          </p>

          <SectionCtaAnchor
            href={resolvedSecondaryCtaHref}
            variant='secondary'
            className='w-fit'
            openInNewTab
          >
            {content.secondaryCtaLabel}
          </SectionCtaAnchor>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
