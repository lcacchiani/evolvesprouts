import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DiscountCodesPanel } from '@/components/admin/services/discount-codes-panel';
import { EnrollmentListPanel } from '@/components/admin/services/enrollment-list-panel';
import { InstanceListPanel } from '@/components/admin/services/instance-list-panel';
import { ServiceListPanel } from '@/components/admin/services/service-list-panel';
import { formatDate } from '@/lib/format';
import type { DiscountCode, Enrollment, ServiceInstance, ServiceSummary } from '@/types/services';

const SERVICE_FIXTURE: ServiceSummary = {
  id: 'service-1',
  serviceType: 'training_course',
  title: 'Service title',
  description: null,
  coverImageS3Key: null,
  deliveryMode: 'in_person',
  status: 'published',
  createdBy: 'admin-sub',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

const INSTANCE_FIXTURE: ServiceInstance = {
  id: 'instance-1',
  serviceId: 'service-1',
  title: null,
  description: null,
  coverImageS3Key: null,
  status: 'in_progress',
  deliveryMode: null,
  locationId: null,
  maxCapacity: null,
  waitlistEnabled: false,
  instructorId: null,
  notes: null,
  createdBy: 'admin-sub',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  resolvedTitle: 'Resolved title',
  resolvedDescription: null,
  resolvedCoverImageS3Key: null,
  resolvedDeliveryMode: null,
  sessionSlots: [],
  trainingDetails: null,
  eventTicketTiers: [],
  consultationDetails: null,
};

const ENROLLMENT_FIXTURE: Enrollment = {
  id: 'enrollment-1',
  instanceId: 'instance-1',
  contactId: 'contact-1',
  familyId: null,
  organizationId: null,
  ticketTierId: null,
  discountCodeId: null,
  status: 'waitlisted',
  amountPaid: '1000',
  currency: 'HKD',
  enrolledAt: '2026-03-01T10:00:00Z',
  cancelledAt: null,
  notes: null,
  createdBy: 'admin-sub',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

const DISCOUNT_CODE_FIXTURE: DiscountCode = {
  id: 'discount-1',
  code: 'SAVE10',
  description: null,
  discountType: 'percentage',
  discountValue: '10',
  currency: 'HKD',
  validFrom: null,
  validUntil: null,
  serviceId: null,
  instanceId: null,
  maxUses: null,
  currentUses: 0,
  active: true,
  createdBy: 'admin-sub',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

describe('services tables value formatting', () => {
  it('formats enum and date values in service list table rows', () => {
    render(
      <ServiceListPanel
        services={[SERVICE_FIXTURE]}
        selectedServiceId={null}
        filters={{ serviceType: '', status: '', search: '' }}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error=''
        isMutating={false}
        onSelectService={vi.fn()}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onDeleteService={vi.fn()}
      />
    );

    const table = screen.getByRole('table');
    expect(within(table).getByText('Training Course')).toBeInTheDocument();
    expect(within(table).getByText('Published')).toBeInTheDocument();
    expect(within(table).getByText('In Person')).toBeInTheDocument();
    expect(within(table).getByText(formatDate(SERVICE_FIXTURE.createdAt))).toBeInTheDocument();
  });

  it('formats enum values in instance and discount tables', () => {
    render(
      <>
        <InstanceListPanel
          instances={[INSTANCE_FIXTURE]}
          selectedInstanceId={null}
          isLoading={false}
          isLoadingMore={false}
          hasMore={false}
          error=''
          isMutating={false}
          onSelectInstance={vi.fn()}
          onLoadMore={vi.fn()}
          onDeleteInstance={vi.fn()}
        />
        <DiscountCodesPanel
          codes={[DISCOUNT_CODE_FIXTURE]}
          filters={{ active: '', search: '' }}
          isLoading={false}
          isLoadingMore={false}
          isSaving={false}
          hasMore={false}
          error=''
          onFilterChange={vi.fn()}
          onLoadMore={vi.fn()}
          onCreate={vi.fn()}
          onDelete={vi.fn()}
        />
      </>
    );

    const tables = screen.getAllByRole('table');
    expect(within(tables[0] as HTMLElement).getByText('In Progress')).toBeInTheDocument();
    expect(within(tables[1] as HTMLElement).getByText('Percentage')).toBeInTheDocument();
  });

  it('formats enum and date values in enrollment table rows', () => {
    render(
      <EnrollmentListPanel
        enrollments={[ENROLLMENT_FIXTURE]}
        canCreate={true}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error=''
        isMutating={false}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const table = screen.getByRole('table');
    expect(within(table).getByText('Waitlisted')).toBeInTheDocument();
    expect(within(table).getByText(formatDate(ENROLLMENT_FIXTURE.enrolledAt))).toBeInTheDocument();
  });
});
