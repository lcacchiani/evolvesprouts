import { getContent, DEFAULT_LOCALE } from '@/content';
import { HomePageSections } from '@/components/home-page-sections';

/**
 * Root page — renders the default locale (English) homepage.
 * Locale-specific pages are at /en/, /zh-CN/, /zh-HK/.
 */
export default function RootPage() {
  const content = getContent(DEFAULT_LOCALE);

  return <HomePageSections content={content} />;
}
