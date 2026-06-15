import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPollContent } from '@/lib/polls';
import * as pollsApi from '@/lib/polls-api';
import { usePollControlState } from '@/lib/use-poll-control-state';

describe('usePollControlState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads control state on mount', async () => {
    const poll = getPollContent('workshop-food-jun-26');
    if (!poll) {
      throw new Error('expected poll fixture');
    }

    const fetchMock = vi.spyOn(pollsApi, 'fetchPollControlState').mockResolvedValue({
      pollSlug: poll.slug,
      enabledQuestionIds: ['role'],
    });

    const { result } = renderHook(() =>
      usePollControlState({
        pollSlug: poll.slug,
        questions: poll.questions,
        allowWrites: false,
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(poll.slug);
      expect(result.current.isQuestionEnabled('role')).toBe(true);
    });
  });
});
