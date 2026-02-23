import Image from 'next/image';

import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { MyJourneyContent } from '@/content';

interface MyJourneyProps {
  content: MyJourneyContent;
}

const JOURNEY_IMAGE_SRC = '/images/contact-us/my-journey.webp';
const RIGHT_COLUMN_CARD_TONE_CLASSES = [
  'es-my-journey-card--blue',
  'es-my-journey-card--yellow',
] as const;

export function MyJourney({ content }: MyJourneyProps) {
  return (
    <SectionShell
      id='my-journey'
      ariaLabel={content.title}
      dataFigmaNode='my-journey'
      className='es-section-bg-overlay es-my-journey-section'
    >
      <SectionContainer>
        <SectionHeader eyebrow={content.eyebrow} title={content.title} />

        <div
          className={buildSectionSplitLayoutClassName(
            'es-section-split-layout--my-journey mt-10 lg:mt-12',
          )}
        >
          <div className='relative overflow-hidden rounded-card-lg es-bg-surface-peach'>
            <Image
              src={JOURNEY_IMAGE_SRC}
              alt='My Montessori Journey section image'
              width={539}
              height={675}
              sizes='(min-width: 1280px) 34vw, (min-width: 1024px) 38vw, 100vw'
              className='h-full min-h-[270px] w-full object-cover lg:min-h-[405px]'
            />
          </div>

          <ul className='space-y-4'>
            {content.cards.map((card, index) => (
              <li key={card.tag}>
                <article
                  className={`rounded-card-sm border es-border-warm-3 p-5 sm:p-6 ${RIGHT_COLUMN_CARD_TONE_CLASSES[index % RIGHT_COLUMN_CARD_TONE_CLASSES.length]}`}
                >
                  <span className='es-my-journey-tag'>{card.tag}</span>
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
