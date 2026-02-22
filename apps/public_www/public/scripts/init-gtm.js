(function initGtm() {
  if (window.location.hostname !== 'www.evolvesprouts.com') {
    return;
  }

  var gtmId = document.documentElement.getAttribute('data-gtm-id');
  if (!gtmId || gtmId.indexOf('GTM-') !== 0) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;
  document.head.appendChild(script);
})();
