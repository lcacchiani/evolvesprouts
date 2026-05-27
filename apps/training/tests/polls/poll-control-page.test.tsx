import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PollControlPage } from '@/components/polls/poll-control-page';
import { getPollContent, POLLS_COMMON } from '@/lib/polls';
import * as pollsApi from '@/lib/polls-api';

describe('PollControlPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders questions and toggles visibility', async () => {
    const poll = getPollContent('workshop-food-jun-26');
    if (!poll) {
      throw new Error('expected poll fixture');
    }

    vi.spyOn(pollsApi, 'fetchPollControlState').mockResolvedValue({
      pollSlug: poll.slug,
      enabledQuestionIds: [],
    });
    vi.spyOn(pollsApi, 'persistPollControlState').mockResolvedValue({
      pollSlug: poll.slug,
      enabledQuestionIds: ['role'],
      updatedAt: '2026-05-27T00:00:00Z',
    });
    vi.spyOn(pollsApi, 'fetchPollQuestionResults').mockResolvedValue({
      pollSlug: poll.slug,
      questionId: 'role',
      questionType: 'select',
      totalResponses: 0,
      buckets: [],
    });

    const user = userEvent.setup();
    render(<PollControlPage poll={poll} common={POLLS_COMMON} />);

    await waitFor(() => {
      expect(screen.getByText('Poll control')).toBeInTheDocument();
    });

    const roleToggle = document.getElementById('poll-control-toggle-role');
    if (!(roleToggle instanceof HTMLInputElement)) {
      throw new Error('expected role toggle');
    }
    await user.click(roleToggle);

    await waitFor(() => {
      expect(pollsApi.persistPollControlState).toHaveBeenCalledWith(poll.slug, ['role']);
    });
  });
});
