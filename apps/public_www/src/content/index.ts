import enContent from './en.json';
import zhCNContent from './zh-CN.json';
import zhHKContent from './zh-HK.json';

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
export type SiteContent = typeof enContent;

/**
 * Narrow types for individual sections.
 */
export type NavbarContent = SiteContent['navbar'];
export type HeroContent = SiteContent['hero'];
export type CourseModuleContent = SiteContent['courseModule'];
export type FreeResourcesContent = SiteContent['freeResources'];
export type WhyJoiningContent = SiteContent['whyJoining'];
export type RealStoriesContent = SiteContent['realStories'];
export type FooterContent = SiteContent['footer'];

const contentMap: Record<Locale, SiteContent> = {
  en: enContent,
  'zh-CN': zhCNContent as SiteContent,
  'zh-HK': zhHKContent as SiteContent,
};

/**
 * Returns the full content object for a given locale.
 * Falls back to English if the locale is not found.
 */
export function getContent(locale: string): SiteContent {
  const key = locale as Locale;
  return contentMap[key] ?? contentMap[DEFAULT_LOCALE];
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
