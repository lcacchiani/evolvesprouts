import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { ContactUsContent } from '@/content';
import {
  BRAND_ORANGE,
} from '@/lib/design-tokens';
import { buildSectionBackgroundStyle } from '@/lib/section-backgrounds';

interface ReachOutProps {
  content: ContactUsContent['reachOut'];
}

const SECTION_STYLE = buildSectionBackgroundStyle({
  backgroundColor: 'var(--figma-colors-frame-2147235259, #FFEEE3)',
  position: 'center -400px',
  size: '900px auto',
  blendMode: 'difference',
});

function ReachOutGlyph({ index }: { index: number }) {
  const colorMap = [
    BRAND_ORANGE,
    'var(--figma-colors-frame-2147235242, #174879)',
    'var(--es-color-accent-gold, #9E6D12)',
    'var(--es-color-accent-green, #5D9D49)',
  ] as const;
  const color = colorMap[index % colorMap.length];

  return (
    <span
      aria-hidden='true'
      className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-white'
      style={{
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <svg
        viewBox='0 0 24 24'
        className='h-5 w-5'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M6 12.2L10.3 16.5L18 8.8'
          stroke={color}
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
      className='relative isolate overflow-hidden'
      style={SECTION_STYLE}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[840px] text-center'>
          <SectionEyebrowChip label={content.eyebrow} />
          <h2 className='es-type-title mt-6 text-balance'>{content.title}</h2>
        </div>

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
      </div>
    </SectionShell>
  );
}
