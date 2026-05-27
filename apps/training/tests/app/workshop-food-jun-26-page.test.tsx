import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PollRoutePage from '@/app/polls/[slug]/page';
import { PollPage } from '@/components/polls/poll-page';
import { getPollContent, POLLS_COMMON } from '@/lib/polls';

const poll = getPollContent('workshop-food-jun-26');

vi.mock('@/lib/polls-api', () => ({
  persistPollAnswer: vi.fn().mockResolvedValue(undefined),
  resolvePollApiConfig: vi.fn().mockReturnValue({ baseUrl: '/www', apiKey: 'test-key' }),
}));

describe('WorkshopFoodJun26PollPage', () => {
  it('renders poll title and first question', async () => {
    if (!poll) {
      throw new Error('Expected workshop-food-jun-26 poll content');
    }
    render(<PollPage poll={poll} common={POLLS_COMMON} />);
    expect(screen.getByRole('heading', { level: 1, name: poll.title })).toBeInTheDocument();
    expect(screen.getByText(poll.questions[0]?.text ?? '')).toBeInTheDocument();
  });

  it('static route resolves workshop slug', async () => {
    const page = await PollRoutePage({
      params: Promise.resolve({ slug: 'workshop-food-jun-26' }),
    });
    render(page);
    expect(screen.getByRole('heading', { level: 1, name: poll?.title })).toBeInTheDocument();
  });

  it('advances after selecting an answer and persists', async () => {
    if (!poll) {
      throw new Error('Expected workshop-food-jun-26 poll content');
    }
    const user = userEvent.setup();
    const { persistPollAnswer } = await import('@/lib/polls-api');

    render(<PollPage poll={poll} common={POLLS_COMMON} />);
    const first = poll.questions[0];
    if (!first || first.type !== 'choice') {
      throw new Error('Expected first question to be choice');
    }
    await user.click(screen.getByLabelText(first.answers[0]?.text ?? ''));
    await user.click(screen.getByRole('button', { name: POLLS_COMMON.navigation.next }));

    expect(persistPollAnswer).toHaveBeenCalled();
    expect(screen.getByText(poll.questions[1]?.text ?? '')).toBeInTheDocument();
  });
});
