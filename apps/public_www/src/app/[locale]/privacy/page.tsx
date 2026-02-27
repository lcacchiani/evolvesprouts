import { PrivacyPolicyPageSections } from '@/components/pages/privacy-policy';
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
  const title = content.privacyPolicy.title || getFooterLinkLabel(
    content,
    ROUTES.privacy,
    'Privacy Policy',
  );

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.privacy,
    title,
    description: content.privacyPolicy.intro,
    socialImage: {
      url: content.seo.socialImages.home.url,
      alt: content.seo.socialImages.home.alt,
    },
  });
}

export default async function PrivacyPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);
  return <PrivacyPolicyPageSections content={content} />;
}
