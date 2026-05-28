import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PollWizard } from '@/components/polls/poll-wizard';
import { getPollContent, POLLS_COMMON } from '@/lib/polls';
import * as pollsApi from '@/lib/polls-api';

describe('PollWizard control gating', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows waiting state when no questions are enabled', async () => {
    const poll = getPollContent('workshop-food-jun-26');
    if (!poll) {
      throw new Error('expected poll fixture');
    }

    vi.spyOn(pollsApi, 'fetchPollControlState').mockResolvedValue({
      pollSlug: poll.slug,
      enabledQuestionIds: [],
    });

    render(<PollWizard poll={poll} common={POLLS_COMMON} />);

    await waitFor(() => {
      expect(screen.getByText('Please wait')).toBeInTheDocument();
    });
    expect(
      screen.getByText('The presenter will open the next question shortly.'),
    ).toBeInTheDocument();
  });
});
