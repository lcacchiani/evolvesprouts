import { Fragment, type ReactNode } from 'react';
import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { IdaIntroContent } from '@/content';

interface IdaIntroProps {
  content: IdaIntroContent;
}

const INTRO_HIGHLIGHT_WORD = 'Evolve Sprouts';

function renderIntroText(text: string): ReactNode {
  const sections = text.split(INTRO_HIGHLIGHT_WORD);
  if (sections.length === 1) {
    return text;
  }

  return sections.map((section, index) => (
    <Fragment key={`${section}-${index}`}>
      {section}
      {index < sections.length - 1 ? (
        <span className='es-hero-highlight-word'>{INTRO_HIGHLIGHT_WORD}</span>
      ) : null}
    </Fragment>
  ));
}

export function IdaIntro({ content }: IdaIntroProps) {
  return (
    <SectionShell
      id='ida-intro'
      ariaLabel={content.text}
      dataFigmaNode='ida-intro'
      className='es-ida-section es-ida-intro-section overflow-hidden'
    >
      <SectionContainer
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--hero items-center',
        )}
      >
        <div className='relative max-w-[620px] lg:order-2 lg:pb-4 lg:pl-8 xl:pl-[110px]'>
          <div className='relative z-10'>
            <SectionHeader
              title={
                <span className='es-type-body block max-w-[720px] font-normal'>
                  {renderIntroText(content.text)}
                </span>
              }
              titleAs='h2'
              align='left'
            />
            <SectionCtaAnchor
              href={content.ctaHref}
              className='mt-8'
            >
              {content.ctaLabel}
            </SectionCtaAnchor>
          </div>
        </div>

        <div className='mx-auto w-full max-w-[573px] lg:order-1 lg:ml-0 lg:mr-auto'>
          <Image
            src='/images/about-us/ida-degregorio-evolvesprouts-3.webp'
            alt={content.imageAlt}
            width={764}
            height={841}
            priority
            fetchPriority='high'
            sizes='(max-width: 640px) 92vw, (max-width: 1024px) 70vw, 764px'
            className='h-auto w-full'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
