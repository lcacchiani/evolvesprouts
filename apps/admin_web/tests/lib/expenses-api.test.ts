import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAdminApiRequest } = vi.hoisted(() => ({
  mockAdminApiRequest: vi.fn(),
}));

vi.mock('@/lib/api-admin-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-admin-client')>(
    '@/lib/api-admin-client'
  );
  return {
    ...actual,
    adminApiRequest: mockAdminApiRequest,
  };
});

import { createAdminExpense, listAdminExpenses } from '@/lib/expenses-api';

describe('expenses-api', () => {
  beforeEach(() => {
    mockAdminApiRequest.mockReset();
  });

  it('lists expenses with query params and maps payload', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      items: [
        {
          id: 'exp-1',
          amends_expense_id: null,
          status: 'submitted',
          parse_status: 'succeeded',
          vendor_id: 'vendor-1',
          vendor_name: 'Acme',
          invoice_number: 'INV-100',
          invoice_date: '2026-03-01',
          due_date: '2026-03-10',
          currency: 'HKD',
          subtotal: '100.00',
          tax: '0.00',
          total: '100.00',
          line_items: [],
          parse_confidence: '0.95',
          parser_raw: {},
          notes: null,
          void_reason: null,
          submitted_at: null,
          paid_at: null,
          voided_at: null,
          created_by: 'admin-sub',
          updated_by: null,
          created_at: '2026-03-01T00:00:00.000Z',
          updated_at: '2026-03-01T00:00:00.000Z',
          attachments: [],
        },
      ],
      next_cursor: 'cursor-1',
      total_count: 1,
    });

    const result = await listAdminExpenses({
      query: 'acme',
      status: 'submitted',
      parseStatus: 'succeeded',
      cursor: 'abc',
      limit: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.nextCursor).toBe('cursor-1');
    expect(result.items[0]).toMatchObject({
      id: 'exp-1',
      vendorId: 'vendor-1',
      vendorName: 'Acme',
      parseStatus: 'succeeded',
    });

    const request = mockAdminApiRequest.mock.calls[0][0];
    expect(request.method).toBe('GET');
    expect(request.endpointPath).toContain('/v1/admin/expenses?');
    expect(request.endpointPath).toContain('query=acme');
    expect(request.endpointPath).toContain('status=submitted');
    expect(request.endpointPath).toContain('parse_status=succeeded');
    expect(request.endpointPath).toContain('cursor=abc');
    expect(request.endpointPath).toContain('limit=10');
  });

  it('creates expense with normalized request body', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      expense: {
        id: 'exp-2',
        amends_expense_id: null,
        status: 'submitted',
        parse_status: 'queued',
        vendor_id: 'vendor-1',
        vendor_name: 'Acme',
        invoice_number: 'INV-101',
        invoice_date: null,
        due_date: null,
        currency: 'HKD',
        subtotal: '100.00',
        tax: '0.00',
        total: '100.00',
        line_items: [],
        parse_confidence: null,
        parser_raw: null,
        notes: null,
        void_reason: null,
        submitted_at: null,
        paid_at: null,
        voided_at: null,
        created_by: 'admin-sub',
        updated_by: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
        attachments: [],
      },
    });

    await createAdminExpense({
      status: 'submitted',
      vendorId: ' vendor-1 ',
      invoiceNumber: ' INV-101 ',
      currency: ' HKD ',
      subtotal: ' 100.00 ',
      tax: ' 0.00 ',
      total: ' 100.00 ',
      notes: '  ',
      lineItems: [],
      attachmentAssetIds: ['asset-1'],
      parseRequested: true,
    });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/expenses',
        method: 'POST',
        body: expect.objectContaining({
          vendor_id: 'vendor-1',
          invoice_number: 'INV-101',
          currency: 'HKD',
          notes: null,
          attachment_asset_ids: ['asset-1'],
          parse_requested: true,
        }),
      })
    );
  });

  it('maps line_items with numeric quantity and amounts to strings', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      items: [
        {
          id: 'exp-3',
          amends_expense_id: null,
          status: 'submitted',
          parse_status: 'succeeded',
          vendor_id: null,
          vendor_name: 'Vendor',
          invoice_number: null,
          invoice_date: null,
          due_date: null,
          currency: 'HKD',
          subtotal: null,
          tax: null,
          total: '50.00',
          line_items: [
            {
              description: 'Item',
              quantity: 2,
              unit_price: 10.5,
              amount: 21,
            },
          ],
          parse_confidence: null,
          parser_raw: {},
          notes: null,
          void_reason: null,
          submitted_at: null,
          paid_at: null,
          voided_at: null,
          created_by: 'admin-sub',
          updated_by: null,
          created_at: '2026-03-01T00:00:00.000Z',
          updated_at: '2026-03-01T00:00:00.000Z',
          attachments: [],
        },
      ],
      next_cursor: null,
      total_count: 1,
    });

    const result = await listAdminExpenses({});

    expect(result.items[0]?.lineItems).toEqual([
      {
        description: 'Item',
        quantity: '2',
        unitPrice: '10.5',
        amount: '21',
      },
    ]);
  });
});
