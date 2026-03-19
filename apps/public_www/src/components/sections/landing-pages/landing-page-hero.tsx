'use client';

import Image from 'next/image';
import {
  useMemo,
  useState,
} from 'react';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
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
  ariaLabel?: string;
}

type HeroChipType = 'date' | 'time' | 'location' | 'category';

interface HeroChip {
  type: HeroChipType;
  label: string;
}

const PARTNER_LOGO_EXTENSIONS = ['webp', 'svg'] as const;
const KNOWN_PARTNER_LOGO_SOURCES: Readonly<Record<string, readonly string[]>> = {
  'evolvesprouts': ['/images/evolvesprouts-logo.svg'],
  'baumhaus': ['/images/partners/baumhaus.webp'],
  'happy-baton': ['/images/partners/happy-baton.webp'],
};
const CALENDAR_ICON_SRC = '/images/calendar.svg';
const CLOCK_ICON_SRC = '/images/clock.svg';
const LOCATION_ICON_SRC = '/images/location.svg';

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

function resolveDateTimeLocale(locale: Locale): string {
  if (locale === 'en') {
    return 'en-GB';
  }

  return locale;
}

function buildHeroDateChip(startDateTime: string | undefined, locale: Locale): string | undefined {
  const normalizedStartDateTime = startDateTime?.trim() ?? '';
  if (!normalizedStartDateTime) {
    return undefined;
  }

  const startDate = new Date(normalizedStartDateTime);
  if (Number.isNaN(startDate.getTime())) {
    return undefined;
  }

  const dateParts = new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).formatToParts(startDate);
  const weekday = dateParts.find((part) => part.type === 'weekday')?.value;
  const day = dateParts.find((part) => part.type === 'day')?.value;
  const month = dateParts.find((part) => part.type === 'month')?.value;
  const year = dateParts.find((part) => part.type === 'year')?.value;
  if (!weekday || !day || !month || !year) {
    return undefined;
  }

  return `${weekday} ${day} ${month} ${year}`;
}

function buildHeroTimeChip(
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  locale: Locale,
): string | undefined {
  const normalizedStartDateTime = startDateTime?.trim() ?? '';
  if (!normalizedStartDateTime) {
    return undefined;
  }

  const startDate = new Date(normalizedStartDateTime);
  if (Number.isNaN(startDate.getTime())) {
    return undefined;
  }

  const timeFormatter =
    locale === 'en'
      ? new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
  const startTimeLabel = timeFormatter.format(startDate);

  const normalizedEndDateTime = endDateTime?.trim() ?? '';
  if (!normalizedEndDateTime) {
    return startTimeLabel;
  }

  const endDate = new Date(normalizedEndDateTime);
  if (Number.isNaN(endDate.getTime())) {
    return startTimeLabel;
  }

  return `${startTimeLabel} - ${timeFormatter.format(endDate)}`;
}

function buildHeroChips(
  eventContent: LandingPageHeroEventContent | null,
  locale: Locale,
): HeroChip[] {
  if (!eventContent) {
    return [];
  }

  const dedupedChips: HeroChip[] = [];
  const seen = new Set<string>();

  for (const chip of [
    {
      type: 'date' as const,
      label: buildHeroDateChip(eventContent.startDateTime, locale),
    },
    {
      type: 'time' as const,
      label: buildHeroTimeChip(eventContent.startDateTime, eventContent.endDateTime, locale),
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

function resolveHeroChipIconSource(type: HeroChipType): string | null {
  if (type === 'date') {
    return CALENDAR_ICON_SRC;
  }
  if (type === 'time') {
    return CLOCK_ICON_SRC;
  }
  if (type === 'location') {
    return LOCATION_ICON_SRC;
  }

  return null;
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
  ariaLabel,
}: LandingPageHeroProps) {
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
      className='es-landing-page-hero-section es-bg-surface-white'
    >
      <SectionContainer className='grid items-center gap-10 lg:grid-cols-2'>
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
          <p className='es-type-body'>{content.description}</p>
          {chips.length > 0 ? (
            <div className='flex flex-wrap gap-3'>
              {chips.map((chip, index) => {
                const iconSource = resolveHeroChipIconSource(chip.type);
                return (
                  <span
                    key={`${chip.label}-${index}`}
                    className='inline-flex items-center gap-1.5 rounded-full border es-border-soft es-bg-surface-soft px-4 py-2 text-sm font-semibold es-text-heading'
                  >
                    {iconSource ? (
                      <Image
                        src={iconSource}
                        alt=''
                        aria-hidden='true'
                        width={14}
                        height={14}
                        className='h-3.5 w-3.5 shrink-0 self-center'
                      />
                    ) : null}
                    <span className='inline-flex items-center'>{chip.label}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
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
            analyticsSectionId='landing-page-hero'
            ctaLocation='landing_page'
            buttonClassName='mt-3'
          />
        </div>
        <div className='es-landing-page-hero-image-wrap w-full'>
          <Image
            src={content.imageSrc}
            alt={content.imageAlt}
            width={1200}
            height={900}
            sizes='(max-width: 1024px) 100vw, 50vw'
            className='relative z-10 h-auto w-full rounded-panel'
          />
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
