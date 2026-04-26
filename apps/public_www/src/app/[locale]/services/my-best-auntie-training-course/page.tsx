import { MyBestAuntiePage } from '@/components/pages/my-best-auntie';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  createPublicCrmApiClient,
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  type MyBestAuntieEventCohort,
  fetchEventsPayload,
  normalizeMyBestAuntieCohortsFromPayload,
} from '@/lib/events-data';
import {
  getFooterLinkLabel,
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { reportInternalError } from '@/lib/internal-error-reporting';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';
import { FAQ_PAGE_AUDIENCES } from '@/lib/faq-audiences';
import {
  buildBreadcrumbSchema,
  buildCourseSchema,
  buildFaqPageSchema,
} from '@/lib/structured-data';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

const MBA_CALENDAR_FETCH_TIMEOUT_MS = 5000;

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = content.seo.trainingCourse.title || getFooterLinkLabel(
    content,
    ROUTES.servicesMyBestAuntieTrainingCourse,
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

export default async function MyBestAuntieRoutePage({
  params,
}: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle = content.seo.trainingCourse.title || getFooterLinkLabel(
    content,
    ROUTES.servicesMyBestAuntieTrainingCourse,
  );

  const crmApiClient = createPublicCrmApiClient();
  let cohorts: MyBestAuntieEventCohort[] = [];
  if (crmApiClient) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, MBA_CALENDAR_FETCH_TIMEOUT_MS);
    try {
      const payload = await fetchEventsPayload(crmApiClient, controller.signal, {
        serviceKey: 'my-best-auntie',
        serviceType: 'training_course',
      });
      cohorts = normalizeMyBestAuntieCohortsFromPayload(payload, locale);
    } catch (error) {
      if (!isAbortRequestError(error)) {
        reportInternalError({
          context: 'my-best-auntie-training-course-calendar-fetch',
          error,
          metadata: { locale },
        });
      }
      cohorts = [];
    } finally {
      clearTimeout(timeout);
    }
  }

  return (
    <>
      <MyBestAuntiePage locale={locale} content={content} cohorts={cohorts} />
      <StructuredDataScript
        id={`training-course-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(content, ROUTES.home),
              path: ROUTES.home,
            },
            {
              name: content.footer.services.title,
              path: ROUTES.servicesIndex,
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
        data={buildFaqPageSchema(
          content.faq,
          FAQ_PAGE_AUDIENCES.myBestAuntieTrainingCourse,
        )}
      />
    </>
  );
}
