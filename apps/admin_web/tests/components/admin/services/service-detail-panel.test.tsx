import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ServiceDetailPanel } from '@/components/admin/services/service-detail-panel';
import type { ServiceDetail } from '@/types/services';

function buildService(overrides: Partial<ServiceDetail> = {}): ServiceDetail {
  return {
    id: 'service-1',
    serviceType: 'training_course',
    title: 'Alpha service',
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
  it('syncs form values when selected service changes', () => {
    const onUpdate = vi.fn();
    const onCreate = vi.fn();
    const onUploadCover = vi.fn();
    const onCancelSelection = vi.fn();

    const { rerender } = render(
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
  });
});
