import { TermsAndConditionsPage } from '@/components/pages/terms-and-conditions';
import {
  generateLocaleStaticParams,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { resolvePolicyDescription } from '@/content/copy-normalizers';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';

export { generateLocaleStaticParams as generateStaticParams };

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const description = resolvePolicyDescription(content.termsAndConditions);
  const title = content.termsAndConditions.title;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.terms,
    title,
    description,
    socialImage: {
      url: content.seo.socialImages.home.url,
      alt: content.seo.socialImages.home.alt,
    },
  });
}

export default async function TermsRoutePage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);
  return <TermsAndConditionsPage content={content} />;
}
