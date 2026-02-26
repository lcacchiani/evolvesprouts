const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;
const MAILTO_PROTOCOL_REGEX = /^mailto:/i;
const TEL_PROTOCOL_REGEX = /^tel:/i;
const HASH_PROTOCOL_REGEX = /^#/;
const PROTOCOL_RELATIVE_URL_REGEX = /^\/\//;
const DANGEROUS_PROTOCOL_REGEX = /^(javascript|data|vbscript|file|blob):/i;
const GENERIC_PROTOCOL_REGEX = /^[a-z][a-z0-9+.-]*:/i;
const IPV4_ADDRESS_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const INTERNAL_LINK_ROOT_DOMAIN_ENV = 'NEXT_PUBLIC_INTERNAL_LINK_ROOT_DOMAIN';
const DEFAULT_INTERNAL_LINK_ROOT_DOMAIN = 'evolvesprouts.com';

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

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

function getRootDomain(hostname: string): string {
  const normalizedHostname = normalizeHostname(hostname);
  if (
    !normalizedHostname
    || normalizedHostname === 'localhost'
    || IPV4_ADDRESS_REGEX.test(normalizedHostname)
    || normalizedHostname.includes(':')
  ) {
    return normalizedHostname;
  }

  const labels = normalizedHostname
    .split('.')
    .filter((label) => label.length > 0);
  if (labels.length < 2) {
    return normalizedHostname;
  }

  return `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
}

function resolveReferenceHostname(currentHostname?: string): string {
  const normalizedCurrentHostname = normalizeHostname(currentHostname ?? '');
  if (normalizedCurrentHostname) {
    return normalizedCurrentHostname;
  }

  const configuredRootDomain = normalizeHostname(
    process.env[INTERNAL_LINK_ROOT_DOMAIN_ENV] ?? '',
  );
  if (configuredRootDomain) {
    return configuredRootDomain;
  }

  return DEFAULT_INTERNAL_LINK_ROOT_DOMAIN;
}

export function isSameRootDomainHttpHref(
  href: string,
  currentHostname?: string,
): boolean {
  if (getHrefKind(href) !== 'http') {
    return false;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(href.trim());
  } catch {
    return false;
  }

  const targetHostname = normalizeHostname(parsedUrl.hostname);
  if (!targetHostname) {
    return false;
  }

  const referenceHostname = normalizeHostname(
    resolveReferenceHostname(currentHostname),
  );
  if (!referenceHostname) {
    return false;
  }

  if (referenceHostname === targetHostname) {
    return true;
  }

  return getRootDomain(referenceHostname) === getRootDomain(targetHostname);
}
