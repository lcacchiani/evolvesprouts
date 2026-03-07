'use client';

import { RealTalkCard } from '@/components/sections/real-talk-card';
import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { RealTalkContent } from '@/content';
import enContent from '@/content/en.json';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';

interface RealTalkProps {
  content: RealTalkContent;
}

interface RealTalkCardCopy {
  id: string;
  title: string;
}

const CARD_TONES = ['green', 'blue'] as const;

const fallbackRealTalkCopy = enContent.realTalk;
const orderedCardIds = [
  'ipad-when-crying',
  'spoon-fed-at-three',
  'monster-threat-at-meals',
  'no-shoes-independence',
  'rules-change-when-i-leave',
  'out-of-ideas',
] as const;

function getRealTalkCards(content: RealTalkContent): RealTalkCardCopy[] {
  const activeItems = content.items.length > 0
    ? content.items
    : fallbackRealTalkCopy.items;
  const itemById = new Map(activeItems.map((item) => [item.id, item]));
  const cards: RealTalkCardCopy[] = [];

  for (const id of orderedCardIds) {
    const cardCopy = itemById.get(id);
    if (!cardCopy) {
      continue;
    }

    cards.push({
      id: cardCopy.id,
      title: cardCopy.title,
    });
  }

  return cards;
}

export function RealTalk({ content }: RealTalkProps) {
  const sectionTitle = content.title || fallbackRealTalkCopy.title;
  const sectionDescription = content.description || fallbackRealTalkCopy.description;
  const sectionEyebrow = content.eyebrow || fallbackRealTalkCopy.eyebrow;
  const ctaLabel = content.ctaLabel || fallbackRealTalkCopy.ctaLabel;
  const ctaHref = content.ctaHref || fallbackRealTalkCopy.ctaHref;
  const realTalkCards = getRealTalkCards(content);
  const {
    carouselRef,
  } = useHorizontalCarousel<HTMLDivElement>({
    itemCount: realTalkCards.length,
    loop: true,
  });

  return (
    <SectionShell
      id='real-talk'
      ariaLabel={sectionTitle}
      dataFigmaNode='real-talk'
      className='es-section-bg-overlay es-real-talk-section'
    >
      <div
        aria-hidden='true'
        className='es-real-talk-overlay pointer-events-none absolute inset-0'
      />

      <SectionContainer>
        <SectionHeader
          eyebrow={sectionEyebrow}
          title={sectionTitle}
        />

        <div className='relative mt-12 sm:mt-14 xl:mt-16'>
          <CarouselTrack
            carouselRef={carouselRef}
            testId='real-talk-mobile-carousel'
            ariaLabel={`${sectionTitle} carousel`}
            className='pb-2 md:snap-none md:overflow-visible md:pb-0'
          >
            <ul className='flex min-w-0 gap-5 sm:gap-6 md:grid md:grid-cols-2 md:gap-6 xl:grid-cols-3'>
              {realTalkCards.map((card, index) => {
                const tone = CARD_TONES[index % CARD_TONES.length];

                return (
                  <li
                    key={card.id}
                    className='w-[84vw] max-w-[360px] shrink-0 snap-center sm:w-[68vw] md:w-auto md:max-w-none md:shrink md:snap-none'
                  >
                    <RealTalkCard
                      title={card.title}
                      tone={tone}
                    />
                  </li>
                );
              })}
            </ul>
          </CarouselTrack>
        </div>

        {sectionDescription && (
          <div className='mt-9 text-center sm:mt-11 lg:mt-12'>
            <p className='es-type-body-italic mx-auto max-w-[780px] text-balance'>
              {sectionDescription}
            </p>
          </div>
        )}

        <div className='mt-8 flex justify-center sm:mt-10 lg:mt-11'>
          <SectionCtaAnchor
            href={ctaHref}
            className='w-full max-w-[488px]'
          >
            {ctaLabel}
          </SectionCtaAnchor>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
