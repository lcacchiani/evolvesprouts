import type {
  Locale,
  LandingPageLocaleContent,
  SiteContent,
} from '@/content';
import { LandingPageClient } from '@/components/pages/landing-pages/landing-page-client';
import type {
  LandingPageBookingEventContent,
  LandingPageHeroEventContent,
  LandingPageStructuredDataContent,
} from '@/lib/events-data';

export interface LandingPageProps {
  locale: Locale;
  slug: string;
  pagePath: string;
  siteContent: SiteContent;
  pageContent: LandingPageLocaleContent;
  heroEventContent: LandingPageHeroEventContent | null;
  bookingEventContent: LandingPageBookingEventContent | null;
  structuredDataContent: LandingPageStructuredDataContent | null;
}

export function LandingPage({
  locale,
  slug,
  pagePath,
  siteContent,
  pageContent,
  heroEventContent,
  bookingEventContent,
  structuredDataContent,
}: LandingPageProps) {
  return (
    <LandingPageClient
      key={`${slug}-${locale}`}
      locale={locale}
      slug={slug}
      pagePath={pagePath}
      siteContent={siteContent}
      pageContent={pageContent}
      initialHero={heroEventContent}
      initialBooking={bookingEventContent}
      initialStructuredData={structuredDataContent}
    />
  );
}
