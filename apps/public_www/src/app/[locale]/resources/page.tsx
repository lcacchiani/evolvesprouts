import { redirect } from 'next/navigation';

import { resolveLocalePageContext } from '@/lib/locale-page';

interface ResourcesAliasPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ResourcesAliasPage({
  params,
}: ResourcesAliasPageProps) {
  const { locale } = await resolveLocalePageContext(params);
  redirect(`/${locale}#resources`);
}
