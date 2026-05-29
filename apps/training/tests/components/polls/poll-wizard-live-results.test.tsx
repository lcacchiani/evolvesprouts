import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PollWizard } from '@/components/polls/poll-wizard';
import { getPollContent, POLLS_COMMON } from '@/lib/polls';
import * as pollsApi from '@/lib/polls-api';

describe('PollWizard live results', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('shows live results after answering a showResults question before advancing', async () => {
    const poll = getPollContent('workshop-food-jun-26');
    if (!poll) {
      throw new Error('expected poll fixture');
    }

    vi.spyOn(pollsApi, 'fetchPollControlState').mockResolvedValue({
      pollSlug: poll.slug,
      enabledQuestionIds: ['myth1'],
    });
    vi.spyOn(pollsApi, 'fetchPollSessionAnswers').mockResolvedValue({
      pollSlug: poll.slug,
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      answers: [],
    });
    vi.spyOn(pollsApi, 'persistPollAnswer').mockResolvedValue();
    vi.spyOn(pollsApi, 'fetchPollQuestionResults').mockResolvedValue({
      pollSlug: poll.slug,
      questionId: 'myth1',
      questionType: 'truefalse',
      totalResponses: 3,
      buckets: [
        { label: 'true', count: 1 },
        { label: 'false', count: 2 },
      ],
    });

    const user = userEvent.setup();
    render(<PollWizard poll={poll} common={POLLS_COMMON} />);

    await waitFor(() => {
      expect(
        screen.getByText('Children must finish everything on their plate.'),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'False' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => {
      expect(screen.getByText('Room results')).toBeInTheDocument();
    });
    expect(screen.getByText('3 responses so far')).toBeInTheDocument();
    expect(
      screen.queryByText('Children must finish everything on their plate.'),
    ).toBeNull();
  });
});
