const STORAGE_KEY_PREFIX = 'evolvesprouts-poll-session-id';

function storageKey(pollSlug: string): string {
  return `${STORAGE_KEY_PREFIX}:${pollSlug}`;
}

export function getOrCreatePollSessionId(pollSlug: string): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const key = storageKey(pollSlug);
  const existing = window.sessionStorage.getItem(key)?.trim();
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}
