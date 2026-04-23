import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceDetailPanel } from '@/components/admin/services/service-detail-panel';
import * as servicesApi from '@/lib/services-api';
import type { ServiceDetail } from '@/types/services';

function buildService(overrides: Partial<ServiceDetail> = {}): ServiceDetail {
  return {
    id: 'service-1',
    serviceType: 'training_course',
    title: 'Alpha service',
    slug: null,
    bookingSystem: null,
    description: 'Alpha description',
    coverImageS3Key: null,
    deliveryMode: 'online',
    status: 'draft',
    createdBy: 'admin',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
    tagIds: [],
    assetIds: [],
    instancesCount: 0,
    trainingDetails: {
      pricingUnit: 'per_person',
      defaultPrice: null,
      defaultCurrency: null,
    },
    eventDetails: null,
    consultationDetails: null,
    ...overrides,
  };
}

describe('ServiceDetailPanel', () => {
  beforeEach(() => {
    vi.spyOn(servicesApi, 'getServiceDiscountCodeUsageSummary').mockResolvedValue({
      summary: { totalCurrentUses: 0, referencingCodeCount: 0 },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes form values from service props per mount', () => {
    const onUpdate = vi.fn();
    const onCreate = vi.fn();
    const onUploadCover = vi.fn();
    const onCancelSelection = vi.fn();

    const { rerender } = render(
      <ServiceDetailPanel
        key='create'
        service={null}
        isLoading={false}
        error=''
        onCancelSelection={onCancelSelection}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onUploadCover={onUploadCover}
      />
    );

    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('draft');

    rerender(
      <ServiceDetailPanel
        key='service-1'
        service={buildService()}
        isLoading={false}
        error=''
        onCancelSelection={onCancelSelection}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onUploadCover={onUploadCover}
      />
    );

    expect(screen.getByLabelText('Title')).toHaveValue('Alpha service');
    expect(screen.getByLabelText('Description')).toHaveValue('Alpha description');
    expect(screen.getByLabelText('Status')).toHaveValue('draft');

    rerender(
      <ServiceDetailPanel
        key='service-2'
        service={buildService({
          id: 'service-2',
          title: 'Beta service',
          description: 'Beta description',
          status: 'published',
        })}
        isLoading={false}
        error=''
        onCancelSelection={onCancelSelection}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onUploadCover={onUploadCover}
      />
    );

    expect(screen.getByLabelText('Title')).toHaveValue('Beta service');
    expect(screen.getByLabelText('Description')).toHaveValue('Beta description');
    expect(screen.getByLabelText('Status')).toHaveValue('published');

    rerender(
      <ServiceDetailPanel
        key='create-again'
        service={null}
        isLoading={false}
        error=''
        onCancelSelection={onCancelSelection}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onUploadCover={onUploadCover}
      />
    );

    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('draft');
  });

  it('keeps service type visible and read-only in edit mode', () => {
    const onUpdate = vi.fn();
    const onCreate = vi.fn();
    const onUploadCover = vi.fn();
    const onCancelSelection = vi.fn();

    const { rerender } = render(
      <ServiceDetailPanel
        key='create'
        service={null}
        isLoading={false}
        error=''
        onCancelSelection={onCancelSelection}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onUploadCover={onUploadCover}
      />
    );

    const createModeServiceType = screen.getByLabelText('Type');
    expect(createModeServiceType).toBeEnabled();

    rerender(
      <ServiceDetailPanel
        key='edit'
        service={buildService({
          serviceType: 'consultation',
        })}
        isLoading={false}
        error=''
        onCancelSelection={onCancelSelection}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onUploadCover={onUploadCover}
      />
    );

    const editModeServiceType = screen.getByLabelText('Type');
    expect(editModeServiceType).toBeDisabled();
    expect(editModeServiceType).toHaveValue('consultation');
  });

  it('lays out event fields in one row with delivery mode and omits placeholder pricing', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onCreate = vi.fn();
    const onUploadCover = vi.fn();
    const onCancelSelection = vi.fn();

    render(
      <ServiceDetailPanel
        service={null}
        isLoading={false}
        error=''
        onCancelSelection={onCancelSelection}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onUploadCover={onUploadCover}
      />
    );

    await user.selectOptions(screen.getByLabelText('Type'), 'event');

    expect(screen.getByLabelText('Delivery mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Event category')).toBeInTheDocument();
    expect(screen.getByLabelText('Booking system')).toBeInTheDocument();
    expect(screen.getByLabelText('Cover file name')).toBeInTheDocument();
    expect(screen.queryAllByLabelText('Booking system')).toHaveLength(1);
    expect(screen.queryByText('Pricing unit')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Default price')).toBeInTheDocument();
  });

  it('labels training course default amount as Default price', async () => {
    const user = userEvent.setup();
    render(
      <ServiceDetailPanel
        service={null}
        isLoading={false}
        error=''
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onUploadCover={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText('Type'), 'training_course');

    expect(screen.getByLabelText('Default price')).toBeInTheDocument();
  });

  it('shows consultation Row D/E fields without Calendly', async () => {
    const user = userEvent.setup();
    render(
      <ServiceDetailPanel
        service={null}
        isLoading={false}
        error=''
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onUploadCover={vi.fn()}
      />
    );
    await user.selectOptions(screen.getByLabelText('Type'), 'consultation');
    expect(screen.getByLabelText('Consultation format')).toBeInTheDocument();
    expect(screen.getByLabelText('Pricing model')).toBeInTheDocument();
    expect(screen.getByLabelText('Max group size')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Calendly/i)).not.toBeInTheDocument();
  });
});
