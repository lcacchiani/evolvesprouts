import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderPageMetadata,
  getFooterLinkLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface MyBestAuntiePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: MyBestAuntiePageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(
    content,
    '/services/my-best-auntie',
    'My Best Auntie',
  );

  return buildPlaceholderPageMetadata({
    locale,
    path: '/services/my-best-auntie',
    title,
  });
}

export default async function MyBestAuntiePage({
  params,
}: MyBestAuntiePageProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(
    content,
    '/services/my-best-auntie',
    'My Best Auntie',
  );

  return <EmptyPagePlaceholder title={title} />;
}
