import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { LandingPageLocaleContent } from '@/content';

interface LandingPageFaqProps {
  content: LandingPageLocaleContent['faq'];
  ariaLabel?: string;
}

export function LandingPageFaq({ content, ariaLabel }: LandingPageFaqProps) {
  return (
    <SectionShell
      id='landing-page-faq'
      ariaLabel={ariaLabel ?? content.title}
      dataFigmaNode='landing-page-faq'
      className='es-bg-surface-white'
    >
      <SectionContainer>
        <SectionHeader
          title={content.title}
          align='left'
        />
        <dl className='mt-8 space-y-4'>
          {content.items.map((item) => (
            <div
              key={item.question}
              className='rounded-panel es-bg-surface-white p-6'
            >
              <dt className='text-lg font-semibold es-text-heading'>
                {item.question}
              </dt>
              <dd className='mt-3 es-type-body'>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </SectionContainer>
    </SectionShell>
  );
}
