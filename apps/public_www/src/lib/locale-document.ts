import {
  SUPPORTED_LOCALES,
  getContent,
  type Locale,
} from '@/content';
import { getLocaleFromPath } from '@/lib/locale-routing';

export type DocumentDirection = 'ltr' | 'rtl';

const localeDirectionMap = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale,
    getContent(locale).meta.direction === 'rtl' ? 'rtl' : 'ltr',
  ]),
) as Record<Locale, DocumentDirection>;

export function getDirectionForLocale(locale: Locale): DocumentDirection {
  return localeDirectionMap[locale];
}

export function resolveLocaleFromPathname(pathname: string): Locale {
  return getLocaleFromPath(pathname);
}
