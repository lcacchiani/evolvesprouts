import Image from 'next/image';

import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { MyHistoryContent } from '@/content';

interface MyHistoryProps {
  content: MyHistoryContent;
}

export function MyHistory({ content }: MyHistoryProps) {
  return (
    <SectionShell
      id='my-history'
      ariaLabel={content.title}
      dataFigmaNode='my-history'
      className='es-section-bg-overlay es-my-history-section'
    >
      <SectionContainer
        className={buildSectionSplitLayoutClassName('items-center gap-8 lg:gap-12')}
      >
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
