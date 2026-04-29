/** Public service template key: kebab-case segments (matches Aurora `services.service_key`). */
export const SERVICE_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const MAX_SERVICE_KEY_LENGTH = 80;

export function isValidServiceKey(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s || s.length > MAX_SERVICE_KEY_LENGTH) {
    return false;
  }
  return SERVICE_KEY_PATTERN.test(s);
}
