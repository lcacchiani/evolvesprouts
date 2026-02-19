(function showStagingBadge() {
  var host = window.location.hostname.toLowerCase();
  var isStagingHost = host.includes('staging') || host.includes('preprod');
  if (!isStagingHost) {
    return;
  }

  var robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive');

  var badge = document.getElementById('environment-badge');
  if (badge) {
    badge.classList.remove('hidden');
  }
})();
