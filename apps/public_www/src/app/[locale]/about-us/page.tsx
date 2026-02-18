import { AboutUs } from '@/components/pages/about-us';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, ROUTES.about, 'About Us');
  const description = content.ida.subtitle;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.about,
    title,
    description,
  });
}

export default async function AboutUsPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return <AboutUs content={content} />;
}
