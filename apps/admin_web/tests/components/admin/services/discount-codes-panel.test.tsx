import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscountCodesPanel } from '@/components/admin/services/discount-codes-panel';
import { AdminApiError } from '@/lib/api-admin-client';

vi.mock('@/hooks/use-service-instance-options', () => ({
  useServiceInstanceOptions: () => ({
    instances: [],
    isLoading: false,
    error: '',
    loadForService: vi.fn(),
  }),
}));

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    getPublicSiteBaseUrl: () => 'https://www.example.com',
  };
});

describe('DiscountCodesPanel', () => {
  const baseService = {
    id: 'svc-1',
    serviceType: 'training_course' as const,
    title: 'My Best Auntie',
    slug: 'my-best-auntie' as string | null,
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
  };

  it('includes service and instance selects and sends scope in create payload', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const serviceOptions = [{ ...baseService }];

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

  it('shows referral QR action for every discount row', () => {
    const row = {
      id: 'dc-1',
      code: 'SAVE10',
      description: null,
      discountType: 'percentage' as const,
      discountValue: '10',
      currency: null,
      validFrom: null,
      validUntil: null,
      maxUses: null,
      currentUses: 0,
      active: true,
      serviceId: null,
      instanceId: null,
      createdAt: null,
      updatedAt: null,
    };

    render(
      <DiscountCodesPanel
        codes={[row]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={[{ ...baseService }]}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Referral link and QR' })).toBeInTheDocument();
  });

  it('shows archived service title in Scope while picker omits archived services', () => {
    const archived = {
      ...baseService,
      id: 'svc-archived',
      title: 'MBA Archived',
      status: 'archived' as const,
      slug: 'other-slug',
    };
    const row = {
      id: 'dc-arch',
      code: 'ARCH',
      description: null,
      discountType: 'percentage' as const,
      discountValue: '10',
      currency: null,
      validFrom: null,
      validUntil: null,
      maxUses: null,
      currentUses: 0,
      active: true,
      serviceId: 'svc-archived',
      instanceId: null,
      createdAt: null,
      updatedAt: null,
    };

    render(
      <DiscountCodesPanel
        codes={[row]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={[{ ...baseService }]}
        serviceDirectoryForDisplay={[archived]}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('MBA Archived (archived)')).toBeInTheDocument();
    const serviceSelect = screen.getByLabelText('Applies to service') as HTMLSelectElement;
    expect(
      [...serviceSelect.options].some((opt) => opt.textContent?.includes('MBA Archived')),
    ).toBe(false);
  });

  it('prompts before scope change when the code has current uses', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const row = {
      id: 'dc-1',
      code: 'USED',
      description: null,
      discountType: 'percentage' as const,
      discountValue: '10',
      currency: null,
      validFrom: null,
      validUntil: null,
      maxUses: null,
      currentUses: 3,
      active: true,
      serviceId: 'svc-1',
      instanceId: null,
      createdAt: null,
      updatedAt: null,
    };

    const svc2 = {
      ...baseService,
      id: 'svc-2',
      title: 'Other',
      slug: 'consultations',
    };

    render(
      <DiscountCodesPanel
        codes={[row]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={[{ ...baseService }, svc2]}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('USED'));
    fireEvent.change(screen.getByLabelText('Applies to service'), { target: { value: 'svc-2' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update code' }));

    expect(await screen.findByText(/Changing scope won't retroactively affect past bookings/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
    expect(onUpdate.mock.calls[0][1]).toMatchObject({ service_id: 'svc-2' });
  });

  it('referral type sets value and currency, disables inputs, and submits defaults', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <DiscountCodesPanel
        codes={[]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={[{ ...baseService }]}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'REFNEW' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'referral' } });

    const valueInput = screen.getByLabelText('Value') as HTMLInputElement;
    expect(valueInput).toBeDisabled();
    expect(valueInput.value).toBe('0');
    const currencySelect = screen.getByLabelText('Currency') as HTMLSelectElement;
    expect(currencySelect.value).toBe('HKD');
    expect(currencySelect).toBeDisabled();

    const createBtn = screen.getByRole('button', { name: 'Create code' });
    expect(createBtn).not.toBeDisabled();

    fireEvent.click(createBtn);

    await vi.waitFor(() => {
      expect(onCreate).toHaveBeenCalled();
    });
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      discount_type: 'referral',
      discount_value: '0',
      currency: 'HKD',
    });
  });

  it('switching away from referral clears value and re-enables value input', () => {
    render(
      <DiscountCodesPanel
        codes={[]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={[{ ...baseService }]}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'referral' } });
    expect((screen.getByLabelText('Value') as HTMLInputElement).value).toBe('0');
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'percentage' } });
    expect((screen.getByLabelText('Value') as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('Value')).not.toBeDisabled();
  });

  it('renders Referral in the value column for referral rows', () => {
    const row = {
      id: 'dc-ref',
      code: 'TRACK',
      description: null,
      discountType: 'referral' as const,
      discountValue: '0',
      currency: 'HKD',
      validFrom: null,
      validUntil: null,
      maxUses: null,
      currentUses: 0,
      active: true,
      serviceId: null,
      instanceId: null,
      createdAt: null,
      updatedAt: null,
    };

    render(
      <DiscountCodesPanel
        codes={[row]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={[{ ...baseService }]}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const table = screen.getByRole('table');
    const dataRow = screen.getByText('TRACK').closest('tr');
    expect(dataRow).toBeTruthy();
    expect(table.contains(dataRow)).toBe(true);
    expect(dataRow?.textContent).toContain('Referral');
  });

  it('opens referral QR dialog with row discount type for ref param', async () => {
    const row = {
      id: 'dc-ref',
      code: 'SAVE10',
      description: null,
      discountType: 'referral' as const,
      discountValue: '0',
      currency: 'HKD',
      validFrom: null,
      validUntil: null,
      maxUses: null,
      currentUses: 0,
      active: true,
      serviceId: 'svc-1',
      instanceId: null,
      createdAt: null,
      updatedAt: null,
    };

    render(
      <DiscountCodesPanel
        codes={[row]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={[{ ...baseService }]}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Referral link and QR' }));

    await vi.waitFor(() => {
      expect(
        screen.getByRole('link', {
          name: 'https://www.example.com/en/services/my-best-auntie?ref=SAVE10',
        }),
      ).toBeInTheDocument();
    });
  });

  it('retries create with COPY, COPY2, … until duplicate 409 stops', async () => {
    const duplicateErr = new AdminApiError({
      statusCode: 409,
      payload: { error: 'duplicate', field: 'code' },
      message: 'A discount code with this value already exists',
    });
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(duplicateErr)
      .mockRejectedValueOnce(duplicateErr)
      .mockResolvedValueOnce(undefined);

    render(
      <DiscountCodesPanel
        codes={[]}
        filters={{ active: '', search: '', scope: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        serviceOptions={[{ ...baseService }]}
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'DUP' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));

    await vi.waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(3);
    });
    expect(onCreate.mock.calls[0][0]).toMatchObject({ code: 'DUP' });
    expect(onCreate.mock.calls[1][0]).toMatchObject({ code: 'DUPCOPY' });
    expect(onCreate.mock.calls[2][0]).toMatchObject({ code: 'DUPCOPY2' });
  });
});
