import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { SiteContent } from '@/content';

interface TermsAndConditionsProps {
  content: SiteContent['termsAndConditions'];
}

export function TermsAndConditions({ content }: TermsAndConditionsProps) {
  return (
    <SectionShell
      id='terms-and-conditions'
      ariaLabel={content.title}
      dataFigmaNode='terms-and-conditions'
      className='es-section-bg-overlay'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={content.title}
          align='left'
          description={content.intro}
        />

        <p className='mt-6 text-sm font-semibold tracking-wide es-text-heading'>
          {content.lastUpdatedLabel}: {content.lastUpdatedValue}
        </p>

        <div className='mt-8 space-y-8'>
          {content.sections.map((section) => (
            <section key={section.heading} aria-label={section.heading}>
              <h2 className='es-type-title text-[1.5rem] leading-[1.25]'>
                {section.heading}
              </h2>
              <div className='mt-3 space-y-3'>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className='es-type-body leading-7'>
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className='mt-10 rounded-xl border es-border-soft es-bg-surface-soft p-4 text-sm font-semibold leading-6 es-text-heading'>
          {content.languagePrevailsClause}
        </p>
      </SectionContainer>
    </SectionShell>
  );
}
