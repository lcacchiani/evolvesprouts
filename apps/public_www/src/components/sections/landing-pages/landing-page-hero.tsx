'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { LandingPageLocaleContent, Locale } from '@/content';
import type { LandingPageHeroEventContent } from '@/lib/events-data';

interface LandingPageHeroProps {
  content: LandingPageLocaleContent['hero'];
  locale: Locale;
  title: string;
  eventContent: LandingPageHeroEventContent | null;
  ariaLabel?: string;
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

  return new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(startDate);
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
  content,
  locale,
  title,
  eventContent,
  ariaLabel,
}: LandingPageHeroProps) {
  const [chips, setChips] = useState<string[]>([]);

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
