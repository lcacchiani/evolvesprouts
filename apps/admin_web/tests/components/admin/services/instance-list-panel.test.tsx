import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstanceListPanel } from '@/components/admin/services/instance-list-panel';
import type { ServiceInstance } from '@/types/services';

const BASE_INSTANCE: ServiceInstance = {
  id: 'instance-1',
  serviceId: 'service-1',
  parentServiceTitle: 'Parent service',
  parentServiceTier: null,
  parentServiceType: null,
  parentServiceKey: null,
  title: null,
  slug: 'instance-one',
  description: null,
  coverImageS3Key: null,
  status: 'open',
  deliveryMode: null,
  locationId: null,
  maxCapacity: null,
  waitlistEnabled: false,
  externalUrl: null,
  partnerOrganizations: [],
  instructorId: null,
  cohort: null,
  notes: null,
  tagIds: [],
  createdBy: 'admin-sub',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  resolvedTitle: 'Resolved title',
  resolvedSlug: 'instance-one',
  resolvedDescription: null,
  resolvedCoverImageS3Key: null,
  resolvedDeliveryMode: null,
  resolvedLocationId: null,
  sessionSlots: [],
  trainingDetails: null,
  resolvedTrainingDetails: null,
  eventTicketTiers: [],
  resolvedEventTicketTiers: [],
  consultationDetails: null,
  resolvedConsultationDetails: null,
};

describe('InstanceListPanel', () => {
  it('renders instance rows without booking badges', () => {
    render(
      <InstanceListPanel
        instances={[BASE_INSTANCE]}
        selectedInstanceId={null}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error=''
        isMutating={false}
        onSelectInstance={vi.fn()}
        onLoadMore={vi.fn()}
        onDuplicateInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        showServiceColumn
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Parent service')).toBeInTheDocument();
    expect(screen.queryByText('Booking')).toBeNull();
  });
});
