import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderMetadataFromParams,
  getMenuLabel,
  type LocaleRouteProps,
  resolvePlaceholderPageTitle,
} from '@/lib/locale-page';

const TRAINING_COURSES_PLACEHOLDER_OPTIONS = {
  path: '/training-courses',
  fallbackTitle: 'Training Courses',
  labelResolver: getMenuLabel,
} as const;

export async function generateMetadata({ params }: LocaleRouteProps) {
  return buildPlaceholderMetadataFromParams(
    params,
    TRAINING_COURSES_PLACEHOLDER_OPTIONS,
  );
}

export default async function TrainingCoursesPage({
  params,
}: LocaleRouteProps) {
  const title = await resolvePlaceholderPageTitle(
    params,
    TRAINING_COURSES_PLACEHOLDER_OPTIONS,
  );

  return <EmptyPagePlaceholder title={title} />;
}
