export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeSingleLineValue(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** First segment of the email local-part for legacy contact-us `first_name` when no name field exists. */
export function deriveFirstNameFromEmailLocalPart(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) {
    return '';
  }
  const localPart = trimmed.slice(0, atIndex);
  const segment = localPart.split(/[.+_-]/)[0] ?? '';
  return sanitizeSingleLineValue(segment);
}
