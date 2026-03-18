import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateAdminExpense,
  mockUpdateAdminExpense,
  mockAmendAdminExpense,
  mockCancelAdminExpense,
  mockMarkAdminExpensePaid,
  mockReparseAdminExpense,
  mockCreateAdminAsset,
  mockUploadFileToPresignedUrl,
  mockRefetch,
  paginatedState,
} = vi.hoisted(() => {
  const mockRefetch = vi.fn().mockResolvedValue(undefined);
  const paginatedState = {
    items: [] as unknown[],
    filters: { query: '', status: '', parseStatus: '' },
    setFilter: vi.fn(),
    clearFilters: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    error: '',
    refetch: mockRefetch,
    loadMore: vi.fn(),
    hasMore: false,
    totalCount: 0,
  };

  return {
    mockCreateAdminExpense: vi.fn(),
    mockUpdateAdminExpense: vi.fn(),
    mockAmendAdminExpense: vi.fn(),
    mockCancelAdminExpense: vi.fn(),
    mockMarkAdminExpensePaid: vi.fn(),
    mockReparseAdminExpense: vi.fn(),
    mockCreateAdminAsset: vi.fn(),
    mockUploadFileToPresignedUrl: vi.fn(),
    mockRefetch,
    paginatedState,
  };
});

vi.mock('@/hooks/use-paginated-list', () => ({
  usePaginatedList: vi.fn(() => paginatedState),
}));

vi.mock('@/lib/expenses-api', () => ({
  listAdminExpenses: vi.fn(),
  createAdminExpense: mockCreateAdminExpense,
  updateAdminExpense: mockUpdateAdminExpense,
  amendAdminExpense: mockAmendAdminExpense,
  cancelAdminExpense: mockCancelAdminExpense,
  markAdminExpensePaid: mockMarkAdminExpensePaid,
  reparseAdminExpense: mockReparseAdminExpense,
}));

vi.mock('@/lib/assets-api', () => ({
  createAdminAsset: mockCreateAdminAsset,
  uploadFileToPresignedUrl: mockUploadFileToPresignedUrl,
}));

import { useExpenses } from '@/hooks/use-expenses';
import type { Expense } from '@/types/expenses';

const SAMPLE_EXPENSE: Expense = {
  id: 'exp-1',
  amendsExpenseId: null,
  status: 'submitted',
  parseStatus: 'succeeded',
  vendorName: 'Acme Corp',
  invoiceNumber: 'INV-100',
  invoiceDate: '2026-03-01',
  dueDate: '2026-03-15',
  currency: 'HKD',
  subtotal: '100.00',
  tax: '0.00',
  total: '100.00',
  lineItems: [],
  parseConfidence: '0.95',
  notes: null,
  voidReason: null,
  createdBy: 'admin-sub',
  updatedBy: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  submittedAt: null,
  paidAt: null,
  voidedAt: null,
  attachments: [],
};

describe('useExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paginatedState.items = [];
    mockRefetch.mockResolvedValue(undefined);
  });

  it('starts with empty state and no selection', () => {
    const { result } = renderHook(() => useExpenses());

    expect(result.current.selectedExpenseId).toBeNull();
    expect(result.current.selectedExpense).toBeNull();
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isUploadingFiles).toBe(false);
    expect(result.current.mutationError).toBe('');
  });

  it('selects and clears expense', () => {
    paginatedState.items = [SAMPLE_EXPENSE];
    const { result } = renderHook(() => useExpenses());

    act(() => {
      result.current.selectExpense('exp-1');
    });

    expect(result.current.selectedExpenseId).toBe('exp-1');
    expect(result.current.selectedExpense).toMatchObject({ id: 'exp-1' });

    act(() => {
      result.current.clearSelectedExpense();
    });

    expect(result.current.selectedExpenseId).toBeNull();
    expect(result.current.selectedExpense).toBeNull();
  });

  it('creates expense, uploads files, and refetches', async () => {
    mockCreateAdminExpense.mockResolvedValue({ id: 'exp-new' });
    mockCreateAdminAsset.mockResolvedValue({
      asset: { id: 'asset-1' },
      upload: { uploadUrl: 'https://s3.example.com/put', uploadMethod: 'PUT', uploadHeaders: {} },
    });
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined);

    const { result } = renderHook(() => useExpenses());

    const file = new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.createExpenseEntry({
        input: {
          status: 'submitted',
          vendorName: 'Acme',
          invoiceNumber: null,
          invoiceDate: null,
          dueDate: null,
          currency: 'HKD',
          subtotal: null,
          tax: null,
          total: null,
          notes: null,
          lineItems: [],
          parseRequested: false,
        },
        files: [file],
      });
    });

    expect(mockCreateAdminAsset).toHaveBeenCalledTimes(1);
    expect(mockUploadFileToPresignedUrl).toHaveBeenCalledTimes(1);
    expect(mockCreateAdminExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentAssetIds: ['asset-1'],
        status: 'submitted',
        vendorName: 'Acme',
      })
    );
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('updates expense and refetches', async () => {
    paginatedState.items = [SAMPLE_EXPENSE];
    mockUpdateAdminExpense.mockResolvedValue(SAMPLE_EXPENSE);
    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      await result.current.updateExpenseEntry({
        expenseId: 'exp-1',
        input: {
          status: 'submitted',
          vendorName: 'Updated Corp',
          invoiceNumber: null,
          invoiceDate: null,
          dueDate: null,
          currency: 'HKD',
          subtotal: null,
          tax: null,
          total: null,
          notes: null,
          lineItems: [],
          parseRequested: false,
        },
        newFiles: [],
        existingAttachmentAssetIds: [],
      });
    });

    expect(mockUpdateAdminExpense).toHaveBeenCalledWith(
      'exp-1',
      expect.objectContaining({ vendorName: 'Updated Corp' })
    );
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('marks expense as paid and refetches', async () => {
    mockMarkAdminExpensePaid.mockResolvedValue(SAMPLE_EXPENSE);
    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      await result.current.markPaidExpenseEntry('exp-1');
    });

    expect(mockMarkAdminExpensePaid).toHaveBeenCalledWith('exp-1');
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('voids expense with reason and refetches', async () => {
    mockCancelAdminExpense.mockResolvedValue(SAMPLE_EXPENSE);
    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      await result.current.cancelExpenseEntry('exp-1', 'Duplicate invoice');
    });

    expect(mockCancelAdminExpense).toHaveBeenCalledWith('exp-1', 'Duplicate invoice');
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('amends expense and refetches', async () => {
    paginatedState.items = [SAMPLE_EXPENSE];
    mockAmendAdminExpense.mockResolvedValue({ ...SAMPLE_EXPENSE, id: 'exp-amended' });
    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      await result.current.amendExpenseEntry({
        expenseId: 'exp-1',
        input: {
          status: 'submitted',
          vendorName: 'Acme',
          invoiceNumber: null,
          invoiceDate: null,
          dueDate: null,
          currency: 'HKD',
          subtotal: null,
          tax: null,
          total: null,
          notes: 'Amendment',
          lineItems: [],
          parseRequested: false,
        },
        newFiles: [],
        existingAttachmentAssetIds: [],
      });
    });

    expect(mockAmendAdminExpense).toHaveBeenCalledWith(
      'exp-1',
      expect.objectContaining({ notes: 'Amendment' })
    );
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('reparse queues and refetches', async () => {
    mockReparseAdminExpense.mockResolvedValue(undefined);
    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      await result.current.reparseExpenseEntry('exp-1');
    });

    expect(mockReparseAdminExpense).toHaveBeenCalledWith('exp-1');
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('sets mutation error on create failure', async () => {
    mockCreateAdminExpense.mockRejectedValue(new Error('Server error'));
    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      try {
        await result.current.createExpenseEntry({
          input: {
            status: 'submitted',
            vendorName: null,
            invoiceNumber: null,
            invoiceDate: null,
            dueDate: null,
            currency: null,
            subtotal: null,
            tax: null,
            total: null,
            notes: null,
            lineItems: [],
            parseRequested: false,
          },
          files: [],
        });
      } catch {
        // expected
      }
    });

    expect(result.current.mutationError).toBe('Server error');
  });

  it('rejects files exceeding size limit', async () => {
    const oversizedFile = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 16 * 1024 * 1024 });

    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      try {
        await result.current.createExpenseEntry({
          input: {
            status: 'submitted',
            vendorName: null,
            invoiceNumber: null,
            invoiceDate: null,
            dueDate: null,
            currency: null,
            subtotal: null,
            tax: null,
            total: null,
            notes: null,
            lineItems: [],
            parseRequested: false,
          },
          files: [oversizedFile],
        });
      } catch {
        // expected
      }
    });

    expect(result.current.mutationError).toContain('15MB');
  });

  it('rejects unsupported file types', async () => {
    const unsupportedFile = new File(['data'], 'file.exe', { type: 'application/x-msdownload' });

    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      try {
        await result.current.createExpenseEntry({
          input: {
            status: 'submitted',
            vendorName: null,
            invoiceNumber: null,
            invoiceDate: null,
            dueDate: null,
            currency: null,
            subtotal: null,
            tax: null,
            total: null,
            notes: null,
            lineItems: [],
            parseRequested: false,
          },
          files: [unsupportedFile],
        });
      } catch {
        // expected
      }
    });

    expect(result.current.mutationError).toContain('Unsupported file type');
  });

  it('clears mutation error on selectExpense', async () => {
    mockMarkAdminExpensePaid.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useExpenses());

    await act(async () => {
      try {
        await result.current.markPaidExpenseEntry('exp-1');
      } catch {
        // expected
      }
    });

    expect(result.current.mutationError).not.toBe('');

    act(() => {
      result.current.selectExpense('exp-2');
    });

    expect(result.current.mutationError).toBe('');
  });
});
