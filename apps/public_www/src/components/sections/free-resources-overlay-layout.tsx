import Image from 'next/image';
import type { ReactNode } from 'react';

interface FreeResourcesOverlayLayoutProps {
  mediaAltText: string;
  mediaTitleLine1: string;
  mediaTitleLine2: string;
  overlayCardAlignmentClassName: string;
  cardContent: ReactNode;
}

const RESOURCE_IMAGE_SRC = '/images/family.webp';

export function FreeResourcesOverlayLayout({
  mediaAltText,
  mediaTitleLine1,
  mediaTitleLine2,
  overlayCardAlignmentClassName,
  cardContent,
}: FreeResourcesOverlayLayoutProps) {
  return (
    <div
      data-testid='free-resource-layout'
      data-layout='overlay'
      className='relative overflow-hidden rounded-2xl border border-black/5 es-free-resources-pattern-bg'
    >
      <div
        className='relative min-h-[465px] overflow-hidden sm:min-h-[525px] lg:min-h-[555px]'
        data-testid='free-resource-media-pane'
      >
        <Image
          src={RESOURCE_IMAGE_SRC}
          alt={mediaAltText}
          fill
          className='object-cover'
          sizes='100vw'
        />

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

      <div
        data-testid='free-resource-overlay-card-wrapper'
        className={`absolute inset-4 z-20 flex items-start sm:inset-6 lg:inset-8 ${overlayCardAlignmentClassName}`}
      >
        <article className='relative flex w-full max-w-[530px] min-h-[420px] flex-col overflow-hidden rounded-2xl p-6 sm:min-h-[460px] sm:p-8'>
          {cardContent}
        </article>
      </div>
    </div>
  );
}
