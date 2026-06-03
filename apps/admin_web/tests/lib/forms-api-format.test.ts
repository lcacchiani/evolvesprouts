import { describe, expect, it } from 'vitest';

import { formatFormAnswerValue } from '@/lib/forms-api';
import type { AdminFormAnswerRow } from '@/lib/forms-api';

describe('formatFormAnswerValue', () => {
  it('appends consent follow-up text for consent rows', () => {
    const row: AdminFormAnswerRow = {
      formSlug: 'workshop-exit-feedback',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      questionId: 'share-consent',
      questionType: 'consent',
      booleanAnswer: true,
      freeText: 'Year 3',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(formatFormAnswerValue(row)).toBe('yes; Year 3');
  });
});
