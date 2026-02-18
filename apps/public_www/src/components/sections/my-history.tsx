import Image from 'next/image';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { MyHistoryContent } from '@/content';
import {
  buildSectionBackgroundOverlayStyle,
  LOGO_OVERLAY_DEEP,
} from '@/lib/section-backgrounds';

interface MyHistoryProps {
  content: MyHistoryContent;
}

const SECTION_STYLE = buildSectionBackgroundOverlayStyle({
  ...LOGO_OVERLAY_DEEP,
  backgroundColor: 'var(--es-color-surface-muted, #F8F8F8)',
});

export function MyHistory({ content }: MyHistoryProps) {
  return (
    <SectionShell
      id='my-history'
      ariaLabel={content.title}
      dataFigmaNode='my-history'
      className='es-section-bg-overlay'
      style={SECTION_STYLE}
    >
      <SectionContainer className='grid items-center gap-8 lg:grid-cols-2 lg:gap-12'>
        <div>
          <SectionHeader
            eyebrow={content.eyebrow}
            title={content.title}
            align='left'
            titleClassName='max-w-[780px]'
            description={content.subtitle}
            descriptionClassName='es-type-subtitle mt-4 max-w-[760px]'
          />
          <p className='es-type-body mt-4 max-w-[760px]'>
            {content.description}
          </p>
        </div>

        <div>
          <Image
            src='/images/about-us/ida-degregorio-evolvesprouts-2.webp'
            alt='A brief history image from Evolve Sprouts'
            width={925}
            height={780}
            sizes='(min-width: 1280px) 651px, (min-width: 1024px) 44vw, 100vw'
            className='h-auto w-full max-w-[651px] lg:ml-auto'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
