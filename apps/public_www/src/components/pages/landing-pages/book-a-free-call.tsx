import type {
  Locale,
  LandingPageLocaleContent,
  SiteContent,
} from '@/content';
import { LandingPage } from '@/components/pages/landing-pages/landing-page';
import { LandingPageFreeIntroCall } from '@/components/sections/landing-pages/landing-page-free-intro-call';
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

  const heroAnchorHref = pageContent.hero.ctaAnchorHref?.trim();
  const heroAnchorLabel = pageContent.hero.ctaAnchorLabel?.trim();
  if (!heroAnchorHref || !heroAnchorLabel) {
    throw new Error(
      'book-a-free-call landing page requires hero.ctaAnchorHref and hero.ctaAnchorLabel',
    );
  }

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
      inlineCalendarFallbackAnchorHref={heroAnchorHref}
      inlineCalendarFallbackAnchorLabel={heroAnchorLabel}
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
