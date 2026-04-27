import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { LandingPageInlineCalendarCta } from '@/components/sections/landing-pages/shared/landing-page-inline-calendar-cta';
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
          align='center'
        />
        <CarouselTrack
          testId='landing-page-details-mobile-carousel'
          ariaLabel={ariaLabel ?? content.title}
          className='md:snap-none md:overflow-visible'
        >
          <ul className='mt-8 flex min-w-0 gap-4 sm:gap-5 md:grid md:grid-cols-2 lg:grid-cols-3'>
            {content.items.map((item) => (
              <li
                key={`${item.icon}-${item.title}`}
                className='w-[84vw] max-w-[360px] shrink-0 snap-center sm:w-[68vw] md:w-auto md:max-w-none md:shrink md:snap-none'
              >
                <article
                  className='flex h-full min-h-[200px] flex-col rounded-card-xl p-6 sm:p-8 es-landing-page-details-card'
                >
                  <div className='flex items-start justify-between gap-4 es-landing-page-details-card-title-row'>
                    <h3 className='es-landing-page-details-card-title'>
                      {item.title}
                    </h3>
                    <span className='inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl es-landing-page-details-card-icon-wrap'>
                      <span
                        role='img'
                        aria-hidden='true'
                        className='es-landing-page-details-card-icon'
                      >
                        {item.icon}
                      </span>
                    </span>
                  </div>
                  <p className='mt-3 es-landing-page-details-card-description'>
                    {renderQuotedDescriptionText(item.description)}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </CarouselTrack>
        <div className='mt-8 flex justify-center'>
          <LandingPageInlineCalendarCta
            analyticsSectionId='landing-page-details'
            buttonClassName='w-full max-w-[488px]'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
