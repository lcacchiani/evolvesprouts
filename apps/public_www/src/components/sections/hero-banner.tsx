import type { HeroContent } from '@/content';

interface HeroBannerProps {
  content: HeroContent;
}

export function HeroBanner({ content }: HeroBannerProps) {
  return (
    <section
      aria-label={content.headline}
      data-figma-node="banner"
      className="w-full px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {content.headline}
        </h1>
        <p className="mt-6 text-lg text-slate-600 sm:text-xl">
          {content.subheadline}
        </p>
        <div className="mt-10">
          <a
            href="#courses"
            className="inline-block rounded-lg bg-slate-900 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-slate-800"
          >
            {content.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
