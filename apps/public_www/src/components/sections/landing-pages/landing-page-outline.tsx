import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import type { LandingPageLocaleContent } from '@/content';

interface LandingPageOutlineProps {
  content: LandingPageLocaleContent['outline'];
  ariaLabel?: string;
}

function splitDescriptionParagraphs(description: string): string[] {
  return description
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function LandingPageOutline({
  content,
  ariaLabel,
}: LandingPageOutlineProps) {
  const paragraphs = splitDescriptionParagraphs(content.description);

  return (
    <SectionShell
      id='landing-page-outline'
      ariaLabel={ariaLabel ?? content.title}
      dataFigmaNode='landing-page-outline'
      className='es-section-bg-overlay es-landing-page-outline-section'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={content.title}
          align='left'
        />
        <div className='mt-6 space-y-4 lg:max-w-[980px]'>
          {paragraphs.map((paragraph, index) => (
            <p
              key={`${paragraph}-${index}`}
              className='es-type-body es-landing-page-outline-paragraph'
            >
              {renderQuotedDescriptionText(
                paragraph,
                content.highlightPhrase,
              )}
            </p>
          ))}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
