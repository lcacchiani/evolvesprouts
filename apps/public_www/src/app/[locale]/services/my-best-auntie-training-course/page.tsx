import { MyBestAuntie } from '@/components/my-best-auntie';
import {
  getFooterLinkLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(
    content,
    ROUTES.servicesMyBestAuntieTrainingCourse,
    'My Best Auntie Training Course',
  );
  const description = content.myBestAuntieBooking.description;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.servicesMyBestAuntieTrainingCourse,
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
