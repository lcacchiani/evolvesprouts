import { AboutUs } from '@/components/about-us';
import {
  getMenuLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

interface AboutUsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutUsPageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/about-us', 'About Us');
  const description = content.ida.subtitle;

  return buildLocalizedMetadata({
    locale,
    path: '/about-us',
    title,
    description,
  });
}

export default async function AboutUsPage({ params }: AboutUsPageProps) {
  const { content } = await resolveLocalePageContext(params);

  return <AboutUs content={content} />;
}
