import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { resolveFreeIntroSessionCopy } from '@/content/copy-normalizers';
import { mergeClassNames } from '@/lib/class-name-utils';
import type { FreeIntroSessionContent } from '@/content';

interface FreeIntroSessionProps {
  content: FreeIntroSessionContent;
  titleOverride?: string;
  sectionClassName?: string;
}

export function FreeIntroSession({
  content,
  titleOverride,
  sectionClassName,
}: FreeIntroSessionProps) {
  const copy = resolveFreeIntroSessionCopy(content);
  const title = titleOverride || copy.title;

  return (
    <SectionShell
      id='free-intro-session'
      ariaLabel={title}
      dataFigmaNode='free-intro-session'
      className={mergeClassNames(
        'overflow-hidden es-free-intro-session-section',
        sectionClassName,
      )}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 es-free-intro-session-overlay'
      />

      <SectionContainer>
        <div className='es-intro-community-layout'>
          <div className='es-intro-community-layout-content'>
            <Image
              src='/images/evolvesprouts-logo.svg'
              alt=''
              width={250}
              height={250}
              className='h-auto w-[250px] es-free-intro-session-logo hidden sm:block'
            />
            <SectionHeader
              title={title}
              align='left'
              className='mt-[75px] max-w-[620px] sm:mt-0'
              titleClassName='leading-[1.12] sm:-mt-6 lg:-mt-[52px] es-free-intro-session-heading'
            />
            <p className='max-w-[500px] es-free-intro-session-support-paragraph'>
              {copy.description}
            </p>
          </div>
          <div className='es-intro-community-layout-cta'>
            <div className='w-full max-w-[500px] lg:max-w-[410px]'>
              <SectionCtaAnchor href={content.ctaHref} className='w-fit'>
                {content.ctaLabel}
              </SectionCtaAnchor>
              <div
                className='grid grid-rows-[0fr] overflow-hidden'
                aria-hidden='true'
              >
                <div className='min-h-0 overflow-hidden' />
              </div>
            </div>
          </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
