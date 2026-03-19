import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { LandingPageLocaleContent } from '@/content';

interface LandingPageDescriptionProps {
  content: LandingPageLocaleContent['description'];
  ariaLabel?: string;
}

export function LandingPageDescription({
  content,
  ariaLabel,
}: LandingPageDescriptionProps) {
  return (
    <SectionShell
      id='landing-page-description'
      ariaLabel={ariaLabel ?? content.title}
      dataFigmaNode='landing-page-description'
      className='es-section-bg-overlay es-landing-page-description-section'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
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
                className='flex h-full min-h-[260px] flex-col rounded-card-xl p-6 sm:p-8 es-landing-page-description-card'
              >
                <h3 className='es-landing-page-description-card-title'>
                  {item.title}
                </h3>
                <p className='mt-3 es-landing-page-description-card-description'>
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
