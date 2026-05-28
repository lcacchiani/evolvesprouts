const STORAGE_KEY = 'evolvesprouts-form-session-id';

export function getOrCreateFormSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const existing = window.sessionStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(STORAGE_KEY, created);
  return created;
}
