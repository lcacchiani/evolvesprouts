import { formatLocationLabel } from '@/lib/format';
import type { LocationSummary, PartnerOrgRef } from '@/types/services';

/**
 * Locations shown on instance create/edit: template venues, assigned partners'
 * venues, and any venue already selected on the form (avoid hiding stale picks).
 */
export function filterLocationsForInstance(
  locations: LocationSummary[],
  partnerOrgs: PartnerOrgRef[],
  extraSelectedIds: Set<string>
): LocationSummary[] {
  const selectedPartnerIds = new Set(partnerOrgs.map((p) => p.id));
  const assignedPartnerLocationIds = new Set(
    partnerOrgs.map((p) => p.locationId).filter((id): id is string => Boolean(id?.trim()))
  );

  return locations.filter((location) => {
    if (extraSelectedIds.has(location.id)) {
      return true;
    }
    const partnerIds = location.partnerOrganizationIds ?? [];
    if (partnerIds.length === 0) {
      if (!location.lockedFromPartnerOrg) {
        return true;
      }
      return assignedPartnerLocationIds.has(location.id);
    }
    return partnerIds.some((orgId) => selectedPartnerIds.has(orgId));
  });
}

/** Dropdown label: partner names when present, else geographic/address label. */
export function formatInstanceLocationOptionLabel(location: LocationSummary): string {
  if (location.partnerOrganizationLabels.length > 0) {
    return location.partnerOrganizationLabels.join(', ');
  }
  return formatLocationLabel(location);
}
