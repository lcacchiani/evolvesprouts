import type { CSSProperties } from 'react';
import Image from 'next/image';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { MyJourneyContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface MyJourneyProps {
  content: MyJourneyContent;
}

const SECTION_BACKGROUND = '#FFFFFF';
const SECTION_BACKGROUND_IMAGE = 'url("/images/evolvesprouts-logo.svg")';
const SECTION_BACKGROUND_POSITION = 'center -150px';
const SECTION_BACKGROUND_SIZE = '900px auto';
const SECTION_BACKGROUND_FILTER =
  'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)';
const SECTION_BACKGROUND_MASK_IMAGE =
  'linear-gradient(to bottom, black 18%, transparent 20%)';
const JOURNEY_IMAGE_SRC = '/images/contact-us/my-journey.webp';
const RIGHT_COLUMN_BLUE_CARD_BACKGROUND =
  'linear-gradient(180deg, #E3F0FF 0%, #FFFFFF 100%)';
const RIGHT_COLUMN_YELLOW_CARD_BACKGROUND =
  'linear-gradient(180deg, #FFF3E0 0%, #FFFFFF 100%)';
const RIGHT_COLUMN_CARD_BACKGROUNDS = [
  RIGHT_COLUMN_BLUE_CARD_BACKGROUND,
  RIGHT_COLUMN_YELLOW_CARD_BACKGROUND,
] as const;

const eyebrowStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 500,
  lineHeight: '1',
  fontSize: '18px',
};

const titleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: '1.14',
  fontSize: 'clamp(1.95rem, 4.7vw, 50px)',
};

const tagStyle: CSSProperties = {
  color: '#C84A16',
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 700,
  lineHeight: '1',
  fontSize: '14px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const bodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: '1.55',
  fontSize: 'clamp(1rem, 1.85vw, 22px)',
};

export function MyJourney({ content }: MyJourneyProps) {
  return (
    <SectionShell
      id='my-journey'
      ariaLabel={content.title}
      dataFigmaNode='my-journey'
      className='es-section-bg-overlay'
      style={
        {
          backgroundColor: SECTION_BACKGROUND,
          ['--es-section-bg-image' as string]: SECTION_BACKGROUND_IMAGE,
          ['--es-section-bg-position' as string]: SECTION_BACKGROUND_POSITION,
          ['--es-section-bg-size' as string]: SECTION_BACKGROUND_SIZE,
          ['--es-section-bg-filter' as string]: SECTION_BACKGROUND_FILTER,
          ['--es-section-bg-mask-image' as string]:
            SECTION_BACKGROUND_MASK_IMAGE,
        } as CSSProperties
      }
    >
      <div className='relative z-10 mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[980px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
          />
          <h2 className='mt-6' style={titleStyle}>
            {content.title}
          </h2>
        </div>

        <div className='mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-8'>
          <div className='relative overflow-hidden rounded-[30px] bg-[#F5DFCF]'>
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
                  className='rounded-[20px] border border-[#ECD5C3] p-5 sm:p-6'
                  style={{
                    background:
                      RIGHT_COLUMN_CARD_BACKGROUNDS[
                        index % RIGHT_COLUMN_CARD_BACKGROUNDS.length
                      ],
                  }}
                >
                  <span style={tagStyle}>{card.tag}</span>
                  <p className='mt-3' style={bodyStyle}>
                    {card.description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
