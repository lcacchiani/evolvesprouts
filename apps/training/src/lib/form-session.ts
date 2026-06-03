const STORAGE_KEY_PREFIX = 'evolvesprouts-form-session-id';

function storageKey(formSlug: string): string {
  return `${STORAGE_KEY_PREFIX}:${formSlug}`;
}

export function getOrCreateFormSessionId(formSlug: string): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const key = storageKey(formSlug);
  const existing = window.sessionStorage.getItem(key)?.trim();
  if (existing) {
    return existing;
  }
  return resetFormSessionId(formSlug);
}

/** Mint a new session id and persist it for this form slug (shared-device handoff). */
export function resetFormSessionId(formSlug: string): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(storageKey(formSlug), created);
  return created;
}
