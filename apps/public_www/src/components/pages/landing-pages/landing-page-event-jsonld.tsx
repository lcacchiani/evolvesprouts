'use client';

import { useContext } from 'react';

import { StructuredDataScript } from '@/components/shared/structured-data-script';
import type { Locale } from '@/content';
import { buildLandingPageEventSchema } from '@/lib/structured-data';
import { LandingPageCalendarContext } from '@/lib/landing-page-calendar-context';

interface LandingPageEventJsonLdProps {
  locale: Locale;
  pagePath: string;
}

export function LandingPageEventJsonLd({ locale, pagePath }: LandingPageEventJsonLdProps) {
  const calendar = useContext(LandingPageCalendarContext);
  if (!calendar) {
    return null;
  }

  const eventSchema = buildLandingPageEventSchema({
    locale,
    pagePath,
    structuredDataContent: calendar.structuredDataContent,
  });

  return (
    <StructuredDataScript
      id={`landing-page-event-jsonld-${locale}`}
      data={eventSchema}
    />
  );
}
