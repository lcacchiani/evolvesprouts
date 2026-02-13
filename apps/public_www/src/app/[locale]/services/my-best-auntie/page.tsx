import { MyBestAuntie } from '@/components/my-best-auntie';
import {
  getFooterLinkLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

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
  const description = content.myBestAuntieBooking.description;

  return buildLocalizedMetadata({
    locale,
    path: '/services/my-best-auntie',
    title,
    description,
  });
}

export default async function MyBestAuntiePage({
  params,
}: MyBestAuntiePageProps) {
  const { locale, content } = await resolveLocalePageContext(params);

  return <MyBestAuntie locale={locale} content={content} />;
}
