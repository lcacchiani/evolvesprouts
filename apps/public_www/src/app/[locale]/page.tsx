import { HomePageSections } from '@/components/home-page-sections';
import {
  generateLocaleStaticParams,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export async function generateMetadata({
  params,
}: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.home,
    title: content.navbar.brand,
    description: content.hero.subheadline,
  });
}

export default async function HomePage({
  params,
}: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return <HomePageSections content={content} />;
}
