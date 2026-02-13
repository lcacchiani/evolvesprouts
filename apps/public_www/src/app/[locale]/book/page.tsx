import { redirect } from 'next/navigation';

import {
  type LocaleRouteProps,
  resolveLocaleFromParams,
} from '@/lib/locale-page';

export default async function BookAliasPage({ params }: LocaleRouteProps) {
  const locale = await resolveLocaleFromParams(params);
  redirect(`/${locale}/training-courses`);
}
