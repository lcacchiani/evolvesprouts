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
      className='es-section-bg-overlay es-landing-page-details-section'
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
              key={`${item.icon}-${item.title}`}
              className='w-full'
            >
              <article
                className='flex w-full items-start gap-4 py-6 sm:gap-6 sm:py-8 es-landing-page-details-card'
              >
                <span
                  aria-hidden='true'
                  className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold es-landing-page-details-card-number'
                >
                  {index + 1}
                </span>
                <div className='min-w-0'>
                  <h3 className='es-landing-page-details-card-title'>
                    {item.title}
                  </h3>
                  <p className='mt-3 es-landing-page-details-card-description'>
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
