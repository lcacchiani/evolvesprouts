import { describe, expect, it } from 'vitest';

import { primaryExpenseAttachmentAssetId } from '@/lib/expense-attachments';

describe('primaryExpenseAttachmentAssetId', () => {
  it('returns the asset id with the lowest sort order', () => {
    expect(
      primaryExpenseAttachmentAssetId([
        {
          id: 'a',
          assetId: 'second',
          sortOrder: 5,
          fileName: null,
          contentType: null,
          assetTitle: null,
        },
        {
          id: 'b',
          assetId: 'first',
          sortOrder: 0,
          fileName: null,
          contentType: null,
          assetTitle: null,
        },
      ])
    ).toBe('first');
  });

  it('returns null for an empty list', () => {
    expect(primaryExpenseAttachmentAssetId([])).toBeNull();
  });
});
