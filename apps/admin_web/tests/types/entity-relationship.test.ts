import { describe, expect, it } from 'vitest';

import {
  FAMILY_RELATIONSHIP_TYPES,
  ORGANIZATION_RELATIONSHIP_TYPES,
  relationshipTypeForEditor,
} from '@/types/entity-relationship';

describe('relationshipTypeForEditor', () => {
  it('passes through values in the allowed list', () => {
    expect(relationshipTypeForEditor('client', FAMILY_RELATIONSHIP_TYPES)).toBe('client');
    expect(relationshipTypeForEditor('client', ORGANIZATION_RELATIONSHIP_TYPES)).toBe('client');
  });

  it('maps partner to other for CRM organisation editor (partner managed under Services)', () => {
    expect(relationshipTypeForEditor('partner', ORGANIZATION_RELATIONSHIP_TYPES)).toBe('other');
  });

  it('maps disallowed stored values to other for family editor', () => {
    expect(relationshipTypeForEditor('past_client', FAMILY_RELATIONSHIP_TYPES)).toBe(
      'other'
    );
    expect(relationshipTypeForEditor('vendor', FAMILY_RELATIONSHIP_TYPES)).toBe('other');
  });

  it('maps past_client to other for organization editor', () => {
    expect(relationshipTypeForEditor('past_client', ORGANIZATION_RELATIONSHIP_TYPES)).toBe(
      'other'
    );
  });

  it('maps unknown values to other', () => {
    expect(relationshipTypeForEditor('not_a_real_type' as never)).toBe('other');
  });
});
