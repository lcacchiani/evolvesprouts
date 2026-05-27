import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PollLiveResultsPanel } from '@/components/polls/poll-live-results-panel';
import { POLLS_COMMON } from '@/lib/polls';
import * as pollsApi from '@/lib/polls-api';

describe('PollLiveResultsPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders select buckets with zero-filled options', async () => {
    vi.spyOn(pollsApi, 'fetchPollQuestionResults').mockResolvedValue({
      pollSlug: 'workshop-food-jun-26',
      questionId: 'role',
      questionType: 'select',
      totalResponses: 2,
      buckets: [{ label: 'Parent', count: 2 }],
    });

    render(
      <PollLiveResultsPanel
        pollSlug='workshop-food-jun-26'
        question={{
          id: 'role',
          type: 'select',
          screen: 'Who are you?',
          question: 'I am a...',
          options: ['Parent', 'Other'],
          showAnswer: false,
          showResults: true,
        }}
        common={POLLS_COMMON}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Room results')).toBeInTheDocument();
    });
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('2 responses so far')).toBeInTheDocument();
  });
});
