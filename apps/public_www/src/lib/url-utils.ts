const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;
const MAILTO_PROTOCOL_REGEX = /^mailto:/i;
const TEL_PROTOCOL_REGEX = /^tel:/i;
const HASH_PROTOCOL_REGEX = /^#/;
const PROTOCOL_RELATIVE_URL_REGEX = /^\/\//;
const DANGEROUS_PROTOCOL_REGEX = /^(javascript|data|vbscript|file|blob):/i;
const GENERIC_PROTOCOL_REGEX = /^[a-z][a-z0-9+.-]*:/i;
const ASSET_SHARE_LINK_HOSTNAMES = new Set([
  'media.evolvesprouts.com',
  'media-staging.evolvesprouts.com',
]);
const ASSET_SHARE_LINK_PATH_REGEX = /^\/v1\/assets\/share\/[A-Za-z0-9_-]{24,128}\/?$/;

export type HrefKind =
  | 'internal'
  | 'hash'
  | 'http'
  | 'mailto'
  | 'tel'
  | 'unsafe';

export function getHrefKind(href: string): HrefKind {
  const value = href.trim();
  if (!value) {
    return 'unsafe';
  }

  if (DANGEROUS_PROTOCOL_REGEX.test(value) || PROTOCOL_RELATIVE_URL_REGEX.test(value)) {
    return 'unsafe';
  }

  if (HTTP_PROTOCOL_REGEX.test(value)) {
    return 'http';
  }

  if (MAILTO_PROTOCOL_REGEX.test(value)) {
    return 'mailto';
  }

  if (TEL_PROTOCOL_REGEX.test(value)) {
    return 'tel';
  }

  if (HASH_PROTOCOL_REGEX.test(value)) {
    return 'hash';
  }

  if (GENERIC_PROTOCOL_REGEX.test(value)) {
    return 'unsafe';
  }

  return 'internal';
}

export function isHttpHref(href: string): boolean {
  return getHrefKind(href) === 'http';
}

export function isExternalHref(href: string): boolean {
  const hrefKind = getHrefKind(href);
  return hrefKind === 'http' || hrefKind === 'mailto' || hrefKind === 'tel';
}

export function isUnsafeHref(href: string): boolean {
  return getHrefKind(href) === 'unsafe';
}

export function isTrustedAssetShareHref(href: string): boolean {
  if (getHrefKind(href) !== 'http') {
    return false;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(href.trim());
  } catch {
    return false;
  }

  if (parsedUrl.protocol.toLowerCase() !== 'https:') {
    return false;
  }

  if (!ASSET_SHARE_LINK_HOSTNAMES.has(parsedUrl.hostname.toLowerCase())) {
    return false;
  }

  return ASSET_SHARE_LINK_PATH_REGEX.test(parsedUrl.pathname);
}
