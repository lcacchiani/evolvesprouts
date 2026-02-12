import type { SiteContent } from '@/content';

interface WhoopsProps {
  content: SiteContent['whoops'];
}

export function Whoops({ content }: WhoopsProps) {
  return (
    <section className='w-full rounded-2xl border border-black/10 bg-white/70 p-8 text-center shadow-sm sm:p-10 lg:p-12'>
      <p className='es-section-heading text-[clamp(7rem,22vw,16rem)] leading-none'>
        {content.code}
      </p>
      <h1 className='es-section-heading mt-3 text-[clamp(1.75rem,4.5vw,2.75rem)] leading-tight'>
        {content.title}
      </h1>
      <p className='es-section-body mx-auto mt-3 max-w-[40ch] text-[1rem] leading-relaxed sm:text-[1.1rem]'>
        {content.description}
      </p>
    </section>
  );
}
