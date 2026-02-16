'use client';

import dynamic from 'next/dynamic';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { SectionShell } from '@/components/section-shell';
import type { TestimonialsContent } from '@/content';

interface DeferredTestimonialsProps {
  content: TestimonialsContent;
}

const PRELOAD_ROOT_MARGIN = '500px 0px';
const SECTION_BG = 'var(--figma-colors-desktop, #FFFFFF)';
const SECTION_BACKGROUND_IMAGE = 'url("/images/evolvesprouts-logo.svg")';
const SECTION_BACKGROUND_POSITION = 'center -150px';
const SECTION_BACKGROUND_SIZE = '900px auto';
const SECTION_BACKGROUND_FILTER =
  'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)';
const SECTION_BACKGROUND_MASK_IMAGE =
  'linear-gradient(to bottom, black 18%, transparent 20%)';

const LazyTestimonials = dynamic(
  () =>
    import('@/components/sections/testimonials').then(
      (module) => module.Testimonials,
    ),
  { ssr: false },
);

export function DeferredTestimonials({ content }: DeferredTestimonialsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) {
      return;
    }

    const sectionElement = containerRef.current;
    if (!sectionElement) {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      const timeoutId = setTimeout(() => {
        setShouldLoad(true);
      }, 0);
      return () => {
        clearTimeout(timeoutId);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry || !entry.isIntersecting) {
          return;
        }

        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: PRELOAD_ROOT_MARGIN },
    );

    observer.observe(sectionElement);

    return () => {
      observer.disconnect();
    };
  }, [shouldLoad]);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        <LazyTestimonials content={content} />
      ) : (
        <SectionShell
          ariaLabel={content.title}
          dataFigmaNode='Testimonials'
          className='es-section-bg-overlay'
          style={
            {
              backgroundColor: SECTION_BG,
              ['--es-section-bg-image' as string]: SECTION_BACKGROUND_IMAGE,
              ['--es-section-bg-position' as string]:
                SECTION_BACKGROUND_POSITION,
              ['--es-section-bg-size' as string]: SECTION_BACKGROUND_SIZE,
              ['--es-section-bg-filter' as string]: SECTION_BACKGROUND_FILTER,
              ['--es-section-bg-mask-image' as string]:
                SECTION_BACKGROUND_MASK_IMAGE,
            } as CSSProperties
          }
        >
          <div className='relative z-10 mx-auto w-full max-w-[1488px]'>
            <div className='mx-auto max-w-[760px] text-center'>
              <h2 className='text-balance text-[clamp(2rem,5.8vw,55px)] font-semibold'>
                {content.title}
              </h2>
            </div>
            <div className='mt-10 h-[420px] bg-white lg:mt-14 lg:h-[540px]' />
          </div>
        </SectionShell>
      )}
    </div>
  );
}
