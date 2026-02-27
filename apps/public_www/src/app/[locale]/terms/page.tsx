import { TermsAndConditionsPageSections } from '@/components/pages/terms-and-conditions';
import {
  generateLocaleStaticParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';

export { generateLocaleStaticParams as generateStaticParams };

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = content.termsAndConditions.title || getFooterLinkLabel(
    content,
    ROUTES.terms,
    'Terms and Conditions',
  );

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.terms,
    title,
    description: content.termsAndConditions.intro,
    socialImage: {
      url: content.seo.socialImages.home.url,
      alt: content.seo.socialImages.home.alt,
    },
  });
}

export default async function TermsPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);
  return <TermsAndConditionsPageSections content={content} />;
}
