import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const billingMocks = vi.hoisted(() => ({
  listCustomerInvoices: vi.fn(),
  getCustomerInvoice: vi.fn(),
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

vi.mock('@/lib/billing-api', () => ({
  ...billingMocks,
}));

import { ClientInvoicesPanel } from '@/components/admin/finance/client-invoices-panel';

describe('ClientInvoicesPanel', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/finance?tab=client-invoices');
    for (const key of Object.keys(billingMocks) as (keyof typeof billingMocks)[]) {
      billingMocks[key].mockReset();
    }
    billingMocks.listCustomerPayments.mockResolvedValue([]);
    billingMocks.listCustomerInvoices.mockResolvedValue({ items: [], next_cursor: null });
    billingMocks.listRecentEnrollmentsForInvoicing.mockResolvedValue([]);
    billingMocks.getCustomerInvoice.mockResolvedValue({
      id: 'placeholder',
      status: 'draft',
      lines: [],
    });
  });

  afterEach(() => {
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
    await userEvent.click(within(invoiceTable).getByRole('button', { name: /aaaaaaaa/i }));

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

    await waitFor(() => screen.getByRole('button', { name: /^issue$/i }));

    await userEvent.click(screen.getByRole('button', { name: /^issue$/i }));

    await waitFor(() => {
      expect(billingMocks.issueInvoice).toHaveBeenCalledWith(invId);
    });
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

    await waitFor(() => screen.getByRole('button', { name: /void/i }));

    await userEvent.click(screen.getByRole('button', { name: /void/i }));

    await userEvent.type(screen.getByLabelText(/reason/i), 'Customer cancelled');
    await userEvent.click(screen.getByRole('button', { name: /void invoice$/i }));

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
    await userEvent.click(within(invoiceTable).getByRole('button', { name: /aaaaaaaa/i }));

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

    await waitFor(() => screen.getByRole('button', { name: /email/i }));

    await userEvent.click(screen.getByRole('button', { name: /email/i }));

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

    await waitFor(() => screen.getByRole('button', { name: /email/i }));
    await userEvent.click(screen.getByRole('button', { name: /email/i }));

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
    await userEvent.click(within(invoiceTable).getByRole('button', { name: /aaaaaaaa/i }));
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

    await waitFor(() => screen.getByRole('button', { name: /^issue$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^issue$/i }));

    await waitFor(() => {
      expect(screen.getByText('Invoice is not draft')).toBeInTheDocument();
    });
  });

  it('shows billing error when create draft submitted with no enrollments selected', async () => {
    render(<ClientInvoicesPanel />);

    await waitFor(() => screen.getByRole('button', { name: /create draft invoice/i }));
    await userEvent.click(screen.getByRole('button', { name: /create draft invoice/i }));

    await waitFor(() => {
      expect(screen.getByText('Select at least one enrollment.')).toBeInTheDocument();
    });
    expect(billingMocks.createDraftInvoice).not.toHaveBeenCalled();
  });
});
