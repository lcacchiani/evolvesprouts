import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getContent,
  isValidLocale,
  type Locale,
} from '@/content';
import { HomePageSections } from '@/components/home-page-sections';
import { buildLocalizedMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale: Locale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const content = getContent(validLocale);

  return buildLocalizedMetadata({
    locale: validLocale,
    path: '/',
    title: content.navbar.brand,
    description: content.hero.subheadline,
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale: Locale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const content = getContent(validLocale);

  return <HomePageSections content={content} />;
}
