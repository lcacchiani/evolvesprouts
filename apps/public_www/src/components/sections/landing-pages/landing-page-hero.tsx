'use client';

import Image from 'next/image';
import {
  useEffect,
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
  commonContent: LandingPagesCommonContent;
  locale: Locale;
  title: string;
  eventContent: LandingPageHeroEventContent | null;
  bookingPayload: EventBookingModalPayload | null;
  isFullyBooked: boolean;
  bookingModalContent: BookingModalContent;
  ariaLabel?: string;
}

const PARTNER_LOGO_EXTENSIONS = ['webp', 'svg'] as const;

function buildPartnerLogoSources(partner: string): string[] {
  const normalizedPartner = partner.trim().toLowerCase();
  if (!normalizedPartner) {
    return [];
  }

  return PARTNER_LOGO_EXTENSIONS.map(
    (extension) => `/images/partners/${normalizedPartner}.${extension}`,
  );
}

function buildPartnerLogoTestId(partner: string): string {
  return `landing-page-partner-logo-${partner.trim().toLowerCase()}`;
}

function PartnerLogo({ partner }: { partner: string }) {
  const candidateSources = useMemo(
    () => buildPartnerLogoSources(partner),
    [partner],
  );
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [candidateSources]);

  const source = candidateSources[sourceIndex];
  if (!source) {
    return null;
  }

  return (
    <Image
      src={source}
      alt=''
      width={160}
      height={48}
      className='h-8 w-auto object-contain'
      aria-hidden='true'
      data-testid={buildPartnerLogoTestId(partner)}
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
): string[] {
  if (!eventContent) {
    return [];
  }

  const dedupedChips: string[] = [];
  const seen = new Set<string>();

  for (const value of [
    buildHeroDateChip(eventContent.startDateTime, locale),
    buildHeroTimeChip(eventContent.startDateTime, eventContent.endDateTime, locale),
    eventContent.locationLabel,
    ...eventContent.categoryChips,
  ]) {
    const normalizedValue = value?.trim() ?? '';
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    dedupedChips.push(normalizedValue);
  }

  return dedupedChips;
}

export function LandingPageHero({
  slug,
  content,
  ctaContent,
  commonContent,
  locale,
  title,
  eventContent,
  bookingPayload,
  isFullyBooked,
  bookingModalContent,
  ariaLabel,
}: LandingPageHeroProps) {
  const [chips, setChips] = useState<string[]>([]);
  const partnerSlugs = eventContent?.partners ?? [];

  useEffect(() => {
    setChips(buildHeroChips(eventContent, locale));
  }, [eventContent, locale]);

  return (
    <SectionShell
      id='landing-page-hero'
      ariaLabel={ariaLabel ?? title}
      dataFigmaNode='landing-page-hero'
      className='es-bg-surface-white'
    >
      <SectionContainer className='grid items-center gap-10 lg:grid-cols-2'>
        <div className='space-y-5'>
          <SectionHeader
            title={title}
            titleAs='h1'
            align='left'
          />
          <p className='es-type-subtitle-lg es-text-heading'>{content.subtitle}</p>
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
              {chips.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className='rounded-full border es-border-soft es-bg-surface-soft px-4 py-2 text-sm font-semibold es-text-heading'
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          <LandingPageBookingCtaAction
            locale={locale}
            slug={slug}
            content={ctaContent}
            commonContent={commonContent}
            bookingPayload={bookingPayload}
            isFullyBooked={isFullyBooked}
            bookingModalContent={bookingModalContent}
            analyticsSectionId='landing-page-hero'
            ctaLocation='landing_page'
            buttonClassName='mt-3'
          />
        </div>
        <div className='w-full'>
          {content.imageMobileSrc ? (
            <>
              <Image
                src={content.imageMobileSrc}
                alt={content.imageAlt}
                width={720}
                height={720}
                sizes='100vw'
                className='h-auto w-full rounded-panel sm:hidden'
              />
              <Image
                src={content.imageSrc}
                alt={content.imageAlt}
                width={1200}
                height={900}
                sizes='(max-width: 1024px) 100vw, 50vw'
                className='hidden h-auto w-full rounded-panel sm:block'
              />
            </>
          ) : (
            <Image
              src={content.imageSrc}
              alt={content.imageAlt}
              width={1200}
              height={900}
              sizes='(max-width: 1024px) 100vw, 50vw'
              className='h-auto w-full rounded-panel'
            />
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
