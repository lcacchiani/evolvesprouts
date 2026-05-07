import { AdminApiError, readAdminApiErrorField } from '@/lib/api-admin-client';

/**
 * Maps a 409 conflict on a specific API field to a user-facing editor message.
 */
export function conflictFieldUserMessage(
  err: unknown,
  fieldMessages: Partial<Record<string, string>>
): string | null {
  if (!(err instanceof AdminApiError) || err.statusCode !== 409) {
    return null;
  }
  const field = readAdminApiErrorField(err);
  if (!field) {
    return null;
  }
  return fieldMessages[field] ?? null;
}

export function isAdminApiConflictOnField(err: unknown, field: string): boolean {
  if (!(err instanceof AdminApiError) || err.statusCode !== 409) {
    return false;
  }
  return readAdminApiErrorField(err) === field;
}
