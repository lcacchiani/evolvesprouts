export interface FormPrefillData {
  firstName: string;
  email: string;
}

export const FORM_PREFILL_STORAGE_KEY = 'es_form_prefill';

const EMPTY_PREFILL: FormPrefillData = {
  firstName: '',
  email: '',
};

function parseStoredPrefill(raw: string): FormPrefillData {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { ...EMPTY_PREFILL };
  }
  const record = parsed as Record<string, unknown>;
  const firstName = typeof record.firstName === 'string' ? record.firstName : '';
  const email = typeof record.email === 'string' ? record.email : '';
  return { firstName, email };
}

export function readFormPrefill(): FormPrefillData {
  try {
    if (typeof sessionStorage === 'undefined') {
      return { ...EMPTY_PREFILL };
    }
    const raw = sessionStorage.getItem(FORM_PREFILL_STORAGE_KEY);
    if (!raw) {
      return { ...EMPTY_PREFILL };
    }
    return parseStoredPrefill(raw);
  } catch {
    return { ...EMPTY_PREFILL };
  }
}

export function writeFormPrefill(data: Partial<FormPrefillData>): void {
  try {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    const merged: FormPrefillData = { ...readFormPrefill() };
    if (data.firstName !== undefined) {
      const trimmedFirstName = data.firstName.trim();
      if (trimmedFirstName) {
        merged.firstName = trimmedFirstName;
      }
    }
    if (data.email !== undefined) {
      const trimmedEmail = data.email.trim();
      if (trimmedEmail) {
        merged.email = trimmedEmail;
      }
    }
    sessionStorage.setItem(FORM_PREFILL_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore environments where sessionStorage throws (e.g. some private browsing modes).
  }
}
