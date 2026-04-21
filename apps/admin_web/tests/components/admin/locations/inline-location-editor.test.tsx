import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InlineLocationEditor } from '@/components/admin/locations/inline-location-editor';

import { AdminApiError } from '@/lib/api-admin-client';

const baseArea = {
  id: 'area-1',
  parentId: null,
  name: 'Hong Kong',
  level: 'country' as const,
  code: 'HK',
  sovereignCountryId: null,
  active: true,
  displayOrder: 0,
};

describe('InlineLocationEditor', () => {
  it('renders State A summary when a location is provided', () => {
    render(
      <InlineLocationEditor
        stateKey='t1'
        location={{
          id: 'loc-1',
          name: 'Studio',
          areaId: 'area-1',
          address: '1 Road',
          lat: 22.1,
          lng: 114.2,
          createdAt: null,
          updatedAt: null,
          lockedFromPartnerOrg: false,
          partnerOrganizationLabels: [],
        }}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={vi.fn()}
        onSaveUpdate={vi.fn()}
        onClear={vi.fn()}
        onGeocode={vi.fn()}
      />
    );

    expect(screen.getByText('1 Road · Hong Kong')).toBeInTheDocument();
    expect(screen.getByText('22.10000, 114.20000')).toBeInTheDocument();
  });

  it('disables Save location until an area is selected', async () => {
    const user = userEvent.setup();
    const onSaveCreate = vi.fn();

    render(
      <InlineLocationEditor
        stateKey='new-empty'
        location={null}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={onSaveCreate}
        onSaveUpdate={vi.fn()}
        onClear={vi.fn()}
        onGeocode={vi.fn()}
      />
    );

    const saveBtn = screen.getByRole('button', { name: 'Save location' });
    expect(saveBtn).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Geographic area'), 'area-1');
    await user.type(screen.getByLabelText('Address'), 'Somewhere');

    await waitFor(() => {
      expect(saveBtn).not.toBeDisabled();
    });
  });

  it('geocode success updates lat/lng', async () => {
    const user = userEvent.setup();
    const onGeocode = vi.fn().mockResolvedValue({ lat: 22.3193, lng: 114.1694 });

    render(
      <InlineLocationEditor
        stateKey='g1'
        location={null}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={vi.fn()}
        onSaveUpdate={vi.fn()}
        onClear={vi.fn()}
        onGeocode={onGeocode}
      />
    );

    await user.selectOptions(screen.getByLabelText('Geographic area'), 'area-1');
    await user.type(screen.getByLabelText('Address'), '1 Test Road');
    await user.click(screen.getByRole('button', { name: 'Fill coordinates from address' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Latitude')).toHaveValue('22.3193');
      expect(screen.getByLabelText('Longitude')).toHaveValue('114.1694');
    });
  });

  it('geocode 404 shows environment copy', async () => {
    const user = userEvent.setup();
    const onGeocode = vi
      .fn()
      .mockRejectedValue(new AdminApiError({ statusCode: 404, message: 'nope', payload: null }));

    render(
      <InlineLocationEditor
        stateKey='g404'
        location={null}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={vi.fn()}
        onSaveUpdate={vi.fn()}
        onClear={vi.fn()}
        onGeocode={onGeocode}
      />
    );

    await user.selectOptions(screen.getByLabelText('Geographic area'), 'area-1');
    await user.type(screen.getByLabelText('Address'), 'Somewhere');
    await user.click(screen.getByRole('button', { name: 'Fill coordinates from address' }));

    await waitFor(() => {
      expect(
        screen.getByText('Geocoding is not available in this environment yet.')
      ).toBeInTheDocument();
    });
  });

  it('does not show propagation helper on create-new path', () => {
    render(
      <InlineLocationEditor
        stateKey='new1'
        location={null}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={vi.fn()}
        onSaveUpdate={vi.fn()}
        onClear={vi.fn()}
        onGeocode={vi.fn()}
      />
    );

    expect(
      screen.queryByText('Editing updates this location wherever it is used.')
    ).not.toBeInTheDocument();
  });

  it('PATCH update sends partial fields without name', async () => {
    const user = userEvent.setup();
    const onSaveUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <InlineLocationEditor
        stateKey='patch1'
        location={{
          id: 'loc-1',
          name: 'Central Studio',
          areaId: 'area-1',
          address: '1 Road',
          lat: 22,
          lng: 114,
          createdAt: null,
          updatedAt: null,
          lockedFromPartnerOrg: false,
          partnerOrganizationLabels: [],
        }}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={vi.fn()}
        onSaveUpdate={onSaveUpdate}
        onClear={vi.fn()}
        onGeocode={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.clear(screen.getByLabelText('Address'));
    await user.type(screen.getByLabelText('Address'), '2 Road');
    await user.click(screen.getByRole('button', { name: 'Update location' }));

    await waitFor(() => {
      expect(onSaveUpdate).toHaveBeenCalledWith('loc-1', {
        area_id: 'area-1',
        address: '2 Road',
        lat: 22,
        lng: 114,
      });
    });
    expect(onSaveUpdate.mock.calls[0][1]).not.toHaveProperty('name');
  });

  it('allowClearWhenLocked shows Clear without Change', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(
      <InlineLocationEditor
        stateKey='ac1'
        location={{
          id: 'loc-1',
          name: null,
          areaId: 'area-1',
          address: 'A',
          lat: null,
          lng: null,
          createdAt: null,
          updatedAt: null,
          lockedFromPartnerOrg: true,
          partnerOrganizationLabels: ['X'],
        }}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        allowClearWhenLocked
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={vi.fn()}
        onSaveUpdate={vi.fn()}
        onClear={onClear}
        onGeocode={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('partner-org-locked: hides Change and Clear and shows managed note', () => {
    render(
      <InlineLocationEditor
        stateKey='lock1'
        location={{
          id: 'loc-1',
          name: null,
          areaId: 'area-1',
          address: 'A',
          lat: null,
          lng: null,
          createdAt: null,
          updatedAt: null,
          lockedFromPartnerOrg: true,
          partnerOrganizationLabels: ['Partner Co'],
        }}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={vi.fn()}
        onSaveUpdate={vi.fn()}
        onClear={vi.fn()}
        onGeocode={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByText(/Managed from the partner organisation \(Partner Co\)/)).toBeInTheDocument();
  });

  it('Clear calls onClear and does not call onSaveUpdate', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onSaveUpdate = vi.fn();

    render(
      <InlineLocationEditor
        stateKey='clear1'
        location={{
          id: 'loc-1',
          name: null,
          areaId: 'area-1',
          address: 'A',
          lat: null,
          lng: null,
          createdAt: null,
          updatedAt: null,
          lockedFromPartnerOrg: false,
          partnerOrganizationLabels: [],
        }}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveCreate={vi.fn()}
        onSaveUpdate={onSaveUpdate}
        onClear={onClear}
        onGeocode={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalled();
    expect(onSaveUpdate).not.toHaveBeenCalled();
  });

  it('Cancel in edit-existing restores read state', async () => {
    const user = userEvent.setup();
    const onCancelEdit = vi.fn();

    render(
      <InlineLocationEditor
        stateKey='cancel1'
        location={{
          id: 'loc-1',
          name: null,
          areaId: 'area-1',
          address: 'Original',
          lat: null,
          lng: null,
          createdAt: null,
          updatedAt: null,
          lockedFromPartnerOrg: false,
          partnerOrganizationLabels: [],
        }}
        areas={[baseArea]}
        areasLoading={false}
        canModify
        isSaving={false}
        onRequestEdit={vi.fn()}
        onCancelEdit={onCancelEdit}
        onSaveCreate={vi.fn()}
        onSaveUpdate={vi.fn()}
        onClear={vi.fn()}
        onGeocode={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.clear(screen.getByLabelText('Address'));
    await user.type(screen.getByLabelText('Address'), 'Edited');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Original · Hong Kong')).toBeInTheDocument();
    expect(onCancelEdit).toHaveBeenCalled();
  });
});
