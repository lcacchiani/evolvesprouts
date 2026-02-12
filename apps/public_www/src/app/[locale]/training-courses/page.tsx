import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderPageMetadata,
  getMenuLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface TrainingCoursesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TrainingCoursesPageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/training-courses', 'Training Courses');

  return buildPlaceholderPageMetadata({
    locale,
    path: '/training-courses',
    title,
  });
}

export default async function TrainingCoursesPage({
  params,
}: TrainingCoursesPageProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/training-courses', 'Training Courses');

  return <EmptyPagePlaceholder title={title} />;
}
