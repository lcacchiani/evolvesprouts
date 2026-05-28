import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PollRoutePage from '@/app/polls/[slug]/page';
import { PollPage } from '@/components/polls/poll-page';
import { getPollContent, POLLS_COMMON } from '@/lib/polls';

const poll = getPollContent('workshop-food-jun-26');

vi.mock('@/lib/polls-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/polls-api')>();
  return {
    ...actual,
    persistPollAnswer: vi.fn().mockResolvedValue(undefined),
    fetchPollControlState: vi.fn().mockResolvedValue({
      pollSlug: 'workshop-food-jun-26',
      enabledQuestionIds: [
        'role',
        'challenge',
        'myth1',
        'myth2',
        'myth3',
        'myth4',
        'onething',
        'email',
      ],
    }),
    resolvePollApiConfig: vi.fn().mockReturnValue({ baseUrl: '/www', apiKey: 'test-key' }),
  };
});

describe('WorkshopFoodJun26PollPage', () => {
  it('renders poll title and first question screen', async () => {
    if (!poll) {
      throw new Error('Expected workshop-food-jun-26 poll content');
    }
    render(<PollPage poll={poll} common={POLLS_COMMON} />);
    expect(screen.getByRole('heading', { level: 1, name: poll.title })).toBeInTheDocument();
    const first = poll.questions[0];
    await waitFor(() => {
      expect(screen.getByText(first?.screen ?? '')).toBeInTheDocument();
    });
    expect(screen.getByText(first?.question ?? '')).toBeInTheDocument();
  });

  it('static route resolves workshop slug', async () => {
    const page = await PollRoutePage({
      params: Promise.resolve({ slug: 'workshop-food-jun-26' }),
    });
    render(page);
    expect(screen.getByRole('heading', { level: 1, name: poll?.title })).toBeInTheDocument();
  });

  it('advances after selecting an option and persists', async () => {
    if (!poll) {
      throw new Error('Expected workshop-food-jun-26 poll content');
    }
    const user = userEvent.setup();
    const { persistPollAnswer } = await import('@/lib/polls-api');

    render(<PollPage poll={poll} common={POLLS_COMMON} />);
    const first = poll.questions[0];
    if (!first || first.type !== 'select') {
      throw new Error('Expected first question to be select');
    }
    await waitFor(() => {
      expect(screen.getByLabelText(first.options[0] ?? '')).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(first.options[0] ?? ''));
    await user.click(screen.getByRole('button', { name: POLLS_COMMON.navigation.next }));

    expect(persistPollAnswer).toHaveBeenCalled();
    const second = poll.questions[1];
    expect(screen.getByText(second?.screen ?? '')).toBeInTheDocument();
  });

  it('shows results step for challenge question before continuing', async () => {
    if (!poll) {
      throw new Error('Expected workshop-food-jun-26 poll content');
    }
    const user = userEvent.setup();
    render(<PollPage poll={poll} common={POLLS_COMMON} />);

    const role = poll.questions[0];
    if (!role || role.type !== 'select') {
      throw new Error('Expected role select question');
    }
    await waitFor(() => {
      expect(screen.getByLabelText(role.options[0] ?? '')).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(role.options[0] ?? ''));
    await user.click(screen.getByRole('button', { name: POLLS_COMMON.navigation.next }));

    const challenge = poll.questions[1];
    if (!challenge || challenge.type !== 'select') {
      throw new Error('Expected challenge select question');
    }
    await user.click(screen.getByLabelText(challenge.options[0] ?? ''));
    await user.click(screen.getByRole('button', { name: POLLS_COMMON.navigation.next }));

    expect(screen.getByText(challenge.presenterNote ?? '')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: POLLS_COMMON.navigation.continue }),
    ).toBeInTheDocument();
  });
});
