import {
  DEFAULT_LOCALE,
  getContent,
  isValidLocale,
  type Locale,
  type SiteContent,
} from '@/content';
import { buildLocalizedMetadata } from '@/lib/seo';

export interface LocalePageContext {
  locale: Locale;
  content: SiteContent;
}

export async function resolveLocalePageContext(
  params: Promise<{ locale: string }>,
): Promise<LocalePageContext> {
  const { locale } = await params;
  const validLocale: Locale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  return {
    locale: validLocale,
    content: getContent(validLocale),
  };
}

export function getMenuLabel(
  content: SiteContent,
  href: string,
  fallbackLabel: string,
): string {
  const match = content.navbar.menuItems.find((item) => item.href === href);
  return match?.label ?? fallbackLabel;
}

interface PlaceholderMetadataOptions {
  locale: Locale;
  path: string;
  title: string;
}

export function buildPlaceholderPageMetadata({
  locale,
  path,
  title,
}: PlaceholderMetadataOptions) {
  return buildLocalizedMetadata({
    locale,
    path,
    title,
    description: `${title} — Evolve Sprouts`,
  });
}
