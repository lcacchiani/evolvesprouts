import Image from 'next/image';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import {
  HeroQuickFactChips,
  type HeroQuickFactChip,
} from '@/components/sections/shared/hero-quick-fact-chips';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { resolveMyBestAuntieHeroDescription } from '@/content/copy-normalizers';
import { formatContentTemplate } from '@/content/content-field-utils';
import type { MyBestAuntieHeroContent } from '@/content';

interface MyBestAuntieHeroProps {
  content: MyBestAuntieHeroContent;
  lowestPrice?: number;
  nextCohortLabel?: string;
}

const MY_BEST_AUNTIE_HERO_CTA_CLASSNAME = 'mt-auto max-w-[360px]';

function buildMyBestAuntieHeroChips(
  content: MyBestAuntieHeroContent,
  lowestPrice: number | undefined,
  nextCohortLabel: string | undefined,
): HeroQuickFactChip[] {
  const quickFacts = (content as Record<string, unknown>).quickFacts as
    | { durationLabel: string; homeVisitsLabel: string; priceTemplate: string; nextCohortTemplate: string }
    | undefined;

  if (!quickFacts) {
    return [];
  }

  const chips: HeroQuickFactChip[] = [
    { type: 'duration', label: quickFacts.durationLabel.trim() },
  ];

  if (lowestPrice !== undefined) {
    chips.push({
      type: 'price',
      label: formatContentTemplate(quickFacts.priceTemplate, {
        price: lowestPrice.toLocaleString(),
      }).trim(),
    });
  }

  if (nextCohortLabel) {
    chips.push({
      type: 'cohort',
      label: formatContentTemplate(quickFacts.nextCohortTemplate, {
        cohortLabel: nextCohortLabel,
      }).trim(),
    });
  }

  chips.push({ type: 'visits', label: quickFacts.homeVisitsLabel.trim() });

  return chips.filter((chip) => chip.label.length > 0);
}

function MicroTestimonial({ content }: { content: MyBestAuntieHeroContent }) {
  const quote = (content as Record<string, unknown>).testimonialQuote as string | undefined;
  const attribution = (content as Record<string, unknown>).testimonialAttribution as string | undefined;

  if (!quote) {
    return null;
  }

  return (
    <blockquote className='mt-5 max-w-[620px]'>
      <p className='text-sm italic es-text-muted'>
        &ldquo;{quote}&rdquo;
      </p>
      {attribution && (
        <footer className='mt-1 text-xs es-text-muted'>
          {attribution}
        </footer>
      )}
    </blockquote>
  );
}

export function MyBestAuntieHero({
  content,
  lowestPrice,
  nextCohortLabel,
}: MyBestAuntieHeroProps) {
  const description = resolveMyBestAuntieHeroDescription(content);
  const heroChips = buildMyBestAuntieHeroChips(content, lowestPrice, nextCohortLabel);

  return (
    <SectionShell
      id='my-best-auntie-hero'
      ariaLabel={content.title}
      dataFigmaNode='my-best-auntie-hero'
      className='es-my-best-auntie-hero-section overflow-hidden pt-0 sm:pt-[60px]'
    >
      <SectionContainer
        className={buildSectionSplitLayoutClassName(
          'es-section-split-layout--hero es-section-split-layout--my-best-auntie-hero items-center',
        )}
      >
        <div className='relative max-w-[620px] lg:order-2 lg:pb-4 lg:pl-8'>
          <div className='relative z-10'>
            <SectionHeader
              title={content.title}
              titleAs='h1'
              align='left'
              titleClassName='max-w-[720px]'
              description={content.subtitle}
              descriptionClassName='es-type-subtitle mt-4 max-w-[720px]'
            />
            <HeroQuickFactChips
              chips={heroChips}
              className='mt-5'
              data-testid='my-best-auntie-hero-quick-facts'
            />
            <p className='mt-4 max-w-[720px] es-type-body'>
              {renderQuotedDescriptionText(description)}
            </p>
            <MicroTestimonial content={content} />
            <div className='mt-8'>
              <SectionCtaAnchor
                href={content.ctaHref}
                variant='primary'
                className={MY_BEST_AUNTIE_HERO_CTA_CLASSNAME}
              >
                {content.ctaLabel}
              </SectionCtaAnchor>
            </div>
          </div>
        </div>

        <div className='es-my-best-auntie-hero-image-wrap mx-auto w-full max-w-[500px] lg:order-1 lg:ml-0 lg:mr-auto'>
          <Image
            src='/images/hero/my-best-auntie-hero.webp'
            alt={content.imageAlt}
            width={1200}
            height={900}
            sizes='(max-width: 640px) 92vw, 500px'
            className='es-my-best-auntie-hero-image-flipped relative z-10 h-auto w-full'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
