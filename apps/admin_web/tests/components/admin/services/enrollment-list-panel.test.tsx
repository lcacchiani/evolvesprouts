import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnrollmentListPanel } from '@/components/admin/services/enrollment-list-panel';
import type { Enrollment } from '@/types/services';

vi.mock('@/lib/services-api', () => ({
  isAbortRequestError: () => false,
  listEnrollmentDiscountOptions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/hooks/use-enrollment-parent-pickers', () => ({
  useEnrollmentParentPickers: () => ({
    contactOptions: [{ id: 'contact-1', label: 'Jane Doe' }],
    families: [{ id: 'family-1', label: 'Smith family' }],
    organizations: [{ id: 'org-1', label: 'Acme Org' }],
    loading: false,
    error: '',
    labelByContactId: new Map([['contact-1', 'Jane Doe']]),
    labelByFamilyId: new Map([['family-1', 'Smith family']]),
    labelByOrganizationId: new Map([['org-1', 'Acme Org']]),
  }),
}));

const ENROLLMENT_FIXTURE: Enrollment = {
  id: 'enrollment-1',
  instanceId: 'instance-1',
  contactId: 'contact-1',
  familyId: null,
  organizationId: null,
  ticketTierId: null,
  discountCodeId: null,
  status: 'registered',
  amountPaid: null,
  currency: 'HKD',
  enrolledAt: '2026-03-01T10:00:00Z',
  cancelledAt: null,
  notes: null,
  createdBy: 'admin-sub',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

describe('EnrollmentListPanel', () => {
  it('uses the same copy for create/edit and locks parent pickers in edit mode', () => {
    render(
      <EnrollmentListPanel
        enrollments={[ENROLLMENT_FIXTURE]}
        serviceId='service-1'
        instanceId='instance-1'
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

    expect(screen.getByText('Add or update an enrollment using the same fields below.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact')).toBeEnabled();
    expect(screen.getByLabelText('Family')).toBeEnabled();
    expect(screen.getByLabelText('Organization')).toBeEnabled();

    const table = screen.getByRole('table');
    const selectedRow = within(table).getByText('Jane Doe').closest('tr');
    expect(selectedRow).not.toBeNull();
    fireEvent.click(selectedRow as HTMLTableRowElement);

    expect(screen.getByText('Add or update an enrollment using the same fields below.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact')).toBeDisabled();
    expect(screen.getByLabelText('Family')).toBeDisabled();
    expect(screen.getByLabelText('Organization')).toBeDisabled();
  });

  it('uses selectable currency options in the enrollment editor', () => {
    render(
      <EnrollmentListPanel
        enrollments={[]}
        serviceId='service-1'
        instanceId='instance-1'
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

    const currencyField = screen.getByLabelText('Currency');
    expect(currencyField.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'HKD Hong Kong Dollar' })).toBeInTheDocument();
  });
});
