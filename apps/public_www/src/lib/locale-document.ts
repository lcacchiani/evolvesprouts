import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getContent,
  type Locale,
} from '@/content';

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
  const segments = pathname.split('/').filter(Boolean);
  const candidateLocale = segments[0];

  if (
    typeof candidateLocale === 'string' &&
    SUPPORTED_LOCALES.includes(candidateLocale as Locale)
  ) {
    return candidateLocale as Locale;
  }

  return DEFAULT_LOCALE;
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
