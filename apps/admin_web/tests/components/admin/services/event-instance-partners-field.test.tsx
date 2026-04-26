import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventInstancePartnersField } from '@/components/admin/services/event-instance-partners-field';
import * as entityApi from '@/lib/entity-api';

vi.mock('@/lib/entity-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/entity-api')>('@/lib/entity-api');
  return {
    ...actual,
    listEntityPartnerOrganizationPicker: vi.fn(),
  };
});

describe('EventInstancePartnersField', () => {
  beforeEach(() => {
    vi.mocked(entityApi.listEntityPartnerOrganizationPicker).mockResolvedValue([
      { id: 'live-1', label: 'Live Org' },
    ]);
  });

  it('keeps inactive (archived) partners when adding a picker org', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <EventInstancePartnersField
        value={[{ id: 'arch-1', name: 'Archived Co', active: false, locationId: null }]}
        onChange={onChange}
      />
    );

    const select = await screen.findByLabelText('Partner organisations');
    await user.selectOptions(select, 'live-1');

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as { id: string; active: boolean }[];
    expect(next).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'arch-1', active: false }),
        expect.objectContaining({ id: 'live-1', active: true }),
      ])
    );
    expect(next).toHaveLength(2);
  });
});
