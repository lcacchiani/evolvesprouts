import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getContent,
  isValidLocale,
} from '@/content';
import { HomePageSections } from '@/components/home-page-sections';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const content = getContent(validLocale);

  return <HomePageSections content={content} />;
}
