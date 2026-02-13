import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderMetadataFromParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
  resolvePlaceholderPageTitle,
} from '@/lib/locale-page';

const NEWSLETTER_PLACEHOLDER_OPTIONS = {
  path: '/newsletter',
  fallbackTitle: 'Newsletter',
  labelResolver: getFooterLinkLabel,
} as const;

export async function generateMetadata({ params }: LocaleRouteProps) {
  return buildPlaceholderMetadataFromParams(
    params,
    NEWSLETTER_PLACEHOLDER_OPTIONS,
  );
}

export default async function NewsletterPage({ params }: LocaleRouteProps) {
  const title = await resolvePlaceholderPageTitle(
    params,
    NEWSLETTER_PLACEHOLDER_OPTIONS,
  );

  return <EmptyPagePlaceholder title={title} />;
}
