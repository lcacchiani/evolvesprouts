import {
  DEFAULT_LOCALE,
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

export function buildLocaleDocumentAttributesScript(): string {
  return `
(function applyLocaleDocumentAttributes() {
  var defaultLocale = ${JSON.stringify(DEFAULT_LOCALE)};
  var localeDirections = ${JSON.stringify(localeDirectionMap)};
  var segments = window.location.pathname.split('/').filter(Boolean);
  var candidateLocale = segments[0];
  var locale = Object.prototype.hasOwnProperty.call(localeDirections, candidateLocale)
    ? candidateLocale
    : defaultLocale;
  var direction = localeDirections[locale] || 'ltr';
  var rootElement = document.documentElement;
  rootElement.lang = locale;
  rootElement.setAttribute('dir', direction);
})();
`;
}
