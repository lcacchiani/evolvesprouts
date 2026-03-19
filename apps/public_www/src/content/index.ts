import enContent from './en.json';
import myBestAuntieTrainingCourseContent from './my-best-auntie-training-courses.json';
import zhCNContent from './zh-CN.json';
import zhHKContent from './zh-HK.json';
import { ROUTES } from '@/lib/routes';
import {
  buildWhatsappPrefilledHref,
  resolvePublicSiteConfig,
} from '@/lib/site-config';

/**
 * Supported locales. Add new locales here and provide a matching
 * JSON file in src/content/.
 */
export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-HK'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Site content type — derived from the English JSON (source of truth).
 * All locale files must conform to this shape.
 */
type BaseSiteContent = typeof enContent;
type CourseCohort = typeof myBestAuntieTrainingCourseContent.data[number];
type LegacyCompatibleTestimonials = Omit<BaseSiteContent['testimonials'], 'items'> & {
  items: Array<BaseSiteContent['testimonials']['items'][number] & { role?: string }>;
};
type SharedCourseBookingContent = BaseSiteContent['myBestAuntie']['booking'] & {
  cohorts: CourseCohort[];
};
export type SiteContent = Omit<BaseSiteContent, 'testimonials' | 'myBestAuntie'> & {
  testimonials: LegacyCompatibleTestimonials;
  myBestAuntie: Omit<BaseSiteContent['myBestAuntie'], 'booking'> & {
    booking: SharedCourseBookingContent;
  };
};

/**
 * Narrow types for individual sections.
 */
export type NavbarContent = SiteContent['navbar'];
export type CommonContent = SiteContent['common'];
export type CommonAccessibilityContent = SiteContent['common']['accessibility'];
export type HeroContent = SiteContent['hero'];
export type AboutUsIntroContent = SiteContent['aboutUs']['intro'];
export type MyBestAuntieHeroContent = SiteContent['myBestAuntie']['hero'];
export type MyBestAuntieOutlineContent = SiteContent['myBestAuntie']['outline'];
export type MyBestAuntieModalContent = SiteContent['myBestAuntie']['modal'];
export type MyBestAuntieBookingContent = SiteContent['myBestAuntie']['booking'];
export type MyBestAuntieDescriptionContent =
  SiteContent['myBestAuntie']['description'];
export type BookingModalContent = SiteContent['bookingModal'];
export type BookingPaymentModalContent = SiteContent['bookingModal']['paymentModal'];
export type BookingThankYouModalContent = SiteContent['bookingModal']['thankYouModal'];
export type ResourcesContent = SiteContent['resources'];
export type CourseHighlightsContent = SiteContent['courseHighlights'];
export type RealTalkContent = SiteContent['realTalk'];
export type TestimonialsContent = SiteContent['testimonials'];
export type ContactUsContent = SiteContent['contactUs'];
export type EventsContent = SiteContent['events'];
export type AboutUsHeroContent = SiteContent['aboutUs']['hero'];
export type AboutUsMyHistoryContent = SiteContent['aboutUs']['myHistory'];
export type AboutUsMyJourneyContent = SiteContent['aboutUs']['myJourney'];
export type AboutUsWhyUsContent = SiteContent['aboutUs']['whyUs'];
export type FaqContent = SiteContent['faq'];
export type SproutsSquadCommunityContent =
  SiteContent['sproutsSquadCommunity'];
export type EventNotificationContent =
  SiteContent['events']['notification'];
export type FreeIntroSessionContent =
  SiteContent['freeIntroSession'];
export type FooterContent = SiteContent['footer'];
export type LinksHubContent = SiteContent['links']['hub'];
export type LandingPagesCommonContent = SiteContent['landingPages']['common'];
export type LandingPageCohort = MyBestAuntieBookingContent['cohorts'][number];

export interface LandingPageLocaleContent {
  meta: {
    title: string;
    description: string;
    socialImage: {
      url: string;
      alt: string;
    };
  };
  hero: {
    subtitle: string;
    description: string;
    imageAlt: string;
    imageSrc: string;
  };
  details: {
    eyebrow?: string;
    title: string;
    description: string;
    items: Array<{
      title: string;
      description: string;
    }>;
  };
  faq: {
    title: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
  cta: {
    eyebrow?: string;
    eyebrowShowLogo?: boolean;
    title: string;
    description: string;
    buttonLabel: string;
    buttonLabelTemplate?: string;
    fullyBookedButtonLabel?: string;
    fullyBookedWaitlistMessageTemplate?: string;
  };
}

export interface LandingPageContent {
  en: LandingPageLocaleContent;
  'zh-CN': LandingPageLocaleContent;
  'zh-HK': LandingPageLocaleContent;
}

const contentMap = {
  en: enContent,
  'zh-CN': zhCNContent,
  'zh-HK': zhHKContent,
} satisfies Record<Locale, BaseSiteContent>;

const interpolatedContentCache = new Map<string, SiteContent>();
const WHATSAPP_URL_PLACEHOLDER = '{{WHATSAPP_URL}}';
const BUSINESS_PHONE_PLACEHOLDER = '{{BUSINESS_PHONE_NUMBER}}';

function cloneSharedCourseCohorts(): CourseCohort[] {
  return myBestAuntieTrainingCourseContent.data.map((cohort) => ({
    ...cohort,
    dates: cohort.dates.map((date) => ({
      ...date,
    })),
  }));
}

function withSharedCourseContent(content: BaseSiteContent): SiteContent {
  return {
    ...content,
    myBestAuntie: {
      ...content.myBestAuntie,
      booking: {
        ...content.myBestAuntie.booking,
        cohorts: cloneSharedCourseCohorts(),
      },
    },
  };
}

function resolveContactEmail(): string | undefined {
  try {
    return resolvePublicSiteConfig().contactEmail;
  } catch {
    return undefined;
  }
}

function resolveConfiguredWhatsappUrl(): string | undefined {
  const configuredValue = process.env.NEXT_PUBLIC_WHATSAPP_URL;
  if (typeof configuredValue !== 'string') {
    return undefined;
  }

  const normalizedValue = buildWhatsappPrefilledHref(configuredValue, undefined);
  return normalizedValue || undefined;
}

function resolveConfiguredBusinessPhoneNumber(): string | undefined {
  const configuredValue = process.env.NEXT_PUBLIC_BUSINESS_PHONE_NUMBER;
  if (typeof configuredValue !== 'string') {
    return undefined;
  }

  const normalizedValue = configuredValue.trim();
  return normalizedValue === '' ? undefined : normalizedValue;
}

function resolvePlaceholderValue(
  value: string | undefined,
  placeholder: string,
  replacement: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue !== placeholder) {
    return normalizedValue;
  }

  const normalizedReplacement = replacement?.trim();
  return normalizedReplacement || undefined;
}

function withConfiguredRuntimeContent(
  locale: Locale,
  content: SiteContent,
): SiteContent {
  const contactEmail = resolveContactEmail();
  const configuredWhatsappUrl = resolveConfiguredWhatsappUrl();
  const configuredBusinessPhoneNumber = resolveConfiguredBusinessPhoneNumber();
  const cacheKey = [
    locale,
    contactEmail ?? '',
    configuredWhatsappUrl ?? '',
    configuredBusinessPhoneNumber ?? '',
  ].join('|');
  const cached = interpolatedContentCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const configuredNavbarHref = resolvePlaceholderValue(
    content.navbar.bookNow.href,
    WHATSAPP_URL_PLACEHOLDER,
    configuredWhatsappUrl,
  );
  const configuredNavbarPhoneNumber = resolvePlaceholderValue(
    content.navbar.bookNow.phoneNumber,
    BUSINESS_PHONE_PLACEHOLDER,
    configuredBusinessPhoneNumber,
  );
  const configuredFreeIntroSessionHref = resolvePlaceholderValue(
    content.freeIntroSession.ctaHref,
    WHATSAPP_URL_PLACEHOLDER,
    configuredWhatsappUrl,
  );
  const configuredFreeIntroSessionPhoneNumber = resolvePlaceholderValue(
    content.freeIntroSession.phoneNumber,
    BUSINESS_PHONE_PLACEHOLDER,
    configuredBusinessPhoneNumber,
  );
  const baseNavbarCtaHref = configuredNavbarHref
    || content.whatsappContact.href
    || ROUTES.servicesMyBestAuntieTrainingCourse;
  const baseFreeIntroSessionCtaHref = configuredFreeIntroSessionHref
    || content.whatsappContact.href
    || ROUTES.servicesMyBestAuntieTrainingCourse;
  const navbarCtaHref = buildWhatsappPrefilledHref(
    baseNavbarCtaHref,
    content.navbar.bookNow.prefillMessage,
    configuredNavbarPhoneNumber,
  ) || baseNavbarCtaHref;
  const freeIntroSessionCtaHref = buildWhatsappPrefilledHref(
    baseFreeIntroSessionCtaHref,
    content.freeIntroSession.prefillMessage,
    configuredFreeIntroSessionPhoneNumber,
  ) || baseFreeIntroSessionCtaHref;
  const resolvedContactEmail = contactEmail?.trim() || undefined;
  const contactUsContent = resolvedContactEmail
    ? {
        ...content.contactUs,
        connect: {
          ...content.contactUs.connect,
          cards: content.contactUs.connect.cards.map((card, index) =>
            index === 0
              ? {
                  ...card,
                  ctaLabel: resolvedContactEmail,
                  ctaHref: `mailto:${resolvedContactEmail}`,
                }
              : card,
          ),
        },
      }
    : content.contactUs;

  const rawNavbarPhoneNumber = content.navbar.bookNow.phoneNumber.trim();
  const navbarPhoneNumber = configuredNavbarPhoneNumber || rawNavbarPhoneNumber;
  const rawFreeIntroSessionPhoneNumber = content.freeIntroSession.phoneNumber.trim();
  const freeIntroSessionPhoneNumber =
    configuredFreeIntroSessionPhoneNumber || rawFreeIntroSessionPhoneNumber;

  const sanitizedNavbarPhoneNumber =
    navbarPhoneNumber === BUSINESS_PHONE_PLACEHOLDER ? '' : navbarPhoneNumber;
  const sanitizedFreeIntroSessionPhoneNumber =
    freeIntroSessionPhoneNumber === BUSINESS_PHONE_PLACEHOLDER
      ? ''
      : freeIntroSessionPhoneNumber;

  const sanitizedNavbarHref =
    navbarCtaHref === WHATSAPP_URL_PLACEHOLDER
      ? ROUTES.servicesMyBestAuntieTrainingCourse
      : navbarCtaHref;
  const sanitizedFreeIntroSessionHref =
    freeIntroSessionCtaHref === WHATSAPP_URL_PLACEHOLDER
      ? ROUTES.servicesMyBestAuntieTrainingCourse
      : freeIntroSessionCtaHref;

  const interpolated: SiteContent = {
    ...content,
    navbar: {
      ...content.navbar,
      bookNow: {
        ...content.navbar.bookNow,
        href: sanitizedNavbarHref,
        phoneNumber: sanitizedNavbarPhoneNumber,
      },
    },
    freeIntroSession: {
      ...content.freeIntroSession,
      ctaHref: sanitizedFreeIntroSessionHref,
      phoneNumber: sanitizedFreeIntroSessionPhoneNumber,
    },
    contactUs: contactUsContent,
  };

  interpolatedContentCache.set(cacheKey, interpolated);
  return interpolated;
}

/**
 * Returns the full content object for a given locale.
 * Falls back to English if the locale is not found.
 */
export function getContent(locale: string): SiteContent {
  if (isValidLocale(locale)) {
    return withConfiguredRuntimeContent(
      locale,
      withSharedCourseContent(contentMap[locale]),
    );
  }

  return withConfiguredRuntimeContent(
    DEFAULT_LOCALE,
    withSharedCourseContent(contentMap[DEFAULT_LOCALE]),
  );
}

/**
 * Returns a specific section's content for a given locale.
 */
export function getSectionContent<K extends keyof SiteContent>(
  locale: string,
  section: K,
): SiteContent[K] {
  return getContent(locale)[section];
}

/**
 * Type guard to check if a string is a supported locale.
 */
export function isValidLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
