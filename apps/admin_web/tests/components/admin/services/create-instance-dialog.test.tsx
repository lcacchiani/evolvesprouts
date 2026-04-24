import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { CreateInstanceDialog } from '@/components/admin/services/create-instance-dialog';

vi.mock('@/components/ui/form-dialog', () => ({
  FormDialog: ({
    children,
    onSubmit,
  }: {
    children: ReactNode;
    onSubmit: () => void | Promise<void>;
  }) => (
    <div>
      {children}
      <button type='button' onClick={() => void onSubmit()}>
        Submit dialog
      </button>
    </div>
  ),
}));

describe('CreateInstanceDialog', () => {
  beforeAll(() => {
    process.env.TZ = 'UTC';
  });

  it('uses service default location for session slot prefill when instance location is empty', async () => {
    const user = userEvent.setup();
    const venueId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateInstanceDialog
        open
        serviceType='training_course'
        serviceDefaultLocationId={venueId}
        isLoading={false}
        error=''
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    await user.click(screen.getByText('Session slots'));
    await user.click(screen.getByRole('button', { name: /add slot/i }));
    const startInput = screen.getByLabelText('Start time');
    await user.type(startInput, '2026-09-01T10:00');

    const slotLocation = document.getElementById('slot-0-location') as HTMLInputElement;
    expect(slotLocation).toBeTruthy();
    expect(slotLocation.value).toBe(venueId);

    await user.click(screen.getByRole('button', { name: 'Submit dialog' }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        session_slots: [
          expect.objectContaining({
            location_id: venueId,
            starts_at: '2026-09-01T10:00:00.000Z',
            ends_at: '2026-09-01T12:00:00.000Z',
          }),
        ],
      })
    );
  });
});
