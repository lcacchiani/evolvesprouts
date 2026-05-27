/** Home URL on the main public website (locale landing). */
export function getPublicWwwHomeUrl(): string {
  const raw = process.env.NEXT_PUBLIC_PUBLIC_WWW_ORIGIN?.trim();
  if (!raw) {
    return '';
  }
  const origin = raw.replace(/\/$/, '');
  return `${origin}/en/`;
}
