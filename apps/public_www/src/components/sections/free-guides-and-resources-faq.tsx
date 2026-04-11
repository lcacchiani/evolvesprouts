import { SectionContainer } from '@/components/sections/shared/section-container';
import { FaqCardGrid } from '@/components/sections/shared/faq-card-grid';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { FreeGuidesAndResourcesFaqContent } from '@/content';

interface FreeGuidesAndResourcesFaqProps {
  content: FreeGuidesAndResourcesFaqContent;
}

export function FreeGuidesAndResourcesFaq({
  content,
}: FreeGuidesAndResourcesFaqProps) {
  return (
    <SectionShell
      id='free-guides-and-resources-faq'
      ariaLabel={content.title}
      dataFigmaNode='free-guides-and-resources-faq'
      className='es-section-bg-overlay es-contact-faq-section overflow-hidden'
    >
      <SectionContainer>
        <SectionHeader title={content.title} />
        <FaqCardGrid items={content.cards} />
      </SectionContainer>
    </SectionShell>
  );
}
