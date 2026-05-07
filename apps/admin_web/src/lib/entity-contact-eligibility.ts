/** Whether a contact may be added to the selected family or organisation membership list. */
export function contactEligibleForEntityMembership(
  contact: { id: string; family_ids: string[]; organization_ids: string[] },
  selectedEntityId: string | null,
  mode: 'family' | 'organization'
): boolean {
  if (mode === 'family') {
    if (contact.family_ids.length === 0) {
      return true;
    }
    return Boolean(selectedEntityId && contact.family_ids.includes(selectedEntityId));
  }
  if (contact.organization_ids.length === 0) {
    return true;
  }
  return Boolean(selectedEntityId && contact.organization_ids.includes(selectedEntityId));
}
