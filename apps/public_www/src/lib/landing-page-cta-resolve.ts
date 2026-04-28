import type { LandingPageSharedCtaProps } from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import type {
  LandingPageBookingEventContent,
  LandingPageHeroEventContent,
} from '@/lib/events-data';
import type { LandingPageLocaleContent, Locale, SiteContent } from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import { buildWhatsappPrefilledHref } from '@/lib/site-config';

export function resolveLandingPageCtaEyebrow(
  eyebrowTemplate: string | undefined,
  spotsLeft: number | undefined,
  dateLabel: string | undefined,
): string | undefined {
  const normalizedTemplate = eyebrowTemplate?.trim();
  if (!normalizedTemplate) {
    return undefined;
  }

  if (typeof spotsLeft === 'number' && Number.isFinite(spotsLeft) && spotsLeft <= 0) {
    return '';
  }

  const hasNumericSpotsLeft = typeof spotsLeft === 'number' && Number.isFinite(spotsLeft);
  if (!hasNumericSpotsLeft || !dateLabel?.trim()) {
    return normalizedTemplate;
  }

  const normalizedSpotsLeft = Math.max(0, Math.trunc(spotsLeft));

  const resolvedEyebrow = formatContentTemplate(normalizedTemplate, {
    spotsLeft: normalizedSpotsLeft,
    date: dateLabel.trim(),
  }).trim();

  return resolvedEyebrow || undefined;
}

export function resolveFullyBookedWaitlistHref(
  isFullyBooked: boolean,
  baseWhatsappHref: string | undefined,
  phoneNumber: string | undefined,
  messageTemplate: string | undefined,
  eventTitle: string,
): string | undefined {
  if (!isFullyBooked) {
    return undefined;
  }

  const normalizedMessageTemplate = messageTemplate?.trim() ?? '';
  if (!normalizedMessageTemplate) {
    return undefined;
  }

  const resolvedMessage = formatContentTemplate(normalizedMessageTemplate, {
    eventTitle,
  }).trim();
  if (!resolvedMessage) {
    return undefined;
  }

  const whatsappHref = buildWhatsappPrefilledHref(baseWhatsappHref, resolvedMessage, phoneNumber);
  return whatsappHref || undefined;
}

export function buildLandingPageSharedCtaPropsFromCalendar(
  locale: Locale,
  slug: string,
  pageContentCta: LandingPageLocaleContent['cta'],
  siteContent: SiteContent,
  heroTitleFallback: string,
  heroEventContent: LandingPageHeroEventContent | null,
  bookingEventContent: LandingPageBookingEventContent | null,
  thankYouWhatsappHref: string | undefined,
): LandingPageSharedCtaProps {
  const isFullyBooked = bookingEventContent?.status === 'fully_booked';
  const waitlistEventTitle = heroEventContent?.title ?? heroTitleFallback;
  const fullyBookedWaitlistHref = resolveFullyBookedWaitlistHref(
    isFullyBooked,
    siteContent.navbar.bookNow.href,
    siteContent.navbar.bookNow.phoneNumber,
    pageContentCta.fullyBookedWaitlistMessageTemplate,
    waitlistEventTitle,
  );
  return {
    locale,
    slug,
    content: pageContentCta,
    ctaPriceLabel: bookingEventContent?.ctaPriceLabel,
    commonContent: siteContent.landingPages.common,
    bookingPayload: bookingEventContent?.bookingPayload ?? null,
    isFullyBooked,
    fullyBookedCtaLabel: pageContentCta.fullyBookedButtonLabel,
    fullyBookedWaitlistHref,
    bookingModalContent: siteContent.bookingModal,
    thankYouWhatsappHref,
    thankYouWhatsappCtaLabel: siteContent.contactUs.form.contactMethodLinks.whatsapp,
  };
}
