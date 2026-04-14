import type { components } from '@/types/generated/admin-api.generated';

/** Relationship values allowed for CRM contacts, families, and non-vendor organisations (no vendor). */
export type CrmEntityRelationshipType = Exclude<
  components['schemas']['CrmRelationshipType'],
  'vendor'
>;

export const CRM_ENTITY_RELATIONSHIP_TYPES: readonly CrmEntityRelationshipType[] = [
  'prospect',
  'client',
  'past_client',
  'partner',
  'other',
];

/**
 * Map a stored CRM relationship to a dropdown value. Vendor is not editable here
 * (Finance / vendor orgs); unknown values map to `other` so the select stays valid.
 */
export function relationshipTypeForCrmEditor(
  stored: components['schemas']['CrmRelationshipType']
): CrmEntityRelationshipType {
  if (stored === 'vendor') {
    return 'other';
  }
  return stored as CrmEntityRelationshipType;
}
