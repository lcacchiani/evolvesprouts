import type { components } from '@/types/generated/admin-api.generated';

/** Full stored CRM relationship (contacts, families, orgs in API responses). */
export type CrmRelationshipType = components['schemas']['CrmRelationshipType'];

/** Relationship values allowed on contact create/update (matches API storage). */
export const CONTACT_RELATIONSHIP_TYPES: readonly CrmRelationshipType[] = [
  'prospect',
  'client',
  'past_client',
  'partner',
  'vendor',
  'other',
];

/** Relationship values allowed when creating or editing a family. */
export const FAMILY_RELATIONSHIP_TYPES: readonly components['schemas']['CrmFamilyRelationshipType'][] =
  ['prospect', 'client', 'other'];

/**
 * Relationship values for the CRM organization editor (excludes `vendor`,
 * which is managed from Finance; excludes `past_client`, which organizations cannot use).
 */
export const ORGANIZATION_RELATIONSHIP_TYPES: readonly components['schemas']['CrmOrganizationRelationshipType'][] =
  ['prospect', 'client', 'partner', 'other'];

/**
 * Map a stored CRM relationship to a select value. Values outside `allowed` map to `other`
 * so the select stays valid.
 */
export function relationshipTypeForEditor(
  stored: CrmRelationshipType,
  allowed: readonly CrmRelationshipType[] = CONTACT_RELATIONSHIP_TYPES
): CrmRelationshipType {
  const allowedSet = new Set<string>(allowed);
  if (allowedSet.has(stored)) {
    return stored;
  }
  return 'other';
}
