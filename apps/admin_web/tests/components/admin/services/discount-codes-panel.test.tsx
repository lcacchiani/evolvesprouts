import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DiscountCodesPanel } from '@/components/admin/services/discount-codes-panel';

vi.mock('@/hooks/use-service-instance-options', () => ({
  useServiceInstanceOptions: () => ({
    instances: [],
    isLoading: false,
    error: '',
    loadForService: vi.fn(),
  }),
}));

describe('DiscountCodesPanel', () => {
  it('includes service and instance selects and sends scope in create payload', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const serviceOptions = [
      {
        id: 'svc-1',
        serviceType: 'training_course' as const,
        title: 'My Best Auntie',
        description: null,
        coverImageS3Key: null,
        deliveryMode: 'in_person' as const,
        status: 'published' as const,
        createdBy: 'u',
        createdAt: null,
        updatedAt: null,
        trainingDetails: {
          pricingUnit: 'per_person' as const,
          defaultPrice: '100',
          defaultCurrency: 'HKD',
        },
      },
    ];

    render(
      <DiscountCodesPanel
        codes={[]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={serviceOptions}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'TEST' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Applies to service'), {
      target: { value: 'svc-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));

    await vi.waitFor(() => {
      expect(onCreate).toHaveBeenCalled();
    });
    const payload = onCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.service_id).toBe('svc-1');
    expect(payload.instance_id).toBeNull();
  });
});
