import { SUPPORTED_LOCALES } from '@/content';
import { HomePageSections } from '@/components/home-page-sections';
import { resolveLocalePageContext } from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, content } = await resolveLocalePageContext(params);

  return buildLocalizedMetadata({
    locale,
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
  const { content } = await resolveLocalePageContext(params);

  return <HomePageSections content={content} />;
}
