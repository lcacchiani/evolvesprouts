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
  const storyParagraphs = content.description
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const storyImageSources = [
    '/images/about-us/ida-degregorio-ims.webp',
    '/images/about-us/ida-degregorio-my-best-auntie-1.webp',
    '/images/about-us/ida-degregorio-my-best-auntie-2.webp',
  ];

  return (
    <SectionShell
      id='my-history'
      ariaLabel={content.title}
      dataFigmaNode='my-history'
      className='es-section-bg-overlay es-my-history-section'
    >
      <SectionContainer
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--my-history items-center',
        )}
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
          {storyParagraphs.map((paragraph, index) => (
            <p
              key={`${index}-${paragraph.slice(0, 24)}`}
              className='es-type-body mt-4 max-w-[760px]'
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div className='flex flex-col gap-4 lg:ml-auto lg:max-w-[651px]'>
          {storyImageSources.map((src, index) => (
            <Image
              key={src}
              src={src}
              alt={`A brief history image from Evolve Sprouts ${index + 1}`}
              width={1600}
              height={1200}
              sizes='(min-width: 1280px) 651px, (min-width: 1024px) 44vw, 100vw'
              className='h-auto w-full'
            />
          ))}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
