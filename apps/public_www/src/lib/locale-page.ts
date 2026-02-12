import { notFound } from 'next/navigation';

import {
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
  if (!isValidLocale(locale)) {
    notFound();
  }

  return {
    locale,
    content: getContent(locale),
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

export function getFooterLinkLabel(
  content: SiteContent,
  href: string,
  fallbackLabel: string,
): string {
  const sections = [
    content.footer.quickLinks.items,
    content.footer.services.items,
    content.footer.aboutUs.items,
    content.footer.connectOn.items,
  ];

  for (const items of sections) {
    const match = items.find((item) => item.href === href);
    if (match?.label) {
      return match.label;
    }
  }

  return fallbackLabel;
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
