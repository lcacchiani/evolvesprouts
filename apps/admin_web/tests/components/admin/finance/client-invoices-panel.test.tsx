import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const billingMocks = vi.hoisted(() => ({
  listCustomerInvoices: vi.fn(),
  getCustomerInvoice: vi.fn(),
  getCustomerInvoicePdfDownload: vi.fn(),
  listCustomerPayments: vi.fn(),
  getCustomerPayment: vi.fn(),
  issueInvoice: vi.fn(),
  voidInvoice: vi.fn(),
  emailInvoice: vi.fn(),
  confirmCustomerPayment: vi.fn(),
  createDraftInvoice: vi.fn(),
  createPaymentAllocation: vi.fn(),
  createCustomerRefund: vi.fn(),
  exportBillingCsv: vi.fn(),
  listRecentEnrollmentsForInvoicing: vi.fn(),
}));

const enrollmentPickerMocks = vi.hoisted(() => ({
  mockUseEnrollmentParentPickers: vi.fn(() => ({
    contactOptions: [{ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', label: 'Pat Contact' }],
    families: [{ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', label: 'Fam One' }],
    organizations: [{ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', label: 'Org One' }],
    partnerOrganizations: [],
    loading: false,
    error: '',
    labelByContactId: new Map(),
    labelByFamilyId: new Map(),
    labelByOrganizationId: new Map(),
    labelByPartnerOrganizationId: new Map(),
  })),
}));

vi.mock('@/lib/billing-api', () => ({
  ...billingMocks,
}));

vi.mock('@/hooks/use-enrollment-parent-pickers', () => ({
  useEnrollmentParentPickers: enrollmentPickerMocks.mockUseEnrollmentParentPickers,
}));

import { ClientInvoicesPanel } from '@/components/admin/finance/client-invoices-panel';

function firstCustomerInvoiceDataRow(invoiceTable: HTMLElement): HTMLElement {
  const rows = within(invoiceTable).getAllByRole('row');
  return rows[1] as HTMLElement;
}

describe('ClientInvoicesPanel', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/finance?tab=client-invoices');
    for (const key of Object.keys(billingMocks) as (keyof typeof billingMocks)[]) {
      billingMocks[key].mockReset();
    }
    billingMocks.listCustomerPayments.mockResolvedValue([]);
    billingMocks.listCustomerInvoices.mockResolvedValue({ items: [], next_cursor: null });
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({ items: [], truncated: false });
    billingMocks.getCustomerInvoice.mockResolvedValue({
      id: 'placeholder',
      status: 'draft',
      lines: [],
    });
    billingMocks.getCustomerInvoicePdfDownload.mockResolvedValue({
      downloadUrl: 'https://example.com/signed.pdf',
      expiresAt: '2026-12-31T00:00:00Z',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders invoice rows and selecting a row loads detail', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'draft',
          invoiceNumber: null,
          currency: 'HKD',
          total: '100',
          lineCount: 1,
          billToDisplayName: 'Pat',
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    billingMocks.getCustomerInvoice.mockResolvedValue({
      id: invId,
      status: 'draft',
      lines: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          enrollmentId: '22222222-2222-2222-2222-222222222222',
          description: 'Line',
          lineTotal: '50',
          currency: 'HKD',
        },
      ],
    });

    render(<ClientInvoicesPanel />);

    await waitFor(() => {
      expect(billingMocks.listCustomerInvoices).toHaveBeenCalled();
    });

    const invoiceRegion = screen.getByRole('region', { name: /customer invoices list/i });
    const invoiceTable = within(invoiceRegion).getByRole('table');
    expect(within(invoiceTable).queryByRole('columnheader', { name: 'Invoice' })).not.toBeInTheDocument();
    expect(within(invoiceTable).getByText('Draft')).toBeInTheDocument();
    await userEvent.click(firstCustomerInvoiceDataRow(invoiceTable));

    await waitFor(() => {
      expect(billingMocks.getCustomerInvoice).toHaveBeenCalledWith(invId, expect.any(AbortSignal));
    });

    const uuidInput = document.getElementById('billing-invoice-id') as HTMLInputElement;
    expect(uuidInput.value).toBe(invId);
  });

  it('passes status filter to listCustomerInvoices', async () => {
    billingMocks.listCustomerInvoices.mockResolvedValue({ items: [], next_cursor: null });
    render(<ClientInvoicesPanel />);

    await waitFor(() => expect(billingMocks.listCustomerInvoices).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/status/i), 'issued');

    await waitFor(() => {
      expect(billingMocks.listCustomerInvoices).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'issued' }),
        expect.any(AbortSignal),
      );
    });
  });

  it('load more uses cursor from previous response', async () => {
    billingMocks.listCustomerInvoices.mockImplementation(async (params) => {
      if (params.cursor) {
        return { items: [], next_cursor: null };
      }
      return {
        items: [
          {
            id: 'a',
            status: 'draft',
            currency: 'HKD',
            total: '1',
            lineCount: 0,
            createdAt: '2026-01-01T00:00:00+00:00',
          },
        ],
        next_cursor: 'cursor-token',
      };
    });

    render(<ClientInvoicesPanel />);

    await waitFor(() => expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      const calls = billingMocks.listCustomerInvoices.mock.calls;
      const last = calls[calls.length - 1];
      expect(last[0]).toEqual(
        expect.objectContaining({ cursor: 'cursor-token' }),
      );
    });
  });

  it('issue row action calls issueInvoice', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'draft',
          currency: 'HKD',
          total: '1',
          lineCount: 0,
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    billingMocks.issueInvoice.mockResolvedValue({ invoiceId: invId, invoiceNumber: 'INV-1' });

    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('button', { name: /issue invoice/i }));

    await userEvent.click(screen.getByRole('button', { name: /issue invoice/i }));

    await waitFor(() => {
      expect(billingMocks.issueInvoice).toHaveBeenCalledWith(invId);
    });
  });

  it('preview row action opens invoice PDF URL in a new tab', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'draft',
          currency: 'HKD',
          total: '1',
          lineCount: 0,
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ClientInvoicesPanel />);

    const invoiceRegion = screen.getByRole('region', { name: /customer invoices list/i });
    const invoiceTable = within(invoiceRegion).getByRole('table');

    await waitFor(() =>
      within(invoiceTable).getByRole('button', { name: /preview invoice pdf/i }),
    );

    await userEvent.click(
      within(invoiceTable).getByRole('button', { name: /preview invoice pdf/i }),
    );

    await waitFor(() => {
      expect(billingMocks.getCustomerInvoicePdfDownload).toHaveBeenCalledWith(invId);
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/signed.pdf',
        '_blank',
        'noopener,noreferrer',
      );
    });

    openSpy.mockRestore();
  });

  it('void dialog calls voidInvoice with reason', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'draft',
          currency: 'HKD',
          total: '1',
          lineCount: 0,
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    billingMocks.voidInvoice.mockResolvedValue({ invoiceId: invId, status: 'void' });

    render(<ClientInvoicesPanel />);

    const invoiceRegion = screen.getByRole('region', { name: /customer invoices list/i });
    const invoiceTable = within(invoiceRegion).getByRole('table');

    await waitFor(() =>
      within(invoiceTable).getByRole('button', { name: /void invoice/i }),
    );

    await userEvent.click(within(invoiceTable).getByRole('button', { name: /void invoice/i }));

    await userEvent.type(screen.getByLabelText(/reason/i), 'Customer cancelled');
    const voidDialog = screen.getByRole('alertdialog');
    await userEvent.click(
      within(voidDialog).getByRole('button', { name: /^void invoice$/i }),
    );

    await waitFor(() => {
      expect(billingMocks.voidInvoice).toHaveBeenCalledWith(invId, 'Customer cancelled');
    });
  });

  it('export calls exportBillingCsv and triggers download', async () => {
    billingMocks.exportBillingCsv.mockResolvedValue('a,b\n1,2');
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(<ClientInvoicesPanel />);

    await userEvent.click(screen.getByRole('button', { name: /download csv export/i }));

    await waitFor(() => {
      expect(billingMocks.exportBillingCsv).toHaveBeenCalled();
      const args = billingMocks.exportBillingCsv.mock.calls[0];
      expect(args[0]).toBe('2');
    });

    createUrl.mockRestore();
    revokeUrl.mockRestore();
  });

  it('passes currency filter to listCustomerInvoices', async () => {
    billingMocks.listCustomerInvoices.mockResolvedValue({ items: [], next_cursor: null });
    render(<ClientInvoicesPanel />);

    await waitFor(() => expect(billingMocks.listCustomerInvoices).toHaveBeenCalled());

    const user = userEvent.setup();
    const currencyFilter = document.getElementById('billing-invoice-currency-filter') as HTMLSelectElement;
    await user.selectOptions(currencyFilter, 'USD');

    await waitFor(() => {
      expect(billingMocks.listCustomerInvoices).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
        expect.any(AbortSignal),
      );
    });
  });

  it('clicking invoice line id sets allocate line id field', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const lineId = '11111111-1111-1111-1111-111111111111';
    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'draft',
          currency: 'HKD',
          total: '50',
          lineCount: 1,
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    billingMocks.getCustomerInvoice.mockResolvedValue({
      id: invId,
      status: 'draft',
      lines: [
        {
          id: lineId,
          enrollmentId: '22222222-2222-2222-2222-222222222222',
          description: 'Line',
          lineTotal: '50',
          currency: 'HKD',
        },
      ],
    });

    render(<ClientInvoicesPanel />);

    const invoiceRegion = screen.getByRole('region', { name: /customer invoices list/i });
    const invoiceTable = within(invoiceRegion).getByRole('table');
    await waitFor(() => {
      expect(within(invoiceTable).getAllByRole('button').length).toBeGreaterThan(0);
    });
    await userEvent.click(firstCustomerInvoiceDataRow(invoiceTable));

    await waitFor(() => {
      expect(screen.getByTitle(lineId)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTitle(lineId));

    const lineField = document.getElementById('billing-allocate-line') as HTMLInputElement;
    expect(lineField.value).toBe(lineId);
  });

  it('email dialog calls emailInvoice with recipient', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'issued',
          currency: 'HKD',
          total: '1',
          lineCount: 0,
          billToEmail: 'bill@example.com',
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    billingMocks.getCustomerInvoice.mockResolvedValue({
      id: invId,
      status: 'issued',
      lines: [],
    });
    billingMocks.emailInvoice.mockResolvedValue({ sent: true });

    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('button', { name: /email invoice pdf/i }));

    await userEvent.click(screen.getByRole('button', { name: /email invoice pdf/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /email invoice pdf/i })).toBeInTheDocument();
    });

    const toField = document.getElementById('billing-email-dialog-to') as HTMLInputElement;
    expect(toField.value).toBe('bill@example.com');

    await userEvent.click(screen.getByRole('button', { name: /^send email$/i }));

    await waitFor(() => {
      expect(billingMocks.emailInvoice).toHaveBeenCalledWith(invId, 'bill@example.com');
    });
  });

  it('email dialog shows error when recipient is empty', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'issued',
          currency: 'HKD',
          total: '1',
          lineCount: 0,
          billToEmail: null,
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    billingMocks.getCustomerInvoice.mockResolvedValue({
      id: invId,
      status: 'issued',
      lines: [],
    });

    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('button', { name: /email invoice pdf/i }));
    await userEvent.click(screen.getByRole('button', { name: /email invoice pdf/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /email invoice pdf/i })).toBeInTheDocument();
    });

    const toField = document.getElementById('billing-email-dialog-to') as HTMLInputElement;
    await userEvent.clear(toField);

    await userEvent.click(screen.getByRole('button', { name: /^send email$/i }));

    await waitFor(() => {
      expect(screen.getByText('Recipient email is required.')).toBeInTheDocument();
    });
    expect(billingMocks.emailInvoice).not.toHaveBeenCalled();
  });

  it('confirm payment dialog calls confirmCustomerPayment', async () => {
    const payId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    billingMocks.listCustomerPayments.mockResolvedValue([
      {
        id: payId,
        direction: 'inbound',
        status: 'pending',
        method: 'bank_transfer',
        amount: '10',
        currency: 'HKD',
        createdAt: '2026-01-01T00:00:00+00:00',
      },
    ]);
    billingMocks.getCustomerPayment.mockResolvedValue({
      id: payId,
      direction: 'inbound',
      status: 'pending',
      method: 'bank_transfer',
      amount: '10',
      currency: 'HKD',
      unappliedAmount: '10',
      createdAt: '2026-01-01T00:00:00+00:00',
    });
    billingMocks.confirmCustomerPayment.mockResolvedValue({
      id: payId,
      direction: 'inbound',
      status: 'succeeded',
      method: 'bank_transfer',
      amount: '10',
      currency: 'HKD',
      createdAt: '2026-01-01T00:00:00+00:00',
    });

    render(<ClientInvoicesPanel />);

    const paymentTable = screen.getAllByRole('table').at(-1) as HTMLElement;
    await waitFor(() => within(paymentTable).getByRole('button', { name: /confirm/i }));

    await userEvent.click(within(paymentTable).getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /confirm payment/i })).toBeInTheDocument();
    });

    const refField = document.getElementById('billing-confirm-dialog-ref') as HTMLInputElement;
    await userEvent.type(refField, 'REF-99');

    await userEvent.click(screen.getByRole('button', { name: /^confirm payment$/i }));

    await waitFor(() => {
      expect(billingMocks.confirmCustomerPayment).toHaveBeenCalledWith(payId, {
        externalReference: 'REF-99',
      });
    });
  });

  it('submitting allocate form calls createPaymentAllocation', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const payId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'draft',
          currency: 'HKD',
          total: '100',
          lineCount: 0,
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    billingMocks.getCustomerInvoice.mockResolvedValue({
      id: invId,
      status: 'draft',
      lines: [],
    });

    billingMocks.listCustomerPayments.mockResolvedValue([
      {
        id: payId,
        direction: 'inbound',
        status: 'succeeded',
        method: 'bank_transfer',
        amount: '100',
        currency: 'HKD',
        createdAt: '2026-01-01T00:00:00+00:00',
      },
    ]);
    billingMocks.getCustomerPayment.mockResolvedValue({
      id: payId,
      direction: 'inbound',
      status: 'succeeded',
      method: 'bank_transfer',
      amount: '100',
      currency: 'HKD',
      unappliedAmount: '100',
      createdAt: '2026-01-01T00:00:00+00:00',
    });
    billingMocks.createPaymentAllocation.mockResolvedValue({ allocationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' });

    render(<ClientInvoicesPanel />);

    const invoiceRegion = screen.getByRole('region', { name: /customer invoices list/i });
    const invoiceTable = within(invoiceRegion).getByRole('table');
    await waitFor(() => {
      expect(within(invoiceTable).getAllByRole('button').length).toBeGreaterThan(0);
    });
    await userEvent.click(firstCustomerInvoiceDataRow(invoiceTable));
    await waitFor(() => {
      expect((document.getElementById('billing-allocate-invoice') as HTMLInputElement).value).toBe(invId);
    });

    const paymentTable = screen.getAllByRole('table').at(-1) as HTMLElement;
    await waitFor(() => {
      expect(within(paymentTable).getAllByRole('button').length).toBeGreaterThan(0);
    });
    await userEvent.click(within(paymentTable).getByRole('button', { name: /bbbbbbbb/i }));

    const amountField = document.getElementById('billing-allocate-amount') as HTMLInputElement;
    await userEvent.clear(amountField);
    await userEvent.type(amountField, '25');

    await userEvent.click(screen.getByRole('button', { name: /^create allocation$/i }));

    await waitFor(() => {
      expect(billingMocks.createPaymentAllocation).toHaveBeenCalledWith({
        paymentId: payId,
        invoiceId: invId,
        invoiceLineId: null,
        allocatedAmount: '25',
        currency: 'HKD',
      });
    });
  });

  it('submitting refund form calls createCustomerRefund', async () => {
    const payId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    billingMocks.listCustomerPayments.mockResolvedValue([
      {
        id: payId,
        direction: 'inbound',
        status: 'succeeded',
        method: 'stripe_card',
        amount: '100',
        currency: 'HKD',
        createdAt: '2026-01-01T00:00:00+00:00',
      },
    ]);
    billingMocks.getCustomerPayment.mockResolvedValue({
      id: payId,
      direction: 'inbound',
      status: 'succeeded',
      method: 'stripe_card',
      amount: '100',
      currency: 'HKD',
      unappliedAmount: '0',
      createdAt: '2026-01-01T00:00:00+00:00',
    });
    billingMocks.createCustomerRefund.mockResolvedValue({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      direction: 'refund',
      status: 'succeeded',
      amount: '10',
      currency: 'HKD',
      createdAt: '2026-01-01T00:00:00+00:00',
    });

    render(<ClientInvoicesPanel />);

    const paymentTable = screen.getAllByRole('table').at(-1) as HTMLElement;
    await waitFor(() => {
      expect(within(paymentTable).getAllByRole('button').length).toBeGreaterThan(0);
    });
    await userEvent.click(within(paymentTable).getByRole('button', { name: /bbbbbbbb/i }));

    const refundAmount = document.getElementById('billing-refund-amount') as HTMLInputElement;
    await userEvent.clear(refundAmount);
    await userEvent.type(refundAmount, '10');

    await userEvent.click(screen.getByRole('button', { name: /^record refund$/i }));

    await waitFor(() => {
      expect(billingMocks.createCustomerRefund).toHaveBeenCalledWith({
        direction: 'refund',
        originalPaymentId: payId,
        amount: '10',
        currency: 'HKD',
        method: undefined,
        stripeRefundId: null,
      });
    });
  });

  it('shows billing error when issueInvoice rejects', async () => {
    const invId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    billingMocks.listCustomerInvoices.mockResolvedValue({
      items: [
        {
          id: invId,
          status: 'draft',
          currency: 'HKD',
          total: '1',
          lineCount: 0,
          createdAt: '2026-01-01T00:00:00+00:00',
        },
      ],
      next_cursor: null,
    });
    billingMocks.issueInvoice.mockRejectedValue(new Error('Invoice is not draft'));

    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('button', { name: /issue invoice/i }));
    await userEvent.click(screen.getByRole('button', { name: /issue invoice/i }));

    await waitFor(() => {
      expect(screen.getByText('Invoice is not draft')).toBeInTheDocument();
    });
  });

  it('shows billing error when create draft submitted with no enrollments selected', async () => {
    render(<ClientInvoicesPanel />);

    await waitFor(() =>
      screen.getByRole('button', { name: 'Create draft invoice from selected enrollments' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create draft invoice from selected enrollments' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Select at least one enrollment.')).toBeInTheDocument();
    });
    expect(billingMocks.createDraftInvoice).not.toHaveBeenCalled();
  });

  const pickerRow = (
    overrides: Partial<{
      enrollmentId: string;
      partyDisplayName: string;
      partyEmail: string | null;
      billToMergeKey: string;
      invoiceLinked: boolean;
      amountPaid: string | null;
    }>,
  ) => ({
    enrollmentId: overrides.enrollmentId ?? 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    partyDisplayName: overrides.partyDisplayName ?? 'Pat',
    partyEmail: overrides.partyEmail !== undefined ? overrides.partyEmail : 'pat@example.com',
    instanceTitle: 'Inst',
    serviceTierName: null,
    instanceCohort: null,
    amountPaid: overrides.amountPaid ?? '100.00',
    currency: 'HKD',
    enrolledAt: '2026-01-15T00:00:00+00:00',
    invoiceLinked: overrides.invoiceLinked ?? false,
    billToMergeKey: overrides.billToMergeKey ?? 'contact||uuid-a||',
  });

  it('server-side filter (q) narrows enrollment rows after debounce', async () => {
    billingMocks.listRecentEnrollmentsForInvoicing.mockImplementation(async (_signal, params) => {
      const q = (params?.q ?? '').trim();
      const all = [
        pickerRow({
          enrollmentId: '11111111-1111-1111-1111-111111111111',
          partyDisplayName: 'Alice Alpha',
        }),
        pickerRow({
          enrollmentId: '22222222-2222-2222-2222-222222222222',
          partyDisplayName: 'Bob Beta',
        }),
      ];
      if (!q) {
        return { items: all, truncated: false };
      }
      const needle = q.toLowerCase();
      return {
        items: all.filter(
          (r) =>
            r.partyDisplayName.toLowerCase().includes(needle) ||
            r.enrollmentId.toLowerCase().includes(needle),
        ),
        truncated: false,
      };
    });
    render(<ClientInvoicesPanel />);

    await waitFor(() => expect(screen.getByText(/Alice Alpha/)).toBeInTheDocument());

    const filterInput = screen.getByPlaceholderText(/Search name, email, title, tier, cohort/i);
    await userEvent.type(filterInput, 'Bob');

    await waitFor(
      () => {
        expect(billingMocks.listRecentEnrollmentsForInvoicing).toHaveBeenCalledWith(expect.any(AbortSignal), {
          q: 'Bob',
        });
      },
      { timeout: 4000 },
    );

    await waitFor(() => {
      expect(screen.queryByText(/Alice Alpha/)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Bob Beta/)).toBeInTheDocument();
  });

  it('server-side filter matches enrollment id substring', async () => {
    billingMocks.listRecentEnrollmentsForInvoicing.mockImplementation(async (_signal, params) => {
      const q = (params?.q ?? '').trim();
      const all = [
        pickerRow({
          enrollmentId: 'aaaaaaaa-bbbb-cccc-dddd-111111111111',
          partyDisplayName: 'Alice Alpha',
        }),
        pickerRow({
          enrollmentId: 'bbbbbbbb-bbbb-bbbb-bbbb-222222222222',
          partyDisplayName: 'Bob Beta',
        }),
      ];
      if (!q) {
        return { items: all, truncated: false };
      }
      const needle = q.replace(/-/g, '').toLowerCase();
      return {
        items: all.filter((r) => {
          const idCompact = r.enrollmentId.replace(/-/g, '').toLowerCase();
          return idCompact.includes(needle) || r.enrollmentId.toLowerCase().includes(q.toLowerCase());
        }),
        truncated: false,
      };
    });
    render(<ClientInvoicesPanel />);

    await waitFor(() => expect(screen.getByText(/Alice Alpha/)).toBeInTheDocument());

    const filterInput = screen.getByPlaceholderText(/Search name, email, title, tier, cohort/i);
    await userEvent.type(filterInput, '22222222');

    await waitFor(
      () => {
        expect(billingMocks.listRecentEnrollmentsForInvoicing).toHaveBeenCalledWith(expect.any(AbortSignal), {
          q: '22222222',
        });
      },
      { timeout: 4000 },
    );

    await waitFor(() => {
      expect(screen.queryByText(/Alice Alpha/)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Bob Beta/)).toBeInTheDocument();
  });

  it('create draft omits currency when selection is valid', async () => {
    const id1 = 'aaaaaaaa-bbbb-cccc-dddd-111111111111';
    const id2 = 'aaaaaaaa-bbbb-cccc-dddd-222222222222';
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({
      items: [
        pickerRow({
          enrollmentId: id1,
          billToMergeKey: 'family||fam-1||',
          amountPaid: '50.00',
        }),
        pickerRow({
          enrollmentId: id2,
          billToMergeKey: 'family||fam-1||',
          amountPaid: '50.00',
        }),
      ],
      truncated: false,
    });
    billingMocks.createDraftInvoice.mockResolvedValue({ invoiceId: 'inv-1', status: 'draft' });

    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getAllByRole('checkbox', { name: /Select enrollment/i }));

    const checks = screen.getAllByRole('checkbox', { name: /Select enrollment/i });
    await userEvent.click(checks[0]);
    await userEvent.click(checks[1]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Create draft invoice from selected enrollments' }),
    );

    await waitFor(() => {
      expect(billingMocks.createDraftInvoice).toHaveBeenCalled();
    });
    const arg = billingMocks.createDraftInvoice.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.draftKind).toBe('enrollment_merge');
    expect(arg.currency).toBeUndefined();
    expect(arg.enrollmentIds).toEqual([id1, id2]);
    expect(arg.lineTotalsByEnrollmentId).toBeUndefined();
  });

  it('create draft allows zero-dollar enrollments with recorded amount 0', async () => {
    const id1 = 'aaaaaaaa-bbbb-cccc-dddd-111111111111';
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({
      items: [
        pickerRow({
          enrollmentId: id1,
          billToMergeKey: 'family||fam-1||',
          amountPaid: '0',
        }),
      ],
      truncated: false,
    });
    billingMocks.createDraftInvoice.mockResolvedValue({ invoiceId: 'inv-zero', status: 'draft' });

    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('checkbox', { name: /Select enrollment/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Select enrollment/i }));

    const createBtn = screen.getByRole('button', {
      name: 'Create draft invoice from selected enrollments',
    });
    expect(createBtn).not.toBeDisabled();

    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(billingMocks.createDraftInvoice).toHaveBeenCalled();
    });
    const arg = billingMocks.createDraftInvoice.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.draftKind).toBe('enrollment_merge');
    expect(arg.enrollmentIds).toEqual([id1]);
    expect(arg.lineTotalsByEnrollmentId).toBeUndefined();
  });

  it('create draft is disabled when line total override is not a valid number', async () => {
    const id1 = 'aaaaaaaa-bbbb-cccc-dddd-111111111111';
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({
      items: [
        pickerRow({
          enrollmentId: id1,
          billToMergeKey: 'family||fam-1||',
          amountPaid: '50.00',
        }),
      ],
      truncated: false,
    });

    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('checkbox', { name: /Select enrollment/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Select enrollment/i }));

    const override1 = document.getElementById(`billing-line-override-${id1}`) as HTMLInputElement;
    await userEvent.clear(override1);
    await userEvent.type(override1, 'not-a-number');

    expect(
      screen.getByRole('button', { name: 'Create draft invoice from selected enrollments' }),
    ).toBeDisabled();
    expect(screen.getByText(/Enter a valid number for every line total/i)).toBeInTheDocument();
    expect(billingMocks.createDraftInvoice).not.toHaveBeenCalled();
  });

  it('create draft sends lineTotalsByEnrollmentId when override differs', async () => {
    const id1 = 'aaaaaaaa-bbbb-cccc-dddd-111111111111';
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({
      items: [
        pickerRow({
          enrollmentId: id1,
          billToMergeKey: 'family||fam-1||',
          amountPaid: '50.00',
        }),
      ],
      truncated: false,
    });
    billingMocks.createDraftInvoice.mockResolvedValue({ invoiceId: 'inv-2', status: 'draft' });

    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('checkbox', { name: /Select enrollment/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Select enrollment/i }));

    const override1 = document.getElementById(`billing-line-override-${id1}`) as HTMLInputElement;
    await userEvent.clear(override1);
    await userEvent.type(override1, '99');

    await userEvent.click(
      screen.getByRole('button', { name: 'Create draft invoice from selected enrollments' }),
    );

    await waitFor(() => {
      expect(billingMocks.createDraftInvoice).toHaveBeenCalled();
    });
    const arg = billingMocks.createDraftInvoice.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.draftKind).toBe('enrollment_merge');
    expect(arg.currency).toBeUndefined();
    expect(arg.lineTotalsByEnrollmentId).toEqual({ [id1]: '99' });
    cleanup();
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({
      items: [
        pickerRow({
          enrollmentId: 'aaaaaaaa-bbbb-cccc-dddd-111111111111',
          billToMergeKey: 'k1',
        }),
        pickerRow({
          enrollmentId: 'aaaaaaaa-bbbb-cccc-dddd-222222222222',
          billToMergeKey: 'k2',
        }),
      ],
      truncated: false,
    });
    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getAllByRole('checkbox', { name: /Select enrollment/i }));
    const checks = screen.getAllByRole('checkbox', { name: /Select enrollment/i });
    await userEvent.click(checks[0]);
    await userEvent.click(checks[1]);

    expect(
      screen.getByText(/must share the same bill-to/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create draft invoice from selected enrollments' }),
    ).toBeDisabled();
  });

  it('create customized draft posts billTo, currency, and lines', async () => {
    billingMocks.createDraftInvoice.mockResolvedValue({ invoiceId: 'inv-custom', status: 'draft' });

    render(<ClientInvoicesPanel />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create draft invoice' })).toBeInTheDocument();
    });

    await userEvent.selectOptions(screen.getByLabelText(/^Draft type$/i), 'customized');

    const customizedForm = document.getElementById('client-billing-customized-draft-form');
    expect(customizedForm).toBeTruthy();
    const desc = within(customizedForm as HTMLElement).getByLabelText(/^Description/i);
    await userEvent.clear(desc);
    await userEvent.type(desc, 'Consulting hours');

    const unit = within(customizedForm as HTMLElement).getByLabelText(/^Unit price/i);
    await userEvent.clear(unit);
    await userEvent.type(unit, '150');

    await userEvent.selectOptions(
      screen.getByLabelText(/^Contact$/i),
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create draft invoice from custom lines' }));

    await waitFor(() => {
      expect(billingMocks.createDraftInvoice).toHaveBeenCalled();
    });
    const arg = billingMocks.createDraftInvoice.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toMatchObject({
      draftKind: 'customized_manual',
      billTo: { kind: 'contact', contactId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
      currency: 'HKD',
      lines: [{ description: 'Consulting hours', quantity: '1', unitAmount: '150' }],
    });
  });

  it('blocks checkbox when invoiceLinked', async () => {
    const blockedId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({
      items: [
        pickerRow({ enrollmentId: blockedId, invoiceLinked: true }),
        pickerRow({ enrollmentId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', invoiceLinked: false }),
      ],
      truncated: false,
    });
    render(<ClientInvoicesPanel />);

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: new RegExp(blockedId, 'i') })).toBeDisabled(),
    );
  });

  it('select all visible only affects selectable rows when one row is invoice-linked', async () => {
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({
      items: [
        pickerRow({ enrollmentId: 'aaaaaaaa-bbbb-cccc-dddd-111111111111', invoiceLinked: true }),
        pickerRow({ enrollmentId: 'aaaaaaaa-bbbb-cccc-dddd-222222222222', invoiceLinked: false }),
        pickerRow({ enrollmentId: 'aaaaaaaa-bbbb-cccc-dddd-333333333333', invoiceLinked: false }),
      ],
      truncated: false,
    });
    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('checkbox', { name: /Select all visible enrollments/i }));

    await userEvent.click(screen.getByRole('checkbox', { name: /Select all visible enrollments/i }));

    await waitFor(() => {
      const rowChecks = screen.getAllByRole('checkbox', { name: /^Select enrollment /i });
      expect(rowChecks.filter((el) => (el as HTMLInputElement).checked)).toHaveLength(2);
    });
  });

  it('draft enrollment picker Party column merges name and email with middle dot', async () => {
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue({
      items: [
        pickerRow({
          enrollmentId: 'aaaaaaaa-bbbb-cccc-dddd-111111111111',
          partyDisplayName: 'Sam Sample',
          partyEmail: 'sam@example.com',
        }),
        pickerRow({
          enrollmentId: 'aaaaaaaa-bbbb-cccc-dddd-222222222222',
          partyDisplayName: 'No Email Party',
          partyEmail: null,
        }),
      ],
      truncated: false,
    });
    render(<ClientInvoicesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Sam Sample · sam@example.com')).toBeInTheDocument();
    });
    expect(screen.getByText('No Email Party')).toBeInTheDocument();
    const enrollmentPicker = screen.getByRole('region', { name: 'Enrollment picker' });
    expect(within(enrollmentPicker).queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();
  });
});
