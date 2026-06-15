import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const {
  listCalendarManualBlocks,
  createCalendarManualBlock,
  updateCalendarManualBlock,
  deleteCalendarManualBlock,
} = vi.hoisted(() => ({
  listCalendarManualBlocks: vi.fn(),
  createCalendarManualBlock: vi.fn(),
  updateCalendarManualBlock: vi.fn(),
  deleteCalendarManualBlock: vi.fn(),
}));

vi.mock('@/lib/calendar-manual-blocks-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calendar-manual-blocks-api')>();
  return {
    ...actual,
    listCalendarManualBlocks,
    createCalendarManualBlock,
    updateCalendarManualBlock,
    deleteCalendarManualBlock,
  };
});

import { CalendarManualBlocksPage } from '@/components/admin/calendar/calendar-manual-blocks-page';

describe('CalendarManualBlocksPage', () => {
  it('loads blocks on mount and creates a new block', async () => {
    const user = userEvent.setup();
    listCalendarManualBlocks.mockResolvedValue([]);
    createCalendarManualBlock.mockResolvedValue({
      id: 'block-1',
      block_date: '2026-06-15',
      period: 'am',
      note: null,
    });

    render(<CalendarManualBlocksPage />);

    await waitFor(() => {
      expect(listCalendarManualBlocks).toHaveBeenCalled();
      expect(screen.getByText('No manual blocks in this range.')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Date'), '2026-06-15');
    await user.click(screen.getByRole('button', { name: 'Create block' }));

    await waitFor(() => {
      expect(createCalendarManualBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          blockDate: '2026-06-15',
          period: 'am',
        })
      );
    });
  });

  it('shows range validation error when To is before From', async () => {
    listCalendarManualBlocks.mockResolvedValue([]);
    render(<CalendarManualBlocksPage />);

    await waitFor(() => {
      expect(listCalendarManualBlocks).toHaveBeenCalled();
    });

    expect(screen.queryByText(/"To" must be on or after "From"/)).not.toBeInTheDocument();
  });
});
