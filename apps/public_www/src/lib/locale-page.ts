import { notFound } from 'next/navigation';

import {
  getContent,
  isValidLocale,
  SUPPORTED_LOCALES,
  type Locale,
  type SiteContent,
} from '@/content';
import { buildLocalizedMetadata } from '@/lib/seo';

export type LocaleRouteParams = Promise<{ locale: string }>;

export interface LocaleRouteProps {
  params: LocaleRouteParams;
}

export interface LocalePageContext {
  locale: Locale;
  content: SiteContent;
}

export async function resolveLocalePageContext(
  params: LocaleRouteParams,
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

export async function resolveLocaleFromParams(
  params: LocaleRouteParams,
): Promise<Locale> {
  const { locale } = await resolveLocalePageContext(params);
  return locale;
}

export function generateLocaleStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
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

type LinkLabelResolver = (
  content: SiteContent,
  href: string,
  fallbackLabel: string,
) => string;

interface PlaceholderPageOptions {
  path: string;
  fallbackTitle: string;
  labelResolver: LinkLabelResolver;
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

export async function resolvePlaceholderPageTitle(
  params: LocaleRouteParams,
  { path, fallbackTitle, labelResolver }: PlaceholderPageOptions,
): Promise<string> {
  const { content } = await resolveLocalePageContext(params);
  return labelResolver(content, path, fallbackTitle);
}

export async function buildPlaceholderMetadataFromParams(
  params: LocaleRouteParams,
  { path, fallbackTitle, labelResolver }: PlaceholderPageOptions,
) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = labelResolver(content, path, fallbackTitle);

  return buildPlaceholderPageMetadata({
    locale,
    path,
    title,
  });
}
