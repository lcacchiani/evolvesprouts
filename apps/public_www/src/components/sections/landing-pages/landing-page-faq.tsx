import { SectionContainer } from '@/components/sections/shared/section-container';
import { FaqCardGrid } from '@/components/sections/shared/faq-card-grid';
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
      className='es-section-bg-overlay es-contact-faq-section overflow-hidden'
    >
      <SectionContainer>
        <SectionHeader title={content.title} />
        <FaqCardGrid items={content.items} />
      </SectionContainer>
    </SectionShell>
  );
}
