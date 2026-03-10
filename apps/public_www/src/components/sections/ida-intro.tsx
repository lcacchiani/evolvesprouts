import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { renderHighlightedText } from '@/components/sections/shared/render-highlighted-text';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { resolveIdaIntroCopy } from '@/content/copy-normalizers';
import type { IdaIntroContent } from '@/content';

interface IdaIntroProps {
  content: IdaIntroContent;
}

const IDA_INTRO_CTA_CLASSNAME = 'mt-auto max-w-[360px] es-btn--outline';

export function IdaIntro({ content }: IdaIntroProps) {
  const copy = resolveIdaIntroCopy(content);

  return (
    <SectionShell
      id='ida-intro'
      ariaLabel={copy.title}
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
              title={renderHighlightedText(copy.title, content.highlightPhrase)}
              titleAs='h2'
              align='left'
              titleClassName='max-w-[720px]'
              description={copy.description}
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
