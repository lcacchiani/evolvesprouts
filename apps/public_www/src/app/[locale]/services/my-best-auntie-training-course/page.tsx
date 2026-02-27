import { MyBestAuntie } from '@/components/pages/my-best-auntie';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  getFooterLinkLabel,
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';
import {
  buildBreadcrumbSchema,
  buildCourseSchema,
  buildFaqPageSchema,
} from '@/lib/structured-data';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = content.seo.trainingCourse.title || getFooterLinkLabel(
    content,
    ROUTES.servicesMyBestAuntieTrainingCourse,
    'My Best Auntie Training Course',
  );
  const description = content.seo.trainingCourse.description;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.servicesMyBestAuntieTrainingCourse,
    title,
    description,
    socialImage: {
      url: content.seo.socialImages.trainingCourse.url,
      alt: content.seo.socialImages.trainingCourse.alt,
    },
  });
}

export default async function MyBestAuntiePage({
  params,
}: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle = content.seo.trainingCourse.title || getFooterLinkLabel(
    content,
    ROUTES.servicesMyBestAuntieTrainingCourse,
    'My Best Auntie Training Course',
  );

  return (
    <>
      <MyBestAuntie locale={locale} content={content} />
      <StructuredDataScript
        id={`training-course-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(content, ROUTES.home, 'Home'),
              path: ROUTES.home,
            },
            {
              name: pageTitle,
              path: ROUTES.servicesMyBestAuntieTrainingCourse,
            },
          ],
        })}
      />
      <StructuredDataScript
        id={`training-course-jsonld-${locale}`}
        data={buildCourseSchema({
          locale,
          content,
        })}
      />
      <StructuredDataScript
        id={`training-course-faq-jsonld-${locale}`}
        data={buildFaqPageSchema(content.faq)}
      />
    </>
  );
}
