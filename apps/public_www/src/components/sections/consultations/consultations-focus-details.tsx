import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ConsultationsFocusDetailsContent } from '@/content';

interface ConsultationsFocusDetailsProps {
  content: ConsultationsFocusDetailsContent;
}

export function ConsultationsFocusDetails({
  content,
}: ConsultationsFocusDetailsProps) {
  return (
    <SectionShell
      id='consultations-focus-details'
      ariaLabel={content.title}
      dataFigmaNode='consultations-focus-details'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
        />

        <div className='mt-10 space-y-8'>
          {content.areas.map((area) => (
            <article
              key={area.id}
              className='rounded-3xl es-bg-surface-muted px-6 py-7 sm:px-8 sm:py-8'
            >
              <h3 className='text-lg font-bold es-text-heading'>
                {area.title}
              </h3>
              <div className='mt-4 grid grid-cols-1 gap-6 md:grid-cols-2'>
                <div>
                  <p className='text-sm font-semibold es-text-accent'>
                    {content.essentialsLabel}
                  </p>
                  <p className='mt-2 es-type-body es-text-dim'>
                    {area.essentials}
                  </p>
                </div>
                <div>
                  <p className='text-sm font-semibold es-text-accent'>
                    {content.deepDiveLabel}
                  </p>
                  <p className='mt-2 es-type-body es-text-dim'>
                    {area.deepDive}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
