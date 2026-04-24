import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceDetailPanel } from '@/components/admin/services/service-detail-panel';
import { AdminApiError } from '@/lib/api-admin-client';
import * as servicesApi from '@/lib/services-api';
import type { ServiceDetail } from '@/types/services';

function buildService(overrides: Partial<ServiceDetail> = {}): ServiceDetail {
  return {
    id: 'service-1',
    instancesCount: 0,
    serviceType: 'training_course',
    title: 'Alpha service',
    slug: 'old-slug',
    bookingSystem: null,
    description: null,
    coverImageS3Key: null,
    deliveryMode: 'online',
    status: 'draft',
    serviceTier: null,
    locationId: null,
    createdBy: 'admin',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
    tagIds: [],
    assetIds: [],
    trainingDetails: {
      pricingUnit: 'per_person',
      defaultPrice: null,
      defaultCurrency: null,
    },
    eventDetails: null,
    consultationDetails: null,
    ...overrides,
  };
}

describe('ServiceDetailPanel referral slug', () => {
  beforeEach(() => {
    vi.spyOn(servicesApi, 'getServiceDiscountCodeUsageSummary').mockResolvedValue({
      summary: { totalCurrentUses: 0, referencingCodeCount: 0 },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lowercases slug on blur and blocks invalid patterns', () => {

    render(
      <ServiceDetailPanel
        service={buildService()}
        isLoading={false}
        error=''
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onUploadCover={vi.fn()}
      />,
    );

    const slugInput = screen.getByLabelText('Referral slug');
    fireEvent.change(slugInput, { target: { value: 'My-Slug' } });
    fireEvent.blur(slugInput);

    expect(slugInput).toHaveValue('my-slug');

    fireEvent.change(slugInput, { target: { value: 'Bad_' } });
    fireEvent.blur(slugInput);

    expect(screen.getByText(/Use lowercase letters and numbers/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update service' })).toBeDisabled();
  });

  it('confirms slug change when discount usage exists', async () => {
    const user = userEvent.setup();
    vi.mocked(servicesApi.getServiceDiscountCodeUsageSummary).mockResolvedValue({
      summary: { totalCurrentUses: 2, referencingCodeCount: 1 },
      error: null,
    });
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <ServiceDetailPanel
        service={buildService()}
        isLoading={false}
        error=''
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onUploadCover={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(servicesApi.getServiceDiscountCodeUsageSummary).toHaveBeenCalledWith('service-1');
    });

    const slugInput = screen.getByLabelText('Referral slug');
    fireEvent.change(slugInput, { target: { value: 'new-slug' } });
    await user.click(screen.getByRole('button', { name: 'Update service' }));

    expect(
      await screen.findByText(/Changing the slug will break any existing printed QR codes/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ slug: 'new-slug' });
  });

  it('confirms slug change when discount usage summary fails to load', async () => {
    const user = userEvent.setup();
    vi.mocked(servicesApi.getServiceDiscountCodeUsageSummary).mockResolvedValue({
      summary: null,
      error: new Error('network'),
    });
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <ServiceDetailPanel
        service={buildService()}
        isLoading={false}
        error=''
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onUploadCover={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(servicesApi.getServiceDiscountCodeUsageSummary).toHaveBeenCalledWith('service-1');
    });

    expect(
      await screen.findByText(/Could not load discount code usage/),
    ).toBeInTheDocument();

    const slugInput = screen.getByLabelText('Referral slug');
    fireEvent.change(slugInput, { target: { value: 'new-slug' } });
    await user.click(screen.getByRole('button', { name: 'Update service' }));

    expect(
      await screen.findByText(/We couldn't verify current discount code usage/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it('shows inline slug conflict error and blocks save until slug changes after 409', async () => {
    const user = userEvent.setup();
    const onUpdate = vi
      .fn()
      .mockRejectedValueOnce(
        new AdminApiError({
          statusCode: 409,
          payload: { error: 'Referral slug already in use', field: 'slug' },
          message: 'Referral slug already in use',
        }),
      )
      .mockResolvedValueOnce(undefined);

    render(
      <ServiceDetailPanel
        service={buildService({ slug: 'old-slug' })}
        isLoading={false}
        error=''
        onCancelSelection={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onUploadCover={vi.fn()}
      />,
    );

    const slugInput = screen.getByLabelText('Referral slug');
    fireEvent.change(slugInput, { target: { value: 'taken-slug' } });
    await user.click(screen.getByRole('button', { name: 'Update service' }));

    expect(
      await screen.findByText('Referral slug already in use. Choose another.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update service' })).toBeDisabled();

    fireEvent.change(slugInput, { target: { value: 'taken-slug-x' } });
    expect(screen.getByRole('button', { name: 'Update service' })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Update service' }));
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledTimes(2);
    });
  });
});
