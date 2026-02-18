import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionContainer } from '@/components/section-container';
import { SectionHeader } from '@/components/section-header';
import { SectionShell } from '@/components/section-shell';
import type { MyJourneyContent } from '@/content';
import {
  BRAND_ORANGE,
  SURFACE_WHITE,
} from '@/lib/design-tokens';
import {
  buildSectionBackgroundOverlayStyle,
  LOGO_OVERLAY_TOP,
} from '@/lib/section-backgrounds';

interface MyJourneyProps {
  content: MyJourneyContent;
}

const SECTION_STYLE = buildSectionBackgroundOverlayStyle({
  ...LOGO_OVERLAY_TOP,
  backgroundColor: SURFACE_WHITE,
});
const JOURNEY_IMAGE_SRC = '/images/contact-us/my-journey.webp';
const RIGHT_COLUMN_BLUE_CARD_BACKGROUND =
  'var(--es-gradient-card-blue)';
const RIGHT_COLUMN_YELLOW_CARD_BACKGROUND =
  'var(--es-gradient-card-yellow)';
const RIGHT_COLUMN_CARD_BACKGROUNDS = [
  RIGHT_COLUMN_BLUE_CARD_BACKGROUND,
  RIGHT_COLUMN_YELLOW_CARD_BACKGROUND,
] as const;

const tagStyle: CSSProperties = {
  color: BRAND_ORANGE,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 700,
  lineHeight: '1',
  fontSize: '14px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

export function MyJourney({ content }: MyJourneyProps) {
  return (
    <SectionShell
      id='my-journey'
      ariaLabel={content.title}
      dataFigmaNode='my-journey'
      className='es-section-bg-overlay'
      style={SECTION_STYLE}
    >
      <SectionContainer>
        <SectionHeader eyebrow={content.eyebrow} title={content.title} />

        <div className='mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-8'>
          <div className='relative overflow-hidden rounded-[30px] es-bg-surface-peach'>
            <Image
              src={JOURNEY_IMAGE_SRC}
              alt='My Montessori Journey section image'
              width={539}
              height={675}
              sizes='(min-width: 1280px) 34vw, (min-width: 1024px) 38vw, 100vw'
              className='h-full min-h-[360px] w-full object-cover lg:min-h-[540px]'
            />
          </div>

          <ul className='space-y-4'>
            {content.cards.map((card, index) => (
              <li key={card.tag}>
                <article
                  className='rounded-[20px] border es-border-warm-3 p-5 sm:p-6'
                  style={{
                    background:
                      RIGHT_COLUMN_CARD_BACKGROUNDS[
                        index % RIGHT_COLUMN_CARD_BACKGROUNDS.length
                      ],
                  }}
                >
                  <span style={tagStyle}>{card.tag}</span>
                  <p className='es-type-body mt-3'>
                    {card.description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
