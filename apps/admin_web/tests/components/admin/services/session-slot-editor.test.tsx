import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionSlotEditor } from '@/components/admin/services/session-slot-editor';

describe('SessionSlotEditor', () => {
  it('renders column labels only on the first slot row', () => {
    render(
      <SessionSlotEditor
        slots={[
          {
            id: null,
            instanceId: null,
            locationId: null,
            startsAt: null,
            endsAt: null,
            sortOrder: 0,
          },
          {
            id: null,
            instanceId: null,
            locationId: null,
            startsAt: null,
            endsAt: null,
            sortOrder: 1,
          },
        ]}
        onChange={vi.fn()}
      />
    );

    const startLabels = screen.getAllByText('Start time');
    const endLabels = screen.getAllByText('End time');
    const locationLabels = screen.getAllByText('Location');
    const sortLabels = screen.getAllByText('Sort order');
    expect(startLabels).toHaveLength(1);
    expect(endLabels).toHaveLength(1);
    expect(locationLabels).toHaveLength(1);
    expect(sortLabels).toHaveLength(1);
  });
});
