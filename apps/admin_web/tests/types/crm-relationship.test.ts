import { describe, expect, it } from 'vitest';

import { relationshipTypeForCrmEditor } from '@/types/crm-relationship';

describe('relationshipTypeForCrmEditor', () => {
  it('maps vendor to other for editor compatibility', () => {
    expect(relationshipTypeForCrmEditor('vendor')).toBe('other');
  });

  it('passes through allowed values', () => {
    expect(relationshipTypeForCrmEditor('client')).toBe('client');
  });
});
