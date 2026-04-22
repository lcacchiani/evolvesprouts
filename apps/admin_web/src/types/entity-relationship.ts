import type { components } from '@/types/generated/admin-api.generated';

/** Full stored relationship for contacts, families, and orgs in API responses. */
export type EntityRelationshipType = components['schemas']['EntityRelationshipType'];

/** Relationship values allowed on contact create/update (matches API storage). */
export const CONTACT_RELATIONSHIP_TYPES: readonly EntityRelationshipType[] = [
  'prospect',
  'client',
  'past_client',
  'partner',
  'vendor',
  'other',
];

/** Relationship values allowed when creating or editing a family. */
export const FAMILY_RELATIONSHIP_TYPES: readonly components['schemas']['EntityFamilyRelationshipType'][] =
  ['prospect', 'client', 'other'];

/**
 * Relationship values for the organization editor (excludes `vendor`,
 * which is managed from Finance; excludes `past_client`, which organizations cannot use).
 */
export const ORGANIZATION_RELATIONSHIP_TYPES: readonly components['schemas']['EntityOrganizationRelationshipType'][] =
  ['prospect', 'client', 'partner', 'other'];

/**
 * Map a stored relationship to a select value. Values outside `allowed` map to `other`
 * so the select stays valid.
 */
export function relationshipTypeForEditor(
  stored: EntityRelationshipType,
  allowed: readonly EntityRelationshipType[] = CONTACT_RELATIONSHIP_TYPES
): EntityRelationshipType {
  const allowedSet = new Set<string>(allowed);
  if (allowedSet.has(stored)) {
    return stored;
  }
  return 'other';
}
