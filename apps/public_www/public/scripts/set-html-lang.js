(function setHtmlLang() {
  var match = location.pathname.match(/^\/(en|zh-CN|zh-HK)(?:\/|$)/);
  if (match) {
    document.documentElement.lang = match[1];
  }
})();
