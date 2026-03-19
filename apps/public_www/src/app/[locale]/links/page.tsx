import { LinksPage } from '@/components/pages/links';
import {
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.links,
    title: content.links.seo.title,
    description: content.links.seo.description,
    robots: {
      index: false,
      follow: true,
    },
  });
}

export default async function LinksPage({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);

  return <LinksPage locale={locale} content={content} />;
}
