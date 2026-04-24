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
  instancesCount: 0,
  serviceType: 'training_course',
  title: 'Service title',
  slug: null,
  bookingSystem: null,
  description: null,
  coverImageS3Key: null,
  deliveryMode: 'in_person',
  status: 'published',
  serviceTier: null,
  locationId: null,
  createdBy: 'admin-sub',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  trainingDetails: null,
  eventDetails: null,
  consultationDetails: null,
};

const INSTANCE_FIXTURE: ServiceInstance = {
  id: 'instance-1',
  serviceId: 'service-1',
  parentServiceTitle: null,
  parentServiceType: null,
  title: null,
  slug: null,
  description: null,
  coverImageS3Key: null,
  status: 'in_progress',
  deliveryMode: null,
  locationId: null,
  maxCapacity: null,
  waitlistEnabled: false,
  externalUrl: null,
  partnerOrganizations: [],
  instructorId: null,
  notes: null,
  tagIds: [],
  createdBy: 'admin-sub',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  resolvedTitle: 'Resolved title',
  cohort: 'spring-2024',
  resolvedSlug: null,
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

const DISCOUNT_REFERRAL_FIXTURE: DiscountCode = {
  ...DISCOUNT_CODE_FIXTURE,
  id: 'discount-ref',
  code: 'TRACK',
  discountType: 'referral',
  discountValue: '0',
};

describe('services tables value formatting', () => {
  it('formats enum values in service list table rows', () => {
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
        onDuplicateService={vi.fn()}
        onDeleteService={vi.fn()}
      />
    );

    const table = screen.getByRole('table');
    expect(within(table).getByText('Training Course')).toBeInTheDocument();
    expect(within(table).getByText('Published')).toBeInTheDocument();
    expect(within(table).getByText('In Person')).toBeInTheDocument();
    expect(within(table).getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('disables delete when the service has instances', () => {
    const withInstances: ServiceSummary = { ...SERVICE_FIXTURE, instancesCount: 2 };
    render(
      <ServiceListPanel
        services={[withInstances]}
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
        onDuplicateService={vi.fn()}
        onDeleteService={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /cannot delete service while it has instances/i })).toBeDisabled();
  });

  it('formats enum values in instance and discount tables', () => {
    render(
      <>
        <InstanceListPanel
          instances={[{ ...INSTANCE_FIXTURE, parentServiceTitle: 'Yoga' }]}
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
        />
        <DiscountCodesPanel
          codes={[DISCOUNT_CODE_FIXTURE, DISCOUNT_REFERRAL_FIXTURE]}
          filters={{ active: '', search: '', scope: '' }}
          isLoading={false}
          isLoadingMore={false}
          isSaving={false}
          hasMore={false}
          error=''
          serviceOptions={[SERVICE_FIXTURE]}
          onFilterChange={vi.fn()}
          onLoadMore={vi.fn()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      </>
    );

    const tables = screen.getAllByRole('table');
    const instanceTable = tables[0] as HTMLElement;
    expect(within(instanceTable).getByText('In Progress')).toBeInTheDocument();
    expect(within(instanceTable).getByText('Spring 2024')).toBeInTheDocument();
    expect(within(instanceTable).getByText('Unlimited')).toBeInTheDocument();
    expect(within(tables[1] as HTMLElement).getByText('SAVE10')).toBeInTheDocument();
    expect(within(tables[1] as HTMLElement).getByText('10%')).toBeInTheDocument();
    expect(within(tables[1] as HTMLElement).getByText('Referral')).toBeInTheDocument();
    const currencySelect = screen.getByLabelText('Currency');
    expect(currencySelect.tagName).toBe('SELECT');
    expect(currencySelect).toBeDisabled();
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
