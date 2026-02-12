import { redirect } from 'next/navigation';

import { resolveLocalePageContext } from '@/lib/locale-page';

interface BookAliasPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BookAliasPage({ params }: BookAliasPageProps) {
  const { locale } = await resolveLocalePageContext(params);
  redirect(`/${locale}/training-courses`);
}
