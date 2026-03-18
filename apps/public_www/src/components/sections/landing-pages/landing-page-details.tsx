import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { LandingPageLocaleContent } from '@/content';

interface LandingPageDetailsProps {
  content: LandingPageLocaleContent['details'];
  ariaLabel?: string;
}

export function LandingPageDetails({
  content,
  ariaLabel,
}: LandingPageDetailsProps) {
  return (
    <SectionShell
      id='landing-page-details'
      ariaLabel={ariaLabel ?? content.title}
      dataFigmaNode='landing-page-details'
      className='es-bg-surface-white'
    >
      <SectionContainer>
        <SectionHeader
          title={content.title}
          description={content.description}
          align='left'
        />
        <ul className='mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {content.items.map((item) => (
            <li
              key={item.title}
              className='rounded-panel es-bg-surface-muted p-6'
            >
              <h3 className='text-lg font-semibold es-text-heading'>
                {item.title}
              </h3>
              <p className='mt-3 es-type-body'>{item.description}</p>
            </li>
          ))}
        </ul>
      </SectionContainer>
    </SectionShell>
  );
}
