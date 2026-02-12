import { redirect } from 'next/navigation';

import { resolveLocalePageContext } from '@/lib/locale-page';

interface ContactAliasPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ContactAliasPage({
  params,
}: ContactAliasPageProps) {
  const { locale } = await resolveLocalePageContext(params);
  redirect(`/${locale}/contact-us`);
}
