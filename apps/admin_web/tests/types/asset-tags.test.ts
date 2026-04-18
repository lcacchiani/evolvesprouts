import { describe, expect, it } from 'vitest';

import { EXPENSE_ATTACHMENT_ASSET_TAG } from '@/types/assets';

/**
 * Must stay aligned with `EXPENSE_ATTACHMENT_TAG_NAME` in
 * `backend/src/app/services/asset_expense_tagging.py` and admin OpenAPI
 * `tag_name` / expense filter examples.
 */
describe('asset tag constants', () => {
  it('expense attachment tag matches backend literal', () => {
    expect(EXPENSE_ATTACHMENT_ASSET_TAG).toBe('expense_attachment');
  });
});
