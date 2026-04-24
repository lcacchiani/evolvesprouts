import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InstanceDetailPanel } from '@/components/admin/services/instance-detail-panel';
import * as entityApi from '@/lib/entity-api';
import type { LocationSummary, ServiceSummary } from '@/types/services';

vi.mock('@/lib/entity-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/entity-api')>('@/lib/entity-api');
  return {
    ...actual,
    listEntityPartnerOrganizationPicker: vi.fn().mockResolvedValue([]),
  };
});

function buildServiceSummary(overrides: Partial<ServiceSummary> = {}): ServiceSummary {
  return {
    id: 'service-1',
    instancesCount: 0,
    serviceType: 'training_course',
    title: 'Alpha service',
    slug: null,
    bookingSystem: null,
    description: null,
    coverImageS3Key: null,
    deliveryMode: 'online',
    status: 'draft',
    createdBy: 'admin-sub',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    trainingDetails: null,
    eventDetails: null,
    ...overrides,
  };
}

const defaultEntityTagProps = {
  entityTags: [] as import('@/lib/entity-api').EntityTagRef[],
  entityTagsLoading: false,
  entityTagsError: '',
};

function buildLocationSummary(overrides: Partial<LocationSummary> = {}): LocationSummary {
  return {
    id: 'location-1',
    name: null,
    areaId: 'area-1',
    address: 'Central Studio',
    lat: null,
    lng: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    lockedFromPartnerOrg: false,
    partnerOrganizationLabels: [],
    ...overrides,
  };
}

describe('InstanceDetailPanel', () => {
  beforeEach(() => {
    vi.mocked(entityApi.listEntityPartnerOrganizationPicker).mockResolvedValue([]);
  });

  it('renders service and location selectors in create mode', () => {
    render(
      <InstanceDetailPanel
        {...defaultEntityTagProps}
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
    expect(screen.getByLabelText('Referral slug')).toBeDisabled();
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.getByLabelText('Waitlist')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add instance' })).not.toBeInTheDocument();
  });

  it('routes create action with selected service id', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <InstanceDetailPanel
        {...defaultEntityTagProps}
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
        partner_organization_ids: [],
        tag_ids: [],
      })
    );
  });

  it('includes selected tag ids when Tags picker is used', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <InstanceDetailPanel
        entityTags={[{ id: 'tag-alpha', name: 'Alpha', color: null }]}
        entityTagsLoading={false}
        entityTagsError=''
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

    await user.click(screen.getByText('Tags'));
    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Add instance' }));

    expect(onCreate).toHaveBeenCalledWith(
      'service-1',
      expect.objectContaining({
        tag_ids: ['tag-alpha'],
      })
    );
  });

  it('forwards service dropdown changes', async () => {
    const user = userEvent.setup();
    const onSelectService = vi.fn();

    render(
      <InstanceDetailPanel
        {...defaultEntityTagProps}
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

  it('prefills title, description, delivery, and training pricing from the selected service', async () => {
    const user = userEvent.setup();
    const onSelectService = vi.fn();

    render(
      <InstanceDetailPanel
        {...defaultEntityTagProps}
        instance={null}
        selectedServiceId={null}
        serviceOptions={[
          buildServiceSummary({
            description: 'Service body',
            deliveryMode: 'hybrid',
            trainingDetails: {
              pricingUnit: 'per_family',
              defaultPrice: '199.00',
              defaultCurrency: 'USD',
            },
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
    expect(screen.getByLabelText('Pricing unit')).toHaveValue('per_family');
    expect(screen.getByLabelText('Price')).toHaveValue('199.00');
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
  });

  it('inherits event category from the selected service and omits category select for event instances', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <InstanceDetailPanel
        {...defaultEntityTagProps}
        instance={null}
        selectedServiceId='evt-svc'
        serviceOptions={[
          buildServiceSummary({
            id: 'evt-svc',
            serviceType: 'event',
            title: 'Spring open house',
            trainingDetails: null,
            eventDetails: {
              eventCategory: 'open_house',
              defaultPrice: '50.00',
              defaultCurrency: 'HKD',
            },
          }),
        ]}
        locationOptions={[buildLocationSummary()]}
        isLoadingLocations={false}
        serviceType='event'
        isLoading={false}
        error=''
        onSelectService={vi.fn()}
        onCancelSelection={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Event category')).toHaveValue('Open House');
    });
    expect(screen.queryByRole('combobox', { name: 'Event category' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Instructor')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Price')).toHaveValue('50.00');
    });
    expect(screen.getByLabelText('External URL')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add instance' }));

    expect(onCreate).toHaveBeenCalledWith(
      'evt-svc',
      expect.objectContaining({
        event_ticket_tiers: [
          expect.objectContaining({
            name: 'open_house',
            price: '50.00',
            currency: 'HKD',
          }),
        ],
        partner_organization_ids: [],
        tag_ids: [],
      })
    );
  });
});
