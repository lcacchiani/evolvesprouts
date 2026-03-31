import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceListState = {
  services: [] as { id: string; serviceType: string; title: string }[],
  isLoading: false,
  filters: { serviceType: '', status: '', search: '' },
  setFilter: vi.fn(),
  clearFilters: vi.fn(),
  error: '',
  refetch: vi.fn().mockResolvedValue(undefined),
  loadMore: vi.fn().mockResolvedValue(undefined),
  hasMore: false,
  totalCount: 0,
};

vi.mock('@/hooks/use-service-list', () => ({
  useServiceList: vi.fn(() => serviceListState),
}));

vi.mock('@/hooks/use-service-detail', () => ({
  useServiceDetail: vi.fn(() => ({
    service: null,
    isLoading: false,
    error: '',
    refetch: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/hooks/use-instance-list', () => ({
  useInstanceList: vi.fn(() => ({
    instances: [],
    filters: { status: '' },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    error: '',
    refetch: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn().mockResolvedValue(undefined),
    hasMore: false,
    totalCount: 0,
  })),
}));

vi.mock('@/hooks/use-enrollment-list', () => ({
  useEnrollmentList: vi.fn(() => ({
    enrollments: [],
    filters: { status: '' },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    error: '',
    refetch: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn().mockResolvedValue(undefined),
    hasMore: false,
    totalCount: 0,
  })),
}));

vi.mock('@/hooks/use-location-list', () => ({
  useLocationList: vi.fn(() => ({
    locations: [],
    isLoading: false,
    error: '',
    refetch: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/hooks/use-discount-codes', () => ({
  useDiscountCodes: vi.fn(() => ({
    codes: [],
    filters: { active: '', search: '' },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    isSaving: false,
    error: '',
    refetch: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn().mockResolvedValue(undefined),
    hasMore: false,
    totalCount: 0,
    createCode: vi.fn(),
    updateCode: vi.fn(),
    deleteCode: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-venues', () => ({
  useVenues: vi.fn(() => ({
    venues: [],
    geographicAreas: [],
    areasLoading: false,
    filters: { areaId: '', search: '' },
    isLoading: false,
    isLoadingMore: false,
    isSaving: false,
    error: '',
    refetch: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn().mockResolvedValue(undefined),
    hasMore: false,
    totalCount: 0,
    setFilter: vi.fn(),
    createVenue: vi.fn(),
    updateVenue: vi.fn(),
    deleteVenue: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-service-mutations', () => ({
  useServiceMutations: vi.fn(() => ({
    isLoading: false,
    error: '',
    createServiceEntry: vi.fn(),
    updateServiceEntry: vi.fn(),
    deleteServiceEntry: vi.fn(),
    createCoverImageUpload: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-instance-mutations', () => ({
  useInstanceMutations: vi.fn(() => ({
    isLoading: false,
    error: '',
    createInstanceEntry: vi.fn(),
    updateInstanceEntry: vi.fn(),
    deleteInstanceEntry: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-enrollment-mutations', () => ({
  useEnrollmentMutations: vi.fn(() => ({
    isLoading: false,
    error: '',
    createEnrollmentEntry: vi.fn(),
    updateEnrollmentEntry: vi.fn(),
    deleteEnrollmentEntry: vi.fn(),
  })),
}));

import { useServicesPage } from '@/hooks/use-services-page';

describe('useServicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceListState.services = [];
    serviceListState.isLoading = false;
  });

  it('auto-selects first event service when opening Events with no prior selection', async () => {
    serviceListState.services = [
      { id: 'training-1', serviceType: 'training_course', title: 'Training' },
      { id: 'event-1', serviceType: 'event', title: 'My Event' },
    ];

    const { result } = renderHook(() => useServicesPage());

    await act(async () => {
      result.current.setActiveView('events');
    });

    expect(result.current.selectedServiceId).toBe('event-1');
  });

  it('auto-selects first service when no event-type service exists', async () => {
    serviceListState.services = [
      { id: 'training-1', serviceType: 'training_course', title: 'Training' },
      { id: 'consult-1', serviceType: 'consultation', title: 'Consult' },
    ];

    const { result } = renderHook(() => useServicesPage());

    await act(async () => {
      result.current.setActiveView('events');
    });

    expect(result.current.selectedServiceId).toBe('training-1');
  });
});
