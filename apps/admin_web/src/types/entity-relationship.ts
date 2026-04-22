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
 *
 * When `allowed` is a tuple like `FAMILY_RELATIONSHIP_TYPES`, the return type narrows to
 * that tuple's element union so it can be passed to `useState` for a constrained select.
 */
export function relationshipTypeForEditor<
  const A extends readonly EntityRelationshipType[] = typeof CONTACT_RELATIONSHIP_TYPES,
>(stored: EntityRelationshipType, allowed?: A): A[number] {
  const list = (allowed ?? (CONTACT_RELATIONSHIP_TYPES as unknown as A)) as readonly EntityRelationshipType[];
  const allowedSet = new Set<string>(list);
  if (allowedSet.has(stored)) {
    return stored as A[number];
  }
  return 'other' as A[number];
}
