import { describe, expect, it } from 'vitest';

import { computeSuggestedInstanceSlug, slugifyForInstance } from '@/lib/slug-utils';
import type { ServiceSummary } from '@/types/services';

describe('slugifyForInstance', () => {
  it('lowercases, collapses non-alphanumeric, trims hyphens, caps length', () => {
    expect(slugifyForInstance('  Hello   World!!  ')).toBe('hello-world');
    const long = 'a'.repeat(200);
    expect(slugifyForInstance(long).length).toBeLessThanOrEqual(128);
  });
});

describe('computeSuggestedInstanceSlug', () => {
  const baseService: ServiceSummary = {
    id: 's1',
    instancesCount: 0,
    serviceType: 'training_course',
    title: 'My Course',
    slug: 'my-course',
    bookingSystem: null,
    description: null,
    coverImageS3Key: null,
    deliveryMode: 'online',
    status: 'published',
    createdBy: 'x',
    createdAt: null,
    updatedAt: null,
    serviceTier: '1-3',
    locationId: null,
    trainingDetails: null,
    eventDetails: null,
    consultationDetails: null,
  };

  it('builds MBA slug from service tier and cohort', () => {
    const svc: ServiceSummary = {
      ...baseService,
      slug: 'my-best-auntie',
      serviceTier: '1-3',
    };
    expect(
      computeSuggestedInstanceSlug('training_course', svc, {
        title: '',
        cohort: 'apr-26',
        sessionSlots: [],
      })
    ).toBe('my-best-auntie-1-3-apr-26');
  });

  it('builds event slug from title and first slot date', () => {
    expect(
      computeSuggestedInstanceSlug('event', null, {
        title: 'Easter 2026 Workshop',
        cohort: '',
        sessionSlots: [
          { sortOrder: 1, startsAtLocal: '2026-04-13T10:00' },
          { sortOrder: 0, startsAtLocal: '2026-04-06T10:00' },
        ],
      })
    ).toBe('easter-2026-workshop-2026-04-06');
  });
});
