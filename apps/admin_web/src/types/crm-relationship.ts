import type { components } from '@/types/generated/admin-api.generated';

/** Relationship values shown in CRM entity editors (includes vendor where the API allows it). */
export type CrmEntityRelationshipType = components['schemas']['CrmRelationshipType'];

export const CRM_ENTITY_RELATIONSHIP_TYPES: readonly CrmEntityRelationshipType[] = [
  'prospect',
  'client',
  'past_client',
  'partner',
  'vendor',
  'other',
];

/**
 * Map a stored CRM relationship to a dropdown value. Unknown values map to `other`
 * so the select stays valid.
 */
export function relationshipTypeForCrmEditor(
  stored: components['schemas']['CrmRelationshipType']
): CrmEntityRelationshipType {
  const allowed = new Set(CRM_ENTITY_RELATIONSHIP_TYPES);
  if (allowed.has(stored)) {
    return stored;
  }
  return 'other';
}
