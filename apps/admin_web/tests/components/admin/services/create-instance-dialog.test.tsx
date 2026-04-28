import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { CreateInstanceDialog } from '@/components/admin/services/create-instance-dialog';
import type { ServiceSummary } from '@/types/services';

const trainingServiceSummary: ServiceSummary = {
  id: 'svc-1',
  instancesCount: 0,
  serviceType: 'training_course',
  title: 'Training',
  slug: 'training-template',
  bookingSystem: null,
  description: null,
  coverImageS3Key: null,
  deliveryMode: 'online',
  status: 'published',
  createdBy: 'admin',
  createdAt: null,
  updatedAt: null,
  serviceTier: null,
  locationId: null,
  trainingDetails: null,
  eventDetails: null,
  consultationDetails: null,
};

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

    const { rerender } = render(
      <CreateInstanceDialog
        open
        serviceType='training_course'
        serviceSummary={trainingServiceSummary}
        serviceDefaultLocationId={venueId}
        isLoading={false}
        error=''
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^slug/i)).toHaveValue('training-template');
    });

    const withTier: ServiceSummary = {
      ...trainingServiceSummary,
      slug: 'bla-bla-bla',
      serviceTier: '1-3',
    };
    rerender(
      <CreateInstanceDialog
        open
        serviceType='training_course'
        serviceSummary={withTier}
        serviceDefaultLocationId={venueId}
        isLoading={false}
        error=''
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    const slugInput = screen.getByLabelText(/^slug/i) as HTMLInputElement;
    await waitFor(() => {
      expect(slugInput).toHaveValue('bla-bla-bla-1-3');
    });

    await user.type(screen.getByLabelText('Cohort'), 'may-26');
    await waitFor(() => {
      expect(slugInput).toHaveValue('bla-bla-bla-1-3-may-26');
    });

    await user.clear(screen.getByLabelText('Cohort'));
    await waitFor(() => {
      expect(slugInput).toHaveValue('bla-bla-bla-1-3');
    });

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
        slug: 'bla-bla-bla-1-3',
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

  it('auto-populates event slug from title and first session slot date until slug is edited', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const eventService: ServiceSummary = {
      ...trainingServiceSummary,
      id: 'evt-svc',
      serviceType: 'event',
      title: 'Events',
      slug: 'events',
    };

    const { rerender } = render(
      <CreateInstanceDialog
        open={false}
        serviceType='event'
        serviceSummary={eventService}
        isLoading={false}
        error=''
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    rerender(
      <CreateInstanceDialog
        open
        serviceType='event'
        serviceSummary={eventService}
        isLoading={false}
        error=''
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    const slugInput = screen.getByLabelText(/^slug/i) as HTMLInputElement;
    await waitFor(() => {
      expect(slugInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    await user.click(screen.getByText('Session slots'));
    await user.click(screen.getByRole('button', { name: /add slot/i }));
    const startInput = screen.getByLabelText('Start time');
    await user.clear(startInput);
    await user.type(startInput, '2026-04-20T14:00');

    await waitFor(() => {
      expect(slugInput.value.endsWith('2026-04-20')).toBe(true);
    });

    await user.type(screen.getByLabelText('Title'), 'Spring Gala');
    await waitFor(() => {
      expect(slugInput.value).toBe('spring-gala-2026-04-20');
    });

    await user.clear(slugInput);
    await user.type(slugInput, 'custom-slug');
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Ignored');
    expect(slugInput).toHaveValue('custom-slug');
  });

  it('shows inline error when event slug is empty on submit', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const eventService: ServiceSummary = {
      ...trainingServiceSummary,
      id: 'evt-svc-2',
      serviceType: 'event',
      title: 'Events',
      slug: 'events',
    };

    render(
      <CreateInstanceDialog
        open
        serviceType='event'
        serviceSummary={eventService}
        isLoading={false}
        error=''
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    await user.type(screen.getByLabelText(/default price/i), '25');

    const slugInput = screen.getByLabelText(/^slug/i);
    await user.clear(slugInput);
    await user.click(screen.getByRole('button', { name: 'Submit dialog' }));
    expect(
      screen.getByText(/slug is required for event and training_course instances/i)
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('does not require slug for consultation create', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateInstanceDialog
        open
        serviceType='consultation'
        isLoading={false}
        error=''
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    const slugLabel = screen.getByText('Slug');
    expect(slugLabel.parentElement?.textContent).not.toMatch(/\*/);

    await user.click(screen.getByRole('button', { name: 'Submit dialog' }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ slug: null }));
  });
});
