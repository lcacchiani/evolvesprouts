(function hideCssSensitiveDuplicatesWhenStylesMissing() {
  var rootElement = document.documentElement;
  var hiddenMarkerValue = 'hide-when-css-missing';
  var cssLoadedMarkerName = '--es-css-loaded';
  var cssLoadedMarkerValue = 'loaded';

  function hasProjectStylesheetLoaded() {
    var markerValue = window.getComputedStyle(rootElement)
      .getPropertyValue(cssLoadedMarkerName)
      .trim();
    return markerValue === cssLoadedMarkerValue;
  }

  function hideFallbackElements() {
    var fallbackElements = document.querySelectorAll(
      '[data-css-fallback="' + hiddenMarkerValue + '"]',
    );
    for (var index = 0; index < fallbackElements.length; index += 1) {
      fallbackElements[index].setAttribute('hidden', '');
    }
  }

  function applyCssFallback() {
    if (hasProjectStylesheetLoaded()) {
      rootElement.setAttribute('data-css-status', 'loaded');
      return;
    }

    rootElement.setAttribute('data-css-status', 'missing');
    hideFallbackElements();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCssFallback, { once: true });
  } else {
    applyCssFallback();
  }
})();
