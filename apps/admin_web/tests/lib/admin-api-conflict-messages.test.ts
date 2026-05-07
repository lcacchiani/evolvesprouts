import { describe, expect, it } from 'vitest';

import { AdminApiError } from '@/lib/api-admin-client';
import { conflictFieldUserMessage, isAdminApiConflictOnField } from '@/lib/admin-api-conflict-messages';

describe('admin-api-conflict-messages', () => {
  it('maps 409 field messages', () => {
    const err = new AdminApiError({
      statusCode: 409,
      payload: { field: 'name' },
      message: 'duplicate',
    });
    expect(conflictFieldUserMessage(err, { name: 'Taken' })).toBe('Taken');
    expect(conflictFieldUserMessage(err, { code: 'bad' })).toBeNull();
  });

  it('detects conflict field', () => {
    const err = new AdminApiError({
      statusCode: 409,
      payload: { field: 'slug' },
      message: 'dup',
    });
    expect(isAdminApiConflictOnField(err, 'slug')).toBe(true);
    expect(isAdminApiConflictOnField(err, 'name')).toBe(false);
  });
});
