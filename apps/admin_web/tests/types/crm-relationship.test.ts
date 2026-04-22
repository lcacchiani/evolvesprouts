import { describe, expect, it } from 'vitest';

import {
  CRM_FAMILY_RELATIONSHIP_TYPES,
  CRM_ORGANIZATION_RELATIONSHIP_TYPES,
  relationshipTypeForCrmEditor,
} from '@/types/crm-relationship';

describe('relationshipTypeForCrmEditor', () => {
  it('passes through values in the allowed list', () => {
    expect(relationshipTypeForCrmEditor('client', CRM_FAMILY_RELATIONSHIP_TYPES)).toBe('client');
    expect(relationshipTypeForCrmEditor('partner', CRM_ORGANIZATION_RELATIONSHIP_TYPES)).toBe(
      'partner'
    );
  });

  it('maps disallowed stored values to other for family editor', () => {
    expect(relationshipTypeForCrmEditor('past_client', CRM_FAMILY_RELATIONSHIP_TYPES)).toBe(
      'other'
    );
    expect(relationshipTypeForCrmEditor('vendor', CRM_FAMILY_RELATIONSHIP_TYPES)).toBe('other');
  });

  it('maps past_client to other for organization editor', () => {
    expect(relationshipTypeForCrmEditor('past_client', CRM_ORGANIZATION_RELATIONSHIP_TYPES)).toBe(
      'other'
    );
  });

  it('maps unknown values to other', () => {
    expect(relationshipTypeForCrmEditor('not_a_real_type' as never)).toBe('other');
  });
});
