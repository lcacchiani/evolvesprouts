import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useServiceInstanceOptions } from '@/hooks/use-service-instance-options';

vi.mock('@/lib/services-api', () => ({
  listInstances: vi.fn(),
}));

describe('useServiceInstanceOptions', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('caches listInstances results per service id', async () => {
    const { listInstances } = await import('@/lib/services-api');
    const listInstancesMock = vi.mocked(listInstances);
    listInstancesMock.mockResolvedValue({
      items: [
        {
          id: 'inst-1',
          serviceId: 'svc-1',
          parentServiceTitle: null,
          parentServiceType: null,
          title: 'Cohort A',
          description: null,
          coverImageS3Key: null,
          status: 'open',
          deliveryMode: null,
          locationId: null,
          maxCapacity: null,
          waitlistEnabled: false,
          instructorId: null,
          notes: null,
          createdBy: 'u',
          createdAt: null,
          updatedAt: null,
          resolvedTitle: 'Cohort A',
          resolvedDescription: null,
          resolvedCoverImageS3Key: null,
          resolvedDeliveryMode: null,
          sessionSlots: [],
          trainingDetails: null,
          eventTicketTiers: [],
          consultationDetails: null,
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });

    const { result } = renderHook(() => useServiceInstanceOptions());

    await act(async () => {
      await result.current.loadForService('svc-1');
    });
    await waitFor(() => {
      expect(result.current.instances).toHaveLength(1);
    });
    expect(listInstancesMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.loadForService('svc-1');
    });
    expect(listInstancesMock).toHaveBeenCalledTimes(1);
  });

  it('clears cache when refreshKey changes', async () => {
    const { listInstances } = await import('@/lib/services-api');
    const listInstancesMock = vi.mocked(listInstances);
    listInstancesMock.mockResolvedValue({
      items: [
        {
          id: 'inst-1',
          serviceId: 'svc-1',
          parentServiceTitle: null,
          parentServiceType: null,
          title: 'Cohort A',
          description: null,
          coverImageS3Key: null,
          status: 'open',
          deliveryMode: null,
          locationId: null,
          maxCapacity: null,
          waitlistEnabled: false,
          instructorId: null,
          notes: null,
          createdBy: 'u',
          createdAt: null,
          updatedAt: null,
          resolvedTitle: 'Cohort A',
          resolvedDescription: null,
          resolvedCoverImageS3Key: null,
          resolvedDeliveryMode: null,
          sessionSlots: [],
          trainingDetails: null,
          eventTicketTiers: [],
          consultationDetails: null,
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });

    const { result, rerender } = renderHook(
      ({ key }: { key: number }) => useServiceInstanceOptions(key),
      { initialProps: { key: 0 } },
    );

    await act(async () => {
      await result.current.loadForService('svc-1');
    });
    expect(listInstancesMock).toHaveBeenCalledTimes(1);

    rerender({ key: 1 });
    await act(async () => {
      await result.current.loadForService('svc-1');
    });
    expect(listInstancesMock).toHaveBeenCalledTimes(2);
  });
});
