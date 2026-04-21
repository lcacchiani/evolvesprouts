import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateDiscountCode, mockRefetch, paginatedState } = vi.hoisted(() => {
  const mockRefetch = vi.fn().mockResolvedValue(undefined);
  const paginatedState = {
    items: [],
    filters: { active: '', search: '', scope: '' },
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
    mockCreateDiscountCode: vi.fn(),
    mockRefetch,
    paginatedState,
  };
});

vi.mock('@/hooks/use-paginated-list', () => ({
  usePaginatedList: vi.fn(() => paginatedState),
}));

vi.mock('@/lib/services-api', () => ({
  createDiscountCode: mockCreateDiscountCode,
  deleteDiscountCode: vi.fn(),
  listDiscountCodes: vi.fn(),
  updateDiscountCode: vi.fn(),
}));

import { useDiscountCodes } from '@/hooks/use-discount-codes';

describe('useDiscountCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDiscountCode.mockResolvedValue({ discount_code: {} });
  });

  it('refetches after create by default', async () => {
    const { result } = renderHook(() => useDiscountCodes());

    await act(async () => {
      await result.current.createCode({
        code: 'SAVE10',
        description: null,
        discount_type: 'percentage',
        discount_value: '10',
        currency: 'HKD',
        valid_from: null,
        valid_until: null,
        max_uses: null,
        active: true,
        service_id: null,
        instance_id: null,
      });
    });

    expect(mockCreateDiscountCode).toHaveBeenCalled();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('refetches after create when only suppressSaving is true (batch duplicate-retry UI)', async () => {
    const { result } = renderHook(() => useDiscountCodes());

    await act(async () => {
      await result.current.createCode(
        {
          code: 'SAVE10',
          description: null,
          discount_type: 'percentage',
          discount_value: '10',
          currency: 'HKD',
          valid_from: null,
          valid_until: null,
          max_uses: null,
          active: true,
          service_id: null,
          instance_id: null,
        },
        { suppressSaving: true },
      );
    });

    expect(mockCreateDiscountCode).toHaveBeenCalled();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('skips refetch when suppressRefetch is true', async () => {
    const { result } = renderHook(() => useDiscountCodes());

    await act(async () => {
      await result.current.createCode(
        {
          code: 'SAVE10',
          description: null,
          discount_type: 'percentage',
          discount_value: '10',
          currency: 'HKD',
          valid_from: null,
          valid_until: null,
          max_uses: null,
          active: true,
          service_id: null,
          instance_id: null,
        },
        { suppressRefetch: true },
      );
    });

    expect(mockCreateDiscountCode).toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});
