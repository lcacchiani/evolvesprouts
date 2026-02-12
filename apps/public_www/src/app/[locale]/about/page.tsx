import { redirect } from 'next/navigation';

import { resolveLocalePageContext } from '@/lib/locale-page';

interface AboutAliasPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AboutAliasPage({ params }: AboutAliasPageProps) {
  const { locale } = await resolveLocalePageContext(params);
  redirect(`/${locale}/about-us`);
}
