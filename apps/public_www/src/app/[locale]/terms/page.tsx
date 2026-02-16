import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderMetadataFromParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
  resolvePlaceholderPageTitle,
} from '@/lib/locale-page';

const TERMS_PLACEHOLDER_OPTIONS = {
  path: '/terms',
  fallbackTitle: 'Terms & Conditions',
  labelResolver: getFooterLinkLabel,
} as const;

export async function generateMetadata({ params }: LocaleRouteProps) {
  return buildPlaceholderMetadataFromParams(params, TERMS_PLACEHOLDER_OPTIONS);
}

export default async function TermsPage({ params }: LocaleRouteProps) {
  const title = await resolvePlaceholderPageTitle(params, TERMS_PLACEHOLDER_OPTIONS);

  return <EmptyPagePlaceholder title={title} />;
}
