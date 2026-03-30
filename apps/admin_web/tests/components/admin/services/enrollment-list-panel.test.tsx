import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnrollmentListPanel } from '@/components/admin/services/enrollment-list-panel';
import type { Enrollment } from '@/types/services';

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
  it('uses the same copy for create/edit and locks parent IDs in edit mode', () => {
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

    expect(screen.getByText('Add or update an enrollment using the same fields below.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact ID')).toBeEnabled();
    expect(screen.getByLabelText('Family ID')).toBeEnabled();
    expect(screen.getByLabelText('Organization ID')).toBeEnabled();

    const selectedRow = screen.getByText('contact-1').closest('tr');
    expect(selectedRow).not.toBeNull();
    fireEvent.click(selectedRow as HTMLTableRowElement);

    expect(screen.getByText('Add or update an enrollment using the same fields below.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact ID')).toBeDisabled();
    expect(screen.getByLabelText('Family ID')).toBeDisabled();
    expect(screen.getByLabelText('Organization ID')).toBeDisabled();
  });

  it('uses selectable currency options in the enrollment editor', () => {
    render(
      <EnrollmentListPanel
        enrollments={[]}
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
