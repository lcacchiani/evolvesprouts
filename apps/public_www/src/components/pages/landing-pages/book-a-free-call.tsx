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
      introCallSectionBeforeCta={(
        <LandingPageFreeIntroCall
          locale={locale}
          pageTitle={pageContent.meta.title}
          introContent={pageContent.introCall}
          paymentModalContent={siteContent.bookingModal.paymentModal}
          commonAccessibility={siteContent.common.accessibility}
          captchaContent={siteContent.common.captcha}
          whatsappHref={whatsappUrl}
        />
      )}
    />
  );
}
