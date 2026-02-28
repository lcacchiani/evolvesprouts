import type { ReactNode } from 'react';

import { buildSectionSplitLayoutClassName } from '@/components/sections/shared/section-container';

interface FreeResourcesSplitLayoutProps {
  mediaTitleLine1: string;
  mediaTitleLine2: string;
  splitTextPaneOrderClassName: string;
  splitMediaPaneOrderClassName: string;
  splitMediaBleedClassName: string;
  cardContent: ReactNode;
}

export function FreeResourcesSplitLayout({
  mediaTitleLine1,
  mediaTitleLine2,
  splitTextPaneOrderClassName,
  splitMediaPaneOrderClassName,
  splitMediaBleedClassName,
  cardContent,
}: FreeResourcesSplitLayoutProps) {
  return (
    <div
      data-testid='free-resource-layout'
      data-layout='split'
      className={buildSectionSplitLayoutClassName(
        'es-section-split-layout--free-resources overflow-hidden rounded-2xl border border-black/5 es-free-resources-pattern-bg',
      )}
    >
      <div
        data-testid='free-resource-text-pane'
        className={`relative z-10 p-4 sm:p-6 lg:p-[35px] ${splitTextPaneOrderClassName}`}
      >
        <article className='relative flex h-full min-h-[278px] flex-col overflow-hidden rounded-2xl p-6 sm:min-h-[330px] sm:p-8 lg:min-h-[387px]'>
          {cardContent}
        </article>
      </div>

      <div
        data-testid='free-resource-media-pane'
        className={`es-free-resources-media-pane ${splitMediaBleedClassName} relative z-0 min-h-[210px] overflow-visible sm:min-h-[278px] lg:min-h-[440px] ${splitMediaPaneOrderClassName}`}
      >
        <div className='absolute left-1/2 top-[10%] z-10 flex -translate-x-1/2 flex-col items-center gap-2 sm:gap-3'>
          <div className='rounded-full bg-white/95 px-5 py-2 shadow-pill sm:px-6'>
            <p className='whitespace-nowrap es-free-resources-media-pill-text'>
              {mediaTitleLine1}
            </p>
          </div>
          <div className='rounded-full bg-white/95 px-5 py-2 shadow-pill sm:px-6'>
            <p className='whitespace-nowrap es-free-resources-media-pill-text'>
              {mediaTitleLine2}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
