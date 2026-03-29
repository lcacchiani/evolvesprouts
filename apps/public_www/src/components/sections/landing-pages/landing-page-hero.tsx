'use client';

import Image from 'next/image';
import {
  useMemo,
  useState,
} from 'react';

import {
  HeroQuickFactChips,
  type HeroQuickFactChip,
} from '@/components/sections/shared/hero-quick-fact-chips';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { LandingPageBookingCtaAction } from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import type {
  BookingModalContent,
  LandingPagesCommonContent,
  LandingPageLocaleContent,
  Locale,
} from '@/content';
import type {
  EventBookingModalPayload,
  LandingPageHeroEventContent,
} from '@/lib/events-data';
import {
  formatHeroFullDateLine,
  formatSiteTimeRange,
} from '@/lib/site-datetime';

interface LandingPageHeroProps {
  slug: string;
  content: LandingPageLocaleContent['hero'];
  ctaContent: LandingPageLocaleContent['cta'];
  ctaPriceLabel?: string;
  commonContent: LandingPagesCommonContent;
  locale: Locale;
  title: string;
  eventContent: LandingPageHeroEventContent | null;
  bookingPayload: EventBookingModalPayload | null;
  isFullyBooked: boolean;
  fullyBookedCtaLabel?: string;
  fullyBookedWaitlistHref?: string;
  bookingModalContent: BookingModalContent;
  thankYouWhatsappHref?: string;
  thankYouWhatsappCtaLabel?: string;
  ariaLabel?: string;
}

const PARTNER_LOGO_EXTENSIONS = ['webp', 'svg'] as const;
const KNOWN_PARTNER_LOGO_SOURCES: Readonly<Record<string, readonly string[]>> = {
  'evolvesprouts': ['/images/evolvesprouts-logo.svg'],
  'baumhaus': ['/images/partners/baumhaus.webp'],
  'happy-baton': ['/images/partners/happy-baton.webp'],
};
const HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT: Readonly<Record<number, string>> = {
  50: 'max-w-[50%]',
  55: 'max-w-[55%]',
  60: 'max-w-[60%]',
  65: 'max-w-[65%]',
  70: 'max-w-[70%]',
  75: 'max-w-[75%]',
  80: 'max-w-[80%]',
  85: 'max-w-[85%]',
  90: 'max-w-[90%]',
  95: 'max-w-[95%]',
  100: 'max-w-[100%]',
  105: 'max-w-[105%]',
  110: 'max-w-[110%]',
  115: 'max-w-[115%]',
  120: 'max-w-[120%]',
};

function resolveHeroImageMaxWidthClass(imageMaxWidthPercent: number | undefined): string {
  if (typeof imageMaxWidthPercent !== 'number' || !Number.isFinite(imageMaxWidthPercent)) {
    return HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[100];
  }

  const normalizedPercent = Math.round(imageMaxWidthPercent);
  return HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[normalizedPercent]
    ?? HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[100];
}

function buildPartnerLogoSources(partner: string): string[] {
  const normalizedPartner = partner.trim().toLowerCase();
  if (!normalizedPartner) {
    return [];
  }

  const knownSources = KNOWN_PARTNER_LOGO_SOURCES[normalizedPartner];
  if (knownSources) {
    return [...knownSources];
  }

  return PARTNER_LOGO_EXTENSIONS.map(
    (extension) => `/images/partners/${normalizedPartner}.${extension}`,
  );
}

function buildPartnerLogoTestId(partner: string): string {
  return `landing-page-partner-logo-${partner.trim().toLowerCase()}`;
}

function buildDisplayedPartnerSlugs(partners: readonly string[] | undefined): string[] {
  const normalizedPartners = (partners ?? [])
    .map((partner) => partner.trim().toLowerCase())
    .filter((partner) => partner.length > 0);
  if (normalizedPartners.length === 0) {
    return [];
  }

  const dedupedPartners = Array.from(new Set(normalizedPartners));
  return [
    'evolvesprouts',
    ...dedupedPartners.filter((partner) => partner !== 'evolvesprouts'),
  ];
}

function PartnerLogo({ partner }: { partner: string }) {
  const normalizedPartner = partner.trim().toLowerCase();
  const candidateSources = useMemo(
    () => buildPartnerLogoSources(normalizedPartner),
    [normalizedPartner],
  );
  const [sourceIndex, setSourceIndex] = useState(0);

  const source = candidateSources[sourceIndex];
  if (!source) {
    return null;
  }

  const logoSizeClassName =
    normalizedPartner === 'evolvesprouts' ? 'h-16 w-auto object-contain' : 'h-8 w-auto object-contain';

  return (
    <Image
      src={source}
      alt=''
      width={160}
      height={48}
      className={logoSizeClassName}
      aria-hidden='true'
      data-testid={buildPartnerLogoTestId(normalizedPartner)}
      onError={() => {
        setSourceIndex((currentIndex) => currentIndex + 1);
      }}
    />
  );
}

function buildHeroChips(
  eventContent: LandingPageHeroEventContent | null,
  locale: Locale,
): HeroQuickFactChip[] {
  if (!eventContent) {
    return [];
  }

  const dedupedChips: HeroQuickFactChip[] = [];
  const seen = new Set<string>();

  for (const chip of [
    {
      type: 'date' as const,
      label: formatHeroFullDateLine(eventContent.startDateTime, locale),
    },
    {
      type: 'time' as const,
      label: formatSiteTimeRange(
        eventContent.startDateTime,
        eventContent.endDateTime,
        locale,
      ),
    },
    {
      type: 'location' as const,
      label: eventContent.locationLabel,
    },
    ...eventContent.categoryChips.map((value) => ({
      type: 'category' as const,
      label: value,
    })),
  ]) {
    const normalizedValue = chip.label?.trim() ?? '';
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    dedupedChips.push({
      type: chip.type,
      label: normalizedValue,
    });
  }

  return dedupedChips;
}

export function LandingPageHero({
  slug,
  content,
  ctaContent,
  ctaPriceLabel,
  commonContent,
  locale,
  title,
  eventContent,
  bookingPayload,
  isFullyBooked,
  fullyBookedCtaLabel,
  fullyBookedWaitlistHref,
  bookingModalContent,
  thankYouWhatsappHref,
  thankYouWhatsappCtaLabel,
  ariaLabel,
}: LandingPageHeroProps) {
  const heroImageMaxWidthClassName = useMemo(
    () => resolveHeroImageMaxWidthClass(content.imageMaxWidthPercent),
    [content.imageMaxWidthPercent],
  );
  const chips = useMemo(
    () => buildHeroChips(eventContent, locale),
    [eventContent, locale],
  );
  const partnerSlugs = useMemo(
    () => buildDisplayedPartnerSlugs(eventContent?.partners),
    [eventContent?.partners],
  );

  return (
    <SectionShell
      id='landing-page-hero'
      ariaLabel={ariaLabel ?? title}
      dataFigmaNode='landing-page-hero'
      className='es-landing-page-hero-section es-bg-surface-white overflow-x-clip'
    >
      <SectionContainer className='grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]'>
        <div className='space-y-5'>
          <SectionHeader
            title={title}
            titleAs='h1'
            align='left'
          />
          {content.subtitle ? (
            <p className='es-type-subtitle-lg es-text-heading'>{content.subtitle}</p>
          ) : null}
          {partnerSlugs.length > 0 ? (
            <div
              data-testid='landing-page-hero-partners'
              className='flex flex-wrap items-center gap-5'
            >
              {partnerSlugs.map((partner) => (
                <PartnerLogo
                  key={partner}
                  partner={partner}
                />
              ))}
            </div>
          ) : null}
          <p className='es-type-body'>{renderQuotedDescriptionText(content.description)}</p>
          <HeroQuickFactChips chips={chips} />
          <LandingPageBookingCtaAction
            locale={locale}
            slug={slug}
            content={ctaContent}
            ctaPriceLabel={ctaPriceLabel}
            commonContent={commonContent}
            bookingPayload={bookingPayload}
            isFullyBooked={isFullyBooked}
            fullyBookedCtaLabel={fullyBookedCtaLabel}
            fullyBookedWaitlistHref={fullyBookedWaitlistHref}
            bookingModalContent={bookingModalContent}
            thankYouWhatsappHref={thankYouWhatsappHref}
            thankYouWhatsappCtaLabel={thankYouWhatsappCtaLabel}
            analyticsSectionId='landing-page-hero'
            ctaLocation='landing_page'
            buttonClassName='mt-3'
          />
        </div>
        <div
          className={`es-landing-page-hero-image-wrap mx-auto w-full justify-self-center ${heroImageMaxWidthClassName}`}
        >
          <Image
            src={content.imageSrc}
            alt={content.imageAlt}
            width={1200}
            height={900}
            sizes='(max-width: 1024px) 120vw, 60vw'
            className='relative z-10 h-auto w-full rounded-panel'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
