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
const IDA_INTRO_CTA_CLASSNAME = 'mt-auto max-w-[360px] es-btn--outline';

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
      ariaLabel={content.heading}
      dataFigmaNode='ida-intro'
      className='es-ida-section es-ida-intro-section overflow-hidden'
    >
      <SectionContainer
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--hero items-center',
        )}
      >
        <div className='relative max-w-[620px] lg:order-2 lg:pb-4 lg:pl-8'>
          <div className='relative z-10'>
            <SectionHeader
              title={renderIntroText(content.heading)}
              titleAs='h2'
              align='left'
              titleClassName='max-w-[720px]'
              description={content.body}
              descriptionClassName='mt-4 max-w-[720px] es-type-body'
            />
            <div className='mt-8'>
              <SectionCtaAnchor
                href={content.ctaHref}
                variant='primary'
                className={IDA_INTRO_CTA_CLASSNAME}
              >
                {content.ctaLabel}
              </SectionCtaAnchor>
            </div>
          </div>
        </div>

        <div className='es-ida-intro-image-wrap mx-auto w-full max-w-[400px] lg:order-1 lg:ml-0 lg:mr-auto'>
          <Image
            src='/images/about-us/ida-degregorio-evolvesprouts-3.webp'
            alt={content.imageAlt}
            width={764}
            height={841}
            sizes='(max-width: 640px) 92vw, 400px'
            className='relative z-10 h-auto w-full'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
