import type { ReactNode } from 'react';

import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getContent,
  isValidLocale,
} from '@/content';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const content = getContent(validLocale);

  return {
    title: content.navbar.brand,
    alternates: {
      languages: Object.fromEntries(
        SUPPORTED_LOCALES.map((loc) => [loc, `/${loc}`]),
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const content = getContent(validLocale);
  const direction = content.meta.direction ?? 'ltr';

  return (
    <div lang={validLocale} dir={direction}>
      {children}
    </div>
  );
}
