import { notFound, redirect } from 'next/navigation';

import {
  DEFAULT_LOCALE,
  getContent,
  isValidLocale,
  SUPPORTED_LOCALES,
  type Locale,
  type SiteContent,
} from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import enContent from '@/content/en.json';
import { localizePath } from '@/lib/locale-routing';
import { buildLocalizedMetadata } from '@/lib/seo';

function getDefaultSiteContent(): SiteContent {
  return enContent as SiteContent;
}

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
  fallbackLabel = '',
): string {
  const match = content.navbar.menuItems.find((item) => item.href === href);
  if (match?.label) {
    return match.label;
  }

  const defaultMatch = getDefaultSiteContent().navbar.menuItems.find((item) => item.href === href);
  return defaultMatch?.label ?? fallbackLabel;
}

export function getFooterLinkLabel(
  content: SiteContent,
  href: string,
  fallbackLabel = '',
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

  const defaultContent = getDefaultSiteContent();
  const defaultSections = [
    defaultContent.footer.quickLinks.items,
    defaultContent.footer.services.items,
    defaultContent.footer.aboutUs.items,
    defaultContent.footer.connectOn.items,
  ];

  for (const items of defaultSections) {
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
  content: SiteContent;
}

type LinkLabelResolver = (
  content: SiteContent,
  href: string,
  fallbackLabel: string,
) => string;

interface PlaceholderPageOptions {
  path: string;
  fallbackTitle: string | ((content: SiteContent) => string);
  labelResolver: LinkLabelResolver;
}

type LocaleAliasTarget = string | ((locale: Locale) => string);

export function buildPlaceholderPageMetadata({
  locale,
  path,
  title,
  content,
}: PlaceholderMetadataOptions) {
  return buildLocalizedMetadata({
    locale,
    path,
    title,
    description: formatContentTemplate(content.common.placeholder.descriptionTemplate, {
      title,
      brand: content.navbar.brand,
    }),
    robots: {
      index: false,
      follow: true,
    },
  });
}

export async function resolvePlaceholderPageTitle(
  params: LocaleRouteParams,
  { path, fallbackTitle, labelResolver }: PlaceholderPageOptions,
): Promise<string> {
  const { content } = await resolveLocalePageContext(params);
  const resolvedFallbackTitle =
    typeof fallbackTitle === 'function' ? fallbackTitle(content) : fallbackTitle;
  return labelResolver(content, path, resolvedFallbackTitle);
}

export async function buildPlaceholderMetadataFromParams(
  params: LocaleRouteParams,
  { path, fallbackTitle, labelResolver }: PlaceholderPageOptions,
) {
  const { locale, content } = await resolveLocalePageContext(params);
  const resolvedFallbackTitle =
    typeof fallbackTitle === 'function' ? fallbackTitle(content) : fallbackTitle;
  const title = labelResolver(content, path, resolvedFallbackTitle);

  return buildPlaceholderPageMetadata({
    locale,
    path,
    title,
    content,
  });
}

function resolveLocaleAliasTarget(
  locale: Locale,
  target: LocaleAliasTarget,
): string {
  if (typeof target === 'function') {
    return target(locale);
  }

  return localizePath(target, locale);
}

export function createRootRedirectPage(targetPath: string) {
  return function RootRedirectPage() {
    redirect(targetPath);
  };
}

export function createDefaultLocaleRedirectPage(targetPath: string) {
  return createRootRedirectPage(localizePath(targetPath, DEFAULT_LOCALE));
}

export function createLocaleAliasRedirectPage(target: LocaleAliasTarget) {
  return async function LocaleAliasRedirectPage({ params }: LocaleRouteProps) {
    const locale = await resolveLocaleFromParams(params);
    redirect(resolveLocaleAliasTarget(locale, target));
  };
}

export function createPlaceholderPage(options: PlaceholderPageOptions) {
  async function generateMetadata({ params }: LocaleRouteProps) {
    return buildPlaceholderMetadataFromParams(params, options);
  }

  async function resolveProps(params: LocaleRouteParams) {
    const { content } = await resolveLocalePageContext(params);
    const fallbackTitle =
      typeof options.fallbackTitle === 'function'
        ? options.fallbackTitle(content)
        : options.fallbackTitle;
    const title = options.labelResolver(
      content,
      options.path,
      fallbackTitle,
    );

    return { content, title };
  }

  return {
    generateMetadata,
    resolveProps,
  };
}
