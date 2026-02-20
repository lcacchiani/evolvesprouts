import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ContactUsContent } from '@/content';

interface ReachOutProps {
  content: ContactUsContent['reachOut'];
}

const GLYPH_TONES = ['orange', 'blue', 'gold', 'green'] as const;

function resolveGlyphTone(index: number): (typeof GLYPH_TONES)[number] {
  return GLYPH_TONES[index % GLYPH_TONES.length];
}

function ReachOutGlyph({ index }: { index: number }) {
  return (
    <span
      aria-hidden='true'
      className={`es-reach-out-glyph es-reach-out-glyph--${resolveGlyphTone(index)} inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-white`}
    >
      <svg
        viewBox='0 0 24 24'
        className='h-5 w-5'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M6 12.2L10.3 16.5L18 8.8'
          stroke='currentColor'
          strokeWidth='2.4'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </span>
  );
}

export function ReachOut({ content }: ReachOutProps) {
  return (
    <SectionShell
      id='reach-out'
      ariaLabel={content.title}
      dataFigmaNode='reach-out'
      className='es-reach-out-section overflow-hidden'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={content.title}
        />

        <ul className='mt-10 grid grid-cols-1 gap-4 sm:gap-5 lg:mt-12 lg:grid-cols-2'>
          {content.items.map((item, index) => (
            <li key={item.title}>
              <article className='flex h-full gap-4 rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-[0_16px_28px_-24px_rgba(0,0,0,0.5)] sm:px-6 sm:py-6'>
                <ReachOutGlyph index={index} />
                <div className='space-y-1.5'>
                  <h3 className='es-section-heading text-[clamp(1.2rem,2.4vw,1.6rem)]'>
                    {item.title}
                  </h3>
                  <p className='es-section-body text-base leading-7'>
                    {item.description}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </SectionContainer>
    </SectionShell>
  );
}
