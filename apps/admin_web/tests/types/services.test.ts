import { describe, expect, it } from 'vitest';

import { isConsultationLikeServiceType } from '@/types/services';

describe('service type helpers', () => {
  it('treats intro_call as consultation-like for admin UI branching', () => {
    expect(isConsultationLikeServiceType('consultation')).toBe(true);
    expect(isConsultationLikeServiceType('intro_call')).toBe(true);
    expect(isConsultationLikeServiceType('training_course')).toBe(false);
    expect(isConsultationLikeServiceType('event')).toBe(false);
  });
});
