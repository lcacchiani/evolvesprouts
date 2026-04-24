import familyConsultationsPayload from '@/content/family-consultations.json';

import type { ConsultationsBookingModalTierId } from '@/lib/consultations-booking-modal-payload';

export interface FamilyConsultationTierRow {
  tier_id: string;
  service: string;
  location_name: string;
  location_address: string;
  dates: unknown[];
}

function tierIdToJsonKey(tierId: ConsultationsBookingModalTierId): string {
  return tierId === 'deepDive' ? 'deep_dive' : 'essentials';
}

function readRows(): FamilyConsultationTierRow[] {
  const raw = familyConsultationsPayload as { data?: unknown };
  if (!Array.isArray(raw.data)) {
    return [];
  }
  return raw.data.filter((row): row is FamilyConsultationTierRow => {
    return (
      typeof row === 'object' &&
      row !== null &&
      typeof (row as FamilyConsultationTierRow).tier_id === 'string'
    );
  });
}

export function resolveFamilyConsultationTier(
  tierId: ConsultationsBookingModalTierId,
): FamilyConsultationTierRow | undefined {
  const key = tierIdToJsonKey(tierId);
  return readRows().find((row) => row.tier_id === key);
}
