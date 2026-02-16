import { redirect } from 'next/navigation';

import {
  type LocaleRouteProps,
  resolveLocaleFromParams,
} from '@/lib/locale-page';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export default async function ContactAliasPage({
  params,
}: LocaleRouteProps) {
  const locale = await resolveLocaleFromParams(params);
  redirect(`/${locale}/contact-us`);
}
