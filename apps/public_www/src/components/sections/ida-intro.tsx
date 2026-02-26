import { Fragment, type ReactNode } from 'react';

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
          'es-section-split-layout--ida items-center',
        )}
      >
        <div className='order-2 relative z-10 lg:pl-8 xl:pl-[110px]'>
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

        <div
          aria-hidden='true'
          className='order-1 hidden lg:block'
        />
      </SectionContainer>
    </SectionShell>
  );
}
