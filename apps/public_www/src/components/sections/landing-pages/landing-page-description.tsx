import { SectionContainer } from '@/components/sections/shared/section-container';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
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
                className='flex w-full items-start gap-4 pb-0 pt-3 sm:gap-6 sm:pb-0 sm:pt-4 es-landing-page-description-card'
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
                    {renderQuotedDescriptionText(item.description)}
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
