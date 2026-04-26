import { describe, expect, it } from 'vitest';

import { formatInstanceLocationOptionLabel, filterLocationsForInstance } from '@/lib/instance-location-options';

import type { LocationSummary, PartnerOrgRef } from '@/types/services';

function loc(overrides: Partial<LocationSummary>): LocationSummary {
  return {
    id: 'loc-1',
    name: null,
    areaId: 'area-1',
    address: 'Addr',
    lat: null,
    lng: null,
    createdAt: null,
    updatedAt: null,
    lockedFromPartnerOrg: false,
    partnerOrganizationLabels: [],
    partnerOrganizationIds: [],
    ...overrides,
  };
}

describe('filterLocationsForInstance', () => {
  const pure = loc({ id: 'pure', address: 'Pure venue' });
  const partnerVenue = loc({
    id: 'pv',
    lockedFromPartnerOrg: true,
    partnerOrganizationLabels: ['P'],
    partnerOrganizationIds: ['org-p'],
  });
  const foreign = loc({
    id: 'fv',
    lockedFromPartnerOrg: true,
    partnerOrganizationLabels: ['Other'],
    partnerOrganizationIds: ['org-other'],
  });

  it('keeps pure venues and drops foreign partner venues when unassigned', () => {
    const partners: PartnerOrgRef[] = [{ id: 'org-p', name: 'P', active: true, locationId: 'pv' }];
    const out = filterLocationsForInstance([pure, partnerVenue, foreign], partners, new Set());
    expect(out.map((l) => l.id)).toEqual(['pure', 'pv']);
  });

  it('keeps unassigned partner venue when id is in extraSelectedIds', () => {
    const out = filterLocationsForInstance(
      [pure, foreign],
      [],
      new Set(['fv'])
    );
    expect(out.map((l) => l.id)).toEqual(['pure', 'fv']);
  });

  it('with empty partnerOrgs only pure venues remain', () => {
    const out = filterLocationsForInstance([pure, partnerVenue, foreign], [], new Set());
    expect(out).toEqual([pure]);
  });
});

describe('formatInstanceLocationOptionLabel', () => {
  it('joins partner labels when present', () => {
    const label = formatInstanceLocationOptionLabel(
      loc({
        partnerOrganizationLabels: ['A', 'B'],
        partnerOrganizationIds: ['1', '2'],
      })
    );
    expect(label).toBe('A, B');
  });

  it('falls back to formatLocationLabel when no partner labels', () => {
    expect(
      formatInstanceLocationOptionLabel(
        loc({ name: 'Hall', partnerOrganizationLabels: [], partnerOrganizationIds: [] })
      )
    ).toBe('Hall');
  });
});
