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
      className='es-section-bg-overlay es-my-best-auntie-description-section'
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
              className='w-full'
            >
              <article
                className='flex h-full min-h-[260px] flex-col rounded-card-xl p-6 sm:p-8 es-my-best-auntie-description-card'
              >
                <h3 className='es-my-best-auntie-description-card-title'>
                  {item.title}
                </h3>
                <p className='mt-3 es-my-best-auntie-description-card-description'>
                  {item.description}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </SectionContainer>
    </SectionShell>
  );
}
