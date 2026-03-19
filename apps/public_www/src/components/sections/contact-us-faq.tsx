import { SectionContainer } from '@/components/sections/shared/section-container';
import { FaqCardGrid } from '@/components/sections/shared/faq-card-grid';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ContactUsContent } from '@/content';

interface ContactUsFaqProps {
  content: ContactUsContent['faq'];
}

export function ContactUsFaq({ content }: ContactUsFaqProps) {
  return (
    <SectionShell
      id='contact-us-faq'
      ariaLabel={content.title}
      dataFigmaNode='contact-us-faq'
      className='es-section-bg-overlay es-contact-faq-section overflow-hidden'
    >
      <SectionContainer>
        <SectionHeader title={content.title} />
        <FaqCardGrid items={content.cards} />
      </SectionContainer>
    </SectionShell>
  );
}
