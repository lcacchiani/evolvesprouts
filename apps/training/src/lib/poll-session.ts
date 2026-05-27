const STORAGE_KEY = 'evolvesprouts-poll-session-id';

export function getOrCreatePollSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const existing = window.sessionStorage.getItem(STORAGE_KEY)?.trim();
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(STORAGE_KEY, created);
  return created;
}
