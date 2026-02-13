import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderMetadataFromParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
  resolvePlaceholderPageTitle,
} from '@/lib/locale-page';

const WORKSHOPS_PLACEHOLDER_OPTIONS = {
  path: '/services/workshops',
  fallbackTitle: 'Workshops',
  labelResolver: getFooterLinkLabel,
} as const;

export async function generateMetadata({ params }: LocaleRouteProps) {
  return buildPlaceholderMetadataFromParams(params, WORKSHOPS_PLACEHOLDER_OPTIONS);
}

export default async function WorkshopsPage({ params }: LocaleRouteProps) {
  const title = await resolvePlaceholderPageTitle(
    params,
    WORKSHOPS_PLACEHOLDER_OPTIONS,
  );

  return <EmptyPagePlaceholder title={title} />;
}
