import { MyBestAuntie } from '@/components/my-best-auntie';
import {
  getFooterLinkLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(
    content,
    '/services/my-best-auntie-training-course',
    'My Best Auntie Training Course',
  );
  const description = content.myBestAuntieBooking.description;

  return buildLocalizedMetadata({
    locale,
    path: '/services/my-best-auntie-training-course',
    title,
    description,
  });
}

export default async function MyBestAuntiePage({
  params,
}: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);

  return <MyBestAuntie locale={locale} content={content} />;
}
