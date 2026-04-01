import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { FreeGuidesAndResourcesHeroContent } from '@/content';

interface FreeGuidesAndResourcesHeroProps {
  content: FreeGuidesAndResourcesHeroContent;
}

export function FreeGuidesAndResourcesHero({
  content,
}: FreeGuidesAndResourcesHeroProps) {
  const description = content.description?.trim() ?? '';

  return (
    <SectionShell
      id='free-guides-and-resources-hero'
      ariaLabel={content.title}
      dataFigmaNode='free-guides-and-resources-hero'
      className='es-section-bg-overlay overflow-hidden pt-0 sm:pt-[60px]'
    >
      <SectionContainer>
        <SectionHeader
          title={content.title}
          titleAs='h1'
          description={content.subtitle}
          descriptionClassName='es-type-subtitle mt-4 max-w-[760px]'
        />
        {description ? (
          <p className='es-type-body mx-auto mt-4 max-w-[720px] text-center'>
            {description}
          </p>
        ) : null}
      </SectionContainer>
    </SectionShell>
  );
}
