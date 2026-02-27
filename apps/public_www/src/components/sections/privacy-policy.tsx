import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { SiteContent } from '@/content';

interface PrivacyPolicyProps {
  content: SiteContent['privacyPolicy'];
}

export function PrivacyPolicy({ content }: PrivacyPolicyProps) {
  return (
    <SectionShell
      id='privacy-policy'
      ariaLabel={content.title}
      dataFigmaNode='privacy-policy'
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
      </SectionContainer>
    </SectionShell>
  );
}
