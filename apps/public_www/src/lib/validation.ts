export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeSingleLineValue(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
