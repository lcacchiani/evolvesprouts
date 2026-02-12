'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { SectionShell } from '@/components/section-shell';
import type { TestimonialsContent } from '@/content';

interface DeferredTestimonialsProps {
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
      setShouldLoad(true);
      return;
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
          className='relative isolate overflow-hidden'
        >
          <div className='mx-auto w-full max-w-[1488px]'>
            <div className='mx-auto max-w-[760px] text-center'>
              <h2 className='text-balance text-[clamp(2rem,5.8vw,55px)] font-semibold'>
                {content.title}
              </h2>
            </div>
            <div className='mt-10 h-[420px] rounded-[30px] border border-[#EFD7C7] bg-white/75 lg:mt-14 lg:h-[540px]' />
          </div>
        </SectionShell>
      )}
    </div>
  );
}
