import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const createDraftInvoice = vi.fn();

vi.mock('@/lib/billing-api', () => ({
  createDraftInvoice,
}));

vi.mock('@/hooks/use-enrollment-parent-pickers', () => ({
  useEnrollmentParentPickers: () => ({
    contactOptions: [{ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', label: 'Pat Contact' }],
    families: [],
    organizations: [],
    loading: false,
    error: '',
    labelByContactId: new Map(),
    labelByFamilyId: new Map(),
    labelByOrganizationId: new Map(),
  }),
}));

import { CustomizedDraftInvoiceCard } from '@/components/admin/finance/customized-draft-invoice-card';

describe('CustomizedDraftInvoiceCard', () => {
  it('submits customized draft with draftKind and billTo', async () => {
    createDraftInvoice.mockResolvedValue({ invoiceId: 'inv-x', status: 'draft' });
    const onCreated = vi.fn();

    render(
      <CustomizedDraftInvoiceCard
        defaultCurrency='HKD'
        currencyOptions={[{ value: 'HKD', label: 'HKD' }]}
        editorBusy={false}
        loadParents
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

    await userEvent.click(screen.getByRole('button', { name: 'Create draft invoice from custom lines' }));

    await waitFor(() => {
      expect(createDraftInvoice).toHaveBeenCalled();
    });
    expect(createDraftInvoice.mock.calls[0][0]).toMatchObject({
      draftKind: 'customized_manual',
      billTo: { kind: 'contact', contactId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
      currency: 'HKD',
      lines: [{ description: 'Line A', quantity: '1', unitAmount: '25' }],
    });
    expect(onCreated).toHaveBeenCalledWith('inv-x');
  });
});
