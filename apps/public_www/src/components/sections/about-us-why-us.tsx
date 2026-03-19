import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type {
  AboutUsWhyUsContent,
  Locale,
} from '@/content';
import { localizeHref } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';

interface AboutUsWhyUsProps {
  locale: Locale;
  content: AboutUsWhyUsContent;
}

export function AboutUsWhyUs({ locale, content }: AboutUsWhyUsProps) {
  const workshopsHref = localizeHref(
    content.ctaHref || ROUTES.servicesWorkshops,
    locale,
  );

  return (
    <SectionShell
      id='about-us-why-us'
      ariaLabel={content.title}
      dataFigmaNode='about-us-why-us'
      className='es-section-bg-overlay es-why-us-section'
    >
      <div
        aria-hidden='true'
        className='es-course-highlights-overlay pointer-events-none absolute inset-0'
      />

      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
          descriptionClassName='es-section-body mx-auto mt-4 max-w-[840px] text-pretty'
        />

        <ul className='mt-10 grid grid-cols-1 gap-4 md:grid-cols-2'>
          {content.pillars.map((pillar, index) => (
            <li key={pillar.title}>
              <article
                className={`h-full rounded-panel border es-border-soft-alt p-5 ${
                  index === 0 ? 'es-bg-surface-cream' : 'bg-white/85'
                }`}
              >
                <h3 className='es-type-subtitle'>{pillar.title}</h3>
                <p className='es-section-body mt-3 text-base leading-[1.5]'>
                  {renderQuotedDescriptionText(pillar.description)}
                </p>
              </article>
            </li>
          ))}
        </ul>

        <div className='mt-8 flex justify-center sm:mt-10 lg:mt-11'>
          <SectionCtaAnchor
            href={workshopsHref}
            className='w-full max-w-[488px]'
          >
            {content.ctaLabel}
          </SectionCtaAnchor>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
