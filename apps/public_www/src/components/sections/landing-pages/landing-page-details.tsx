import { SectionContainer } from '@/components/sections/shared/section-container';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import {
  LandingPageBookingCtaAction,
  type LandingPageSharedCtaProps,
} from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import type { LandingPageLocaleContent } from '@/content';

interface LandingPageDetailsProps {
  content: LandingPageLocaleContent['details'];
  sharedCtaProps?: LandingPageSharedCtaProps;
  ariaLabel?: string;
}

export function LandingPageDetails({
  content,
  sharedCtaProps,
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
        <ul className='mt-8 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3'>
          {content.items.map((item) => (
            <li
              key={`${item.icon}-${item.title}`}
              className='w-full'
            >
              <article
                className='flex h-full min-h-[300px] flex-col rounded-card-xl p-6 sm:p-8 es-landing-page-details-card'
              >
                <span className='inline-flex h-12 w-12 items-center justify-center rounded-full text-2xl es-landing-page-details-card-icon-wrap'>
                  <span
                    role='img'
                    aria-hidden='true'
                    className='es-landing-page-details-card-icon'
                  >
                    {item.icon}
                  </span>
                </span>
                <h3 className='mt-4 es-landing-page-details-card-title'>
                  {item.title}
                </h3>
                <p className='mt-3 es-landing-page-details-card-description'>
                  {renderQuotedDescriptionText(item.description)}
                </p>
              </article>
            </li>
          ))}
        </ul>
        {sharedCtaProps ? (
          <div className='mt-8 flex justify-center'>
            <LandingPageBookingCtaAction
              {...sharedCtaProps}
              analyticsSectionId='landing-page-details'
              ctaLocation='landing_page'
            />
          </div>
        ) : null}
      </SectionContainer>
    </SectionShell>
  );
}
