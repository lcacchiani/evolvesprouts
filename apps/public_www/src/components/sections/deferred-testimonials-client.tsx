'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { TestimonialsContent } from '@/content';

interface DeferredTestimonialsClientProps {
  content: TestimonialsContent;
}

const PRELOAD_ROOT_MARGIN = '500px 0px';

const LazyTestimonials = dynamic(
  () =>
    import('@/components/sections/testimonials').then(
      (module) => module.Testimonials,
    ),
  { ssr: false },
);

export function DeferredTestimonialsClient({
  content,
}: DeferredTestimonialsClientProps) {
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
          id='testimonials'
          ariaLabel={content.title}
          dataFigmaNode='testimonials'
          className='es-section-bg-overlay es-testimonials-section'
        >
          <SectionContainer className='max-w-[1488px]'>
            <SectionHeader
              title={content.title}
              titleClassName='!mt-0 text-balance text-[clamp(2rem,5.8vw,55px)] font-semibold'
            />
            <div className='mt-10 h-[420px] bg-white lg:mt-14 lg:h-[540px]' />
          </SectionContainer>
        </SectionShell>
      )}
    </div>
  );
}
