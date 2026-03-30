import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InstanceDetailPanel } from '@/components/admin/services/instance-detail-panel';
import type { LocationSummary, ServiceSummary } from '@/types/services';

function buildServiceSummary(overrides: Partial<ServiceSummary> = {}): ServiceSummary {
  return {
    id: 'service-1',
    serviceType: 'training_course',
    title: 'Alpha service',
    description: null,
    coverImageS3Key: null,
    deliveryMode: 'online',
    status: 'draft',
    createdBy: 'admin-sub',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function buildLocationSummary(overrides: Partial<LocationSummary> = {}): LocationSummary {
  return {
    id: 'location-1',
    areaId: 'area-1',
    address: 'Central Studio',
    lat: null,
    lng: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('InstanceDetailPanel', () => {
  it('renders service and location selectors in create mode', () => {
    render(
      <InstanceDetailPanel
        instance={null}
        selectedServiceId={null}
        serviceOptions={[buildServiceSummary()]}
        locationOptions={[buildLocationSummary()]}
        isLoadingLocations={false}
        serviceType={null}
        isLoading={false}
        error=''
        onSelectService={vi.fn()}
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Service')).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add instance' })).not.toBeInTheDocument();
  });

  it('routes create action with selected service id', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <InstanceDetailPanel
        instance={null}
        selectedServiceId='service-1'
        serviceOptions={[buildServiceSummary()]}
        locationOptions={[buildLocationSummary()]}
        isLoadingLocations={false}
        serviceType='training_course'
        isLoading={false}
        error=''
        onSelectService={vi.fn()}
        onCancelSelection={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add instance' }));

    expect(onCreate).toHaveBeenCalledWith(
      'service-1',
      expect.objectContaining({
        status: 'scheduled',
      })
    );
  });

  it('forwards service dropdown changes', async () => {
    const user = userEvent.setup();
    const onSelectService = vi.fn();

    render(
      <InstanceDetailPanel
        instance={null}
        selectedServiceId='service-1'
        serviceOptions={[
          buildServiceSummary(),
          buildServiceSummary({
            id: 'service-2',
            title: 'Beta service',
            serviceType: 'consultation',
          }),
        ]}
        locationOptions={[buildLocationSummary()]}
        isLoadingLocations={false}
        serviceType='training_course'
        isLoading={false}
        error=''
        onSelectService={onSelectService}
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText('Service'), 'service-2');

    expect(onSelectService).toHaveBeenCalledWith('service-2');
  });

  it('prefills title, description, and delivery from the selected service', async () => {
    const user = userEvent.setup();
    const onSelectService = vi.fn();

    render(
      <InstanceDetailPanel
        instance={null}
        selectedServiceId={null}
        serviceOptions={[
          buildServiceSummary({
            description: 'Service body',
            deliveryMode: 'hybrid',
          }),
        ]}
        locationOptions={[buildLocationSummary()]}
        isLoadingLocations={false}
        serviceType={null}
        isLoading={false}
        error=''
        onSelectService={onSelectService}
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText('Service'), 'service-1');

    expect(onSelectService).toHaveBeenCalledWith('service-1');
    expect(screen.getByLabelText('Title')).toHaveValue('Alpha service');
    expect(screen.getByLabelText('Description')).toHaveValue('Service body');
    expect(screen.getByLabelText('Delivery mode')).toHaveValue('hybrid');
  });
});
