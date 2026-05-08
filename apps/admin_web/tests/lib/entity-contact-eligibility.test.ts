import { describe, expect, it } from 'vitest';

import { contactEligibleForEntityMembership } from '@/lib/entity-contact-eligibility';

describe('contactEligibleForEntityMembership', () => {
  const base = { id: 'c1', family_ids: [] as string[], organization_ids: [] as string[] };

  it('allows any contact with no family memberships for family mode', () => {
    expect(contactEligibleForEntityMembership(base, null, 'family')).toBe(true);
  });

  it('requires selected family when contact already has families', () => {
    const contact = { ...base, family_ids: ['f1'] };
    expect(contactEligibleForEntityMembership(contact, null, 'family')).toBe(false);
    expect(contactEligibleForEntityMembership(contact, 'f1', 'family')).toBe(true);
  });

  it('requires selected organisation when contact already has organisations', () => {
    const contact = { ...base, organization_ids: ['o1'] };
    expect(contactEligibleForEntityMembership(contact, null, 'organization')).toBe(false);
    expect(contactEligibleForEntityMembership(contact, 'o1', 'organization')).toBe(true);
  });
});
