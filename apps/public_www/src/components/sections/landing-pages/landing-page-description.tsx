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
        <ul className='mt-8 space-y-2 sm:space-y-3'>
          {content.items.map((item, index) => (
            <li
              key={item.title}
              className='w-full'
            >
              <article
                className='flex w-full items-start gap-4 py-6 sm:gap-6 sm:py-8 es-landing-page-description-card'
              >
                <span
                  aria-hidden='true'
                  className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold es-landing-page-description-card-number'
                >
                  {index + 1}
                </span>
                <div className='min-w-0'>
                  <h3 className='es-landing-page-description-card-title'>
                    {item.title}
                  </h3>
                  <p className='mt-3 es-landing-page-description-card-description'>
                    {item.description}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </SectionContainer>
    </SectionShell>
  );
}
