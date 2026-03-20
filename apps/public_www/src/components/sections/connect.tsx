import ConnectGlyphArrowIcon from '@/components/icons/svg/connect-glyph-arrow-icon.svg';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ContactUsContent } from '@/content';

interface ConnectProps {
  content: ContactUsContent['connect'];
}

function ConnectGlyph({ index }: { index: number }) {
  const iconToneClassNames: readonly [string, string, string] = [
    'es-connect-glyph--blue',
    'es-connect-glyph--green',
    'es-connect-glyph--orange',
  ] as const;
  const toneClassName = iconToneClassNames[index % iconToneClassNames.length];

  return (
    <span
      aria-hidden='true'
      className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${toneClassName}`}
    >
      <ConnectGlyphArrowIcon className='h-5 w-5' />
    </span>
  );
}

export function Connect({ content }: ConnectProps) {
  return (
    <SectionShell
      id='connect'
      ariaLabel={content.title}
      dataFigmaNode='connect'
      className='overflow-hidden es-section-bg-overlay es-connect-section'
    >
      <SectionContainer>
        <SectionHeader
          eyebrow={content.eyebrow}
          title={content.title}
        />

        <ul className='mt-10 grid grid-cols-1 gap-5 lg:mt-12 lg:grid-cols-3'>
          {content.cards.map((card, index) => (
            <li key={`${card.title}-${card.ctaHref}`}>
              <article className='flex h-full flex-col rounded-3xl border es-border-warm-1 es-bg-surface-soft p-5 shadow-card sm:p-6'>
                <ConnectGlyph index={index} />
                <h3 className='mt-4 es-connect-card-title'>
                  {card.title}
                </h3>
                <p className='es-section-body mt-2 text-base leading-7'>
                  {renderQuotedDescriptionText(card.description)}
                </p>
                <SectionCtaAnchor
                  href={card.ctaHref}
                  className='mt-auto w-full'
                >
                  {card.ctaLabel}
                </SectionCtaAnchor>
              </article>
            </li>
          ))}
        </ul>
      </SectionContainer>
    </SectionShell>
  );
}
