const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;
const MAILTO_PROTOCOL_REGEX = /^mailto:/i;
const TEL_PROTOCOL_REGEX = /^tel:/i;
const HASH_PROTOCOL_REGEX = /^#/;

export type HrefKind = 'internal' | 'hash' | 'http' | 'mailto' | 'tel';

export function getHrefKind(href: string): HrefKind {
  const value = href.trim();

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

  return 'internal';
}

export function isHttpHref(href: string): boolean {
  return getHrefKind(href) === 'http';
}

export function isExternalHref(href: string): boolean {
  const hrefKind = getHrefKind(href);
  return hrefKind === 'http' || hrefKind === 'mailto' || hrefKind === 'tel';
}
