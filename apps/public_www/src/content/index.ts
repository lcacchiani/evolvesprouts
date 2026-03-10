import enContent from './en.json';
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
type LegacyCompatibleTestimonials = Omit<BaseSiteContent['testimonials'], 'items'> & {
  items: Array<BaseSiteContent['testimonials']['items'][number] & { role?: string }>;
};
export type SiteContent = Omit<BaseSiteContent, 'testimonials'> & {
  testimonials: LegacyCompatibleTestimonials;
};

/**
 * Narrow types for individual sections.
 */
export type NavbarContent = SiteContent['navbar'];
export type HeroContent = SiteContent['hero'];
export type IdaIntroContent = SiteContent['idaIntro'];
export type MyBestAuntieHeroContent = SiteContent['myBestAuntieHero'];
export type MyBestAuntieOverviewContent = SiteContent['myBestAuntieOverview'];
export type MyBestAuntieBookingContent = SiteContent['myBestAuntieBooking'];
export type MyBestAuntieDescriptionContent =
  SiteContent['myBestAuntieDescription'];
export type ResourcesContent = SiteContent['resources'];
export type CourseHighlightsContent = SiteContent['courseHighlights'];
export type RealTalkContent = SiteContent['realTalk'];
export type TestimonialsContent = SiteContent['testimonials'];
export type ContactUsContent = SiteContent['contactUs'];
export type EventsContent = SiteContent['events'];
export type IdaContent = SiteContent['ida'];
export type MyHistoryContent = SiteContent['myHistory'];
export type MyJourneyContent = SiteContent['myJourney'];
export type WhyUsContent = SiteContent['whyUs'];
export type FaqContent = SiteContent['faq'];
export type SproutsSquadCommunityContent =
  SiteContent['sproutsSquadCommunity'];
export type FreeIntroSessionContent =
  SiteContent['freeIntroSession'];
export type FooterContent = SiteContent['footer'];

const contentMap = {
  en: enContent,
  'zh-CN': zhCNContent,
  'zh-HK': zhHKContent,
} satisfies Record<Locale, SiteContent>;

const interpolatedContentCache = new Map<string, SiteContent>();
const WHATSAPP_URL_PLACEHOLDER = '{{WHATSAPP_URL}}';
const BUSINESS_PHONE_PLACEHOLDER = '{{BUSINESS_PHONE_NUMBER}}';

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
  const baseNavbarCtaHref = configuredNavbarHref
    || content.whatsappContact.href
    || ROUTES.servicesMyBestAuntieTrainingCourse;
  const navbarCtaHref = buildWhatsappPrefilledHref(
    baseNavbarCtaHref,
    content.navbar.bookNow.prefillMessage,
    configuredNavbarPhoneNumber,
  ) || baseNavbarCtaHref;
  const resolvedContactEmail = contactEmail?.trim() || undefined;
  const contactUsContent = resolvedContactEmail
    ? {
        ...content.contactUs,
        contactUsForm: {
          ...content.contactUs.contactUsForm,
          emailAddress: resolvedContactEmail,
        },
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

  const sanitizedNavbarPhoneNumber =
    navbarPhoneNumber === BUSINESS_PHONE_PLACEHOLDER ? '' : navbarPhoneNumber;

  const sanitizedNavbarHref =
    navbarCtaHref === WHATSAPP_URL_PLACEHOLDER
      ? ROUTES.servicesMyBestAuntieTrainingCourse
      : navbarCtaHref;

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
    return withConfiguredRuntimeContent(locale, contentMap[locale]);
  }

  return withConfiguredRuntimeContent(DEFAULT_LOCALE, contentMap[DEFAULT_LOCALE]);
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
