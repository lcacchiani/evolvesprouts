import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { LandingPageLocaleContent } from '@/content';

interface LandingPageDetailsProps {
  content: LandingPageLocaleContent['details'];
  ariaLabel?: string;
}

const CARD_TONES = ['gold', 'green', 'blue'] as const;

export function LandingPageDetails({
  content,
  ariaLabel,
}: LandingPageDetailsProps) {
  return (
    <SectionShell
      id='landing-page-details'
      ariaLabel={ariaLabel ?? content.title}
      dataFigmaNode='landing-page-details'
      className='es-section-bg-overlay es-course-highlights-section'
    >
      <div
        aria-hidden='true'
        className='es-course-highlights-overlay pointer-events-none absolute inset-0'
      />
      <SectionContainer>
        <SectionHeader
          title={content.title}
          description={content.description}
          align='left'
        />
        <ul className='mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {content.items.map((item, index) => (
            <li
              key={item.title}
              className='w-full'
            >
              <article
                className={`relative isolate h-full min-h-[260px] overflow-hidden rounded-card p-6 sm:p-7 lg:p-8 es-course-highlight-card--${CARD_TONES[index % CARD_TONES.length]}`}
              >
                <h3 className='max-w-[18ch] text-balance es-course-highlight-title'>
                  {item.title}
                </h3>
                <p className='mt-3 max-w-[36ch] es-course-highlight-description'>
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
