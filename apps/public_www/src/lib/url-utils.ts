const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;
const CONTACT_PROTOCOL_REGEX = /^(mailto:|tel:)/i;

export function isHttpHref(href: string): boolean {
  return HTTP_PROTOCOL_REGEX.test(href.trim());
}

export function isExternalHref(href: string): boolean {
  const value = href.trim();
  return isHttpHref(value) || CONTACT_PROTOCOL_REGEX.test(value);
}
