import { AboutUs } from '@/components/about-us';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/about-us', 'About Us');
  const description = content.ida.subtitle;

  return buildLocalizedMetadata({
    locale,
    path: '/about-us',
    title,
    description,
  });
}

export default async function AboutUsPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return <AboutUs content={content} />;
}
