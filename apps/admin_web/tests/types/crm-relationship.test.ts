import { describe, expect, it } from 'vitest';

import { relationshipTypeForCrmEditor } from '@/types/crm-relationship';

describe('relationshipTypeForCrmEditor', () => {
  it('passes through vendor when present in the editor enum', () => {
    expect(relationshipTypeForCrmEditor('vendor')).toBe('vendor');
  });

  it('passes through allowed values', () => {
    expect(relationshipTypeForCrmEditor('client')).toBe('client');
  });

  it('maps unknown values to other', () => {
    expect(relationshipTypeForCrmEditor('not_a_real_type' as never)).toBe('other');
  });
});
