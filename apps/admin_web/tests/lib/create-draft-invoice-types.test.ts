import { describe, expect, it } from 'vitest';

import type { components } from '@/types/generated/admin-api.generated';

type DraftBody = components['schemas']['CreateDraftInvoiceRequest'];

describe('CreateDraftInvoiceRequest typing', () => {
  it('allows omitting currency when sending enrollment ids only', () => {
    const body: DraftBody = {
      draftKind: 'enrollment_merge',
      enrollmentIds: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
    };
    expect(body.currency).toBeUndefined();
  });
});
