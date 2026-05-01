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
}));

vi.mock('@/lib/billing-api', () => ({
  ...billingMocks,
  parseEnrollmentIdList: (raw: string) =>
    raw
      .split(/[\s,;]+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  parseLineTotalsOverridesJson: (raw: string) => {
    const t = raw.trim();
    if (t === '') {
      return { ok: true as const, overrides: null };
    }
    return { ok: false as const, error: 'bad' };
  },
}));

import { ClientInvoicesPanel } from '@/components/admin/finance/client-invoices-panel';

describe('ClientInvoicesPanel', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/finance?tab=client-invoices');
    billingMocks.listCustomerPayments.mockResolvedValue([]);
    billingMocks.listCustomerInvoices.mockResolvedValue({ items: [], next_cursor: null });
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

    const invoiceTable = screen.getAllByRole('table')[0];
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
});
