import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const billingMocks = vi.hoisted(() => ({
  createDraftInvoice: vi.fn(),
}));

vi.mock('@/lib/billing-api', () => ({
  createDraftInvoice: billingMocks.createDraftInvoice,
}));

vi.mock('@/hooks/use-enrollment-parent-pickers', () => ({
  useEnrollmentParentPickers: () => ({
    contactOptions: [{ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', label: 'Pat Contact' }],
    families: [],
    organizations: [],
    partnerOrganizations: [{ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', label: 'Partner Org' }],
    loading: false,
    error: '',
    labelByContactId: new Map(),
    labelByFamilyId: new Map(),
    labelByOrganizationId: new Map(),
    labelByPartnerOrganizationId: new Map(),
  }),
}));

import { CustomizedDraftInvoiceCard } from '@/components/admin/finance/customized-draft-invoice-card';

describe('CustomizedDraftInvoiceCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits customized draft with draftKind and billTo', async () => {
    billingMocks.createDraftInvoice.mockResolvedValue({ invoiceId: 'inv-x', status: 'draft' });
    const onCreated = vi.fn();

    render(
      <CustomizedDraftInvoiceCard
        defaultCurrency='HKD'
        currencyOptions={[{ value: 'HKD', label: 'HKD' }]}
        editorBusy={false}
        loadParents
        draftInvoiceDate='2025-06-01'
        onCreated={onCreated}
      />,
    );

    const form = document.getElementById('client-billing-customized-draft-form');
    expect(form).toBeTruthy();
    const desc = within(form as HTMLElement).getByLabelText(/^Description/i);
    await userEvent.type(desc, 'Line A');

    const unit = within(form as HTMLElement).getByLabelText(/^Unit price/i);
    await userEvent.clear(unit);
    await userEvent.type(unit, '25');

    await userEvent.selectOptions(
      screen.getByLabelText(/^Contact$/i),
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    );

    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(billingMocks.createDraftInvoice).toHaveBeenCalled();
    });
    expect(billingMocks.createDraftInvoice.mock.calls[0][0]).toMatchObject({
      draftKind: 'customized_manual',
      billTo: { kind: 'contact', contactId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
      currency: 'HKD',
      lines: [{ description: 'Line A', quantity: '1', unitAmount: '25' }],
      invoiceDate: '2025-06-01',
    });
    expect(onCreated).toHaveBeenCalledWith('inv-x');
  });

  it('submits partner bill-to as organization with selected partner org id', async () => {
    billingMocks.createDraftInvoice.mockResolvedValue({ invoiceId: 'inv-p', status: 'draft' });

    render(
      <CustomizedDraftInvoiceCard
        defaultCurrency='HKD'
        currencyOptions={[{ value: 'HKD', label: 'HKD' }]}
        editorBusy={false}
        loadParents
        draftInvoiceDate='2025-06-01'
        onCreated={vi.fn()}
      />,
    );

    const form = document.getElementById('client-billing-customized-draft-form');
    expect(form).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText(/^Bill to$/i), 'partner');
    await userEvent.selectOptions(
      screen.getByLabelText(/^Partner organization$/i),
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    );

    const desc = within(form as HTMLElement).getByLabelText(/^Description/i);
    await userEvent.type(desc, 'Partner fee');

    const unit = within(form as HTMLElement).getByLabelText(/^Unit price/i);
    await userEvent.clear(unit);
    await userEvent.type(unit, '99');

    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(billingMocks.createDraftInvoice).toHaveBeenCalled();
    });
    expect(billingMocks.createDraftInvoice.mock.calls[0][0]).toMatchObject({
      draftKind: 'customized_manual',
      billTo: { kind: 'organization', organizationId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
      lines: [{ description: 'Partner fee', quantity: '1', unitAmount: '99' }],
      invoiceDate: '2025-06-01',
    });
  });

});
