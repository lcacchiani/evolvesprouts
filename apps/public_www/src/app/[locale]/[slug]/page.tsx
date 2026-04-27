import { notFound } from 'next/navigation';

import {
  isValidLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/content';
import { LandingPage } from '@/components/pages/landing-pages/landing-page';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  getMenuLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import {
  fetchLandingPageCalendarPayload,
  getLandingPageBookingEventContentFromPayload,
  getLandingPageHeroEventContentFromPayload,
  getLandingPageStructuredDataContentFromPayload,
} from '@/lib/events-data';
import {
  buildLandingPagePath,
  getAllLandingPageSlugs,
  getLandingPageContent,
  isValidLandingPageSlug,
} from '@/lib/landing-pages';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';
import { buildBreadcrumbSchema } from '@/lib/structured-data';

interface LandingPageRouteProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    getAllLandingPageSlugs().map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: LandingPageRouteProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isValidLocale(rawLocale) || !isValidLandingPageSlug(slug)) {
    notFound();
  }

  const locale: Locale = rawLocale;
  const pageContent = getLandingPageContent(slug, locale);
  if (!pageContent) {
    notFound();
  }

  return buildLocalizedMetadata({
    locale,
    path: buildLandingPagePath(slug),
    title: pageContent.meta.title,
    description: pageContent.meta.description,
    socialImage: {
      url: pageContent.meta.socialImage.url,
      alt: pageContent.meta.socialImage.alt,
    },
  });
}

export default async function LandingPageRoute({ params }: LandingPageRouteProps) {
  const resolvedParams = await params;
  const { locale, content: siteContent } = await resolveLocalePageContext(
    Promise.resolve({ locale: resolvedParams.locale }),
  );
  if (!isValidLandingPageSlug(resolvedParams.slug)) {
    notFound();
  }

  const pageContent = getLandingPageContent(resolvedParams.slug, locale);
  if (!pageContent) {
    notFound();
  }

  const pagePath = buildLandingPagePath(resolvedParams.slug);

  const { payload: calendarPayload } = await fetchLandingPageCalendarPayload({
    slug: resolvedParams.slug,
  });

  const heroEventContent = getLandingPageHeroEventContentFromPayload(
    calendarPayload,
    resolvedParams.slug,
  );
  const bookingEventContent = getLandingPageBookingEventContentFromPayload(
    calendarPayload,
    resolvedParams.slug,
    locale,
  );
  const structuredDataContent = getLandingPageStructuredDataContentFromPayload(
    calendarPayload,
    resolvedParams.slug,
  );

  return (
    <>
      <LandingPage
        locale={locale}
        slug={resolvedParams.slug}
        pagePath={pagePath}
        siteContent={siteContent}
        pageContent={pageContent}
        heroEventContent={heroEventContent}
        bookingEventContent={bookingEventContent}
        structuredDataContent={structuredDataContent}
      />
      <StructuredDataScript
        id={`landing-page-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(siteContent, ROUTES.home),
              path: ROUTES.home,
            },
            {
              name: pageContent.meta.title,
              path: pagePath,
            },
          ],
        })}
      />
    </>
  );
}
