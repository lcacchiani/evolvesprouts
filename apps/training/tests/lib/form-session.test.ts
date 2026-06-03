import { afterEach, describe, expect, it } from 'vitest';

import { getOrCreateFormSessionId } from '@/lib/form-session';

describe('getOrCreateFormSessionId', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('scopes session ids per form slug', () => {
    const first = getOrCreateFormSessionId('workshop-signup');
    const second = getOrCreateFormSessionId('feedback-form');
    const firstAgain = getOrCreateFormSessionId('workshop-signup');

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second).not.toBe(first);
    expect(firstAgain).toBe(first);
  });
});
