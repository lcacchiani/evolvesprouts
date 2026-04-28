'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { LandingPageSharedCtaProps } from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import type { Locale, LandingPageLocaleContent, SiteContent } from '@/content';
import { buildLandingPageSharedCtaPropsFromCalendar } from '@/lib/landing-page-cta-resolve';
import type {
  LandingPageBookingEventContent,
  LandingPageHeroEventContent,
  LandingPageStructuredDataContent,
} from '@/lib/events-data';
import { useLandingPageCalendar } from '@/lib/use-landing-page-calendar';

export interface LandingPageCalendarContextValue {
  heroEventContent: LandingPageHeroEventContent | null;
  bookingEventContent: LandingPageBookingEventContent | null;
  structuredDataContent: LandingPageStructuredDataContent | null;
  sharedCtaProps: LandingPageSharedCtaProps;
  isRefreshing: boolean;
  hasRefreshError: boolean;
}

export const LandingPageCalendarContext =
  createContext<LandingPageCalendarContextValue | null>(null);

export function useLandingPageCalendarContext(): LandingPageCalendarContextValue | null {
  return useContext(LandingPageCalendarContext);
}

export interface LandingPageRehydrateRootProps {
  locale: Locale;
  slug: string;
  siteContent: SiteContent;
  pageContent: LandingPageLocaleContent;
  initialHero: LandingPageHeroEventContent | null;
  initialBooking: LandingPageBookingEventContent | null;
  initialStructuredData: LandingPageStructuredDataContent | null;
  thankYouWhatsappHref?: string;
  children: ReactNode;
}

export function LandingPageRehydrateRoot({
  locale,
  slug,
  siteContent,
  pageContent,
  initialHero,
  initialBooking,
  initialStructuredData,
  thankYouWhatsappHref,
  children,
}: LandingPageRehydrateRootProps) {
  const {
    heroEventContent,
    bookingEventContent,
    structuredDataContent,
    isRefreshing,
    hasRefreshError,
  } = useLandingPageCalendar({
    slug,
    locale,
    initialHero,
    initialBooking,
    initialStructuredData,
  });

  const sharedCtaProps = useMemo(
    () =>
      buildLandingPageSharedCtaPropsFromCalendar(
        locale,
        slug,
        pageContent.cta,
        siteContent,
        pageContent.meta.title,
        heroEventContent,
        bookingEventContent,
        thankYouWhatsappHref,
      ),
    [
      locale,
      slug,
      pageContent.cta,
      pageContent.meta.title,
      siteContent,
      heroEventContent,
      bookingEventContent,
      thankYouWhatsappHref,
    ],
  );

  const value = useMemo<LandingPageCalendarContextValue>(
    () => ({
      heroEventContent,
      bookingEventContent,
      structuredDataContent,
      sharedCtaProps,
      isRefreshing,
      hasRefreshError,
    }),
    [
      heroEventContent,
      bookingEventContent,
      structuredDataContent,
      sharedCtaProps,
      isRefreshing,
      hasRefreshError,
    ],
  );

  return (
    <LandingPageCalendarContext.Provider value={value}>
      {children}
    </LandingPageCalendarContext.Provider>
  );
}
