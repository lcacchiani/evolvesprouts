import { describe, expect, it } from 'vitest';

import { ADMIN_API_MAX_LIST_LIMIT, clampAdminListLimit } from '@/lib/admin-list-limit';

describe('clampAdminListLimit', () => {
  it('clamps to max and minimum 1', () => {
    expect(clampAdminListLimit(ADMIN_API_MAX_LIST_LIMIT + 50)).toBe(ADMIN_API_MAX_LIST_LIMIT);
    expect(clampAdminListLimit(0)).toBe(1);
    expect(clampAdminListLimit(-5)).toBe(1);
  });

  it('preserves valid values', () => {
    expect(clampAdminListLimit(25)).toBe(25);
    expect(clampAdminListLimit(100)).toBe(100);
  });
});
