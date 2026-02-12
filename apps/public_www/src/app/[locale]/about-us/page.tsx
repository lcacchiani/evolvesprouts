import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderPageMetadata,
  getMenuLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface AboutUsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutUsPageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/about-us', 'About Us');

  return buildPlaceholderPageMetadata({
    locale,
    path: '/about-us',
    title,
  });
}

export default async function AboutUsPage({ params }: AboutUsPageProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/about-us', 'About Us');

  return <EmptyPagePlaceholder title={title} />;
}
