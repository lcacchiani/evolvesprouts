(function applyLocaleDocumentAttributes() {
  var rootElement = document.documentElement;
  var defaultLocale = (rootElement.getAttribute('data-default-locale') || 'en').trim() || 'en';
  var localeDirections = {};
  var serializedDirections = rootElement.getAttribute('data-locale-directions');

  if (serializedDirections) {
    try {
      var parsedDirections = JSON.parse(serializedDirections);
      if (parsedDirections && typeof parsedDirections === 'object') {
        localeDirections = parsedDirections;
      }
    } catch (_error) {
      localeDirections = {};
    }
  }

  if (!Object.prototype.hasOwnProperty.call(localeDirections, defaultLocale)) {
    localeDirections[defaultLocale] = 'ltr';
  }

  var segments = window.location.pathname.split('/').filter(Boolean);
  var candidateLocale = segments[0];
  var locale = Object.prototype.hasOwnProperty.call(localeDirections, candidateLocale)
    ? candidateLocale
    : defaultLocale;
  var direction = localeDirections[locale] === 'rtl' ? 'rtl' : 'ltr';

  rootElement.lang = locale;
  rootElement.setAttribute('dir', direction);
})();
