import type {
  Locale,
  LandingPageLocaleContent,
  SiteContent,
} from '@/content';
import { LandingPage } from '@/components/pages/landing-pages/landing-page';
import { LandingPageFreeIntroCall } from '@/components/sections/landing-pages/landing-page-free-intro-call';
import { localizePath } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';
import { resolvePublicSiteConfig } from '@/lib/site-config';

export interface BookFreeCallLandingPageProps {
  locale: Locale;
  pagePath: string;
  siteContent: SiteContent;
  pageContent: LandingPageLocaleContent;
}

export function BookFreeCallLandingPage({
  locale,
  pagePath,
  siteContent,
  pageContent,
}: BookFreeCallLandingPageProps) {
  const { whatsappUrl } = resolvePublicSiteConfig();
  const whatsappHref =
    whatsappUrl?.trim() || siteContent.whatsappContact.href.trim();

  const introCall = pageContent.introCall;
  if (!introCall) {
    throw new Error('book-a-free-call landing page requires introCall content');
  }

  const inlineCalendarFallbackHref =
    `${localizePath(ROUTES.bookFreeCall, locale)}#intro-call-booking`;
  const inlineCalendarFallbackLabel =
    pageContent.hero.ctaAnchorLabel?.trim()
    || siteContent.landingPages.common.defaultCtaLabel;

  return (
    <LandingPage
      locale={locale}
      slug='book-a-free-call'
      pagePath={pagePath}
      siteContent={siteContent}
      pageContent={pageContent}
      heroEventContent={null}
      bookingEventContent={null}
      structuredDataContent={null}
      layoutVariant='book-free-call'
      inlineCalendarFallbackAnchorHref={inlineCalendarFallbackHref}
      inlineCalendarFallbackAnchorLabel={inlineCalendarFallbackLabel}
      introCallSectionBeforeCta={(
        <LandingPageFreeIntroCall
          locale={locale}
          pageTitle={pageContent.meta.title}
          introContent={introCall}
          paymentModalContent={siteContent.bookingModal.paymentModal}
          commonAccessibility={siteContent.common.accessibility}
          captchaContent={siteContent.common.captcha}
          whatsappHref={whatsappHref}
        />
      )}
    />
  );
}
