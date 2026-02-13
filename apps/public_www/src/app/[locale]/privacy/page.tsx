import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderMetadataFromParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
  resolvePlaceholderPageTitle,
} from '@/lib/locale-page';

const PRIVACY_PLACEHOLDER_OPTIONS = {
  path: '/privacy',
  fallbackTitle: 'Privacy Policy',
  labelResolver: getFooterLinkLabel,
} as const;

export async function generateMetadata({ params }: LocaleRouteProps) {
  return buildPlaceholderMetadataFromParams(params, PRIVACY_PLACEHOLDER_OPTIONS);
}

export default async function PrivacyPage({ params }: LocaleRouteProps) {
  const title = await resolvePlaceholderPageTitle(
    params,
    PRIVACY_PLACEHOLDER_OPTIONS,
  );

  return <EmptyPagePlaceholder title={title} />;
}
