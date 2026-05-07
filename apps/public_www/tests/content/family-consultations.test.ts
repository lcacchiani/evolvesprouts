import { describe, expect, it } from 'vitest';

import { resolveFamilyConsultationTier } from '@/lib/family-consultations-data';

describe('family-consultations.json', () => {
  it('resolves tier rows with snake_case location fields', () => {
    const essentials = resolveFamilyConsultationTier('essentials');
    expect(essentials?.tier_id).toBe('essentials');
    expect(essentials?.service_key).toBe('family-consultation-essentials');
    expect(essentials?.location_name?.trim().length).toBeGreaterThan(0);
    expect(essentials?.location_address?.trim().length).toBeGreaterThan(0);

    const deepDive = resolveFamilyConsultationTier('deepDive');
    expect(deepDive?.tier_id).toBe('deep_dive');
    expect(deepDive?.service_key).toBe('family-consultation-deep-dive');
  });
});
