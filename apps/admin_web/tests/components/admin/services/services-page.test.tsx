import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { mockUseServicesPage, state } = vi.hoisted(() => {
  const state = {
    activeView: 'catalog' as const,
    setActiveView: vi.fn(),
    selectedServiceId: null as string | null,
    setSelectedServiceId: vi.fn(),
    selectedService: null,
    selectedInstanceId: null as string | null,
    setSelectedInstanceId: vi.fn(),
    selectedInstance: null,
    serviceList: {
      services: [],
      filters: { serviceType: '', status: '', search: '' },
      setFilter: vi.fn(),
      clearFilters: vi.fn(),
      isLoading: false,
      isLoadingMore: false,
      error: '',
      refetch: vi.fn().mockResolvedValue(undefined),
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      totalCount: 0,
    },
    serviceDetail: {
      service: null,
      isLoading: false,
      error: '',
      refetch: vi.fn().mockResolvedValue(undefined),
    },
    serviceMutations: {
      isLoading: false,
      error: '',
      createServiceEntry: vi.fn().mockResolvedValue(null),
      updateServiceEntry: vi.fn().mockResolvedValue(null),
      deleteServiceEntry: vi.fn().mockResolvedValue(undefined),
      createCoverImageUpload: vi.fn().mockResolvedValue(undefined),
    },
    instanceList: {
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
    },
    instanceMutations: {
      isLoading: false,
      error: '',
      createInstanceEntry: vi.fn().mockResolvedValue(null),
      updateInstanceEntry: vi.fn().mockResolvedValue(null),
      deleteInstanceEntry: vi.fn().mockResolvedValue(undefined),
    },
    enrollmentList: {
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
    },
    enrollmentMutations: {
      isLoading: false,
      error: '',
      createEnrollmentEntry: vi.fn().mockResolvedValue(null),
      updateEnrollmentEntry: vi.fn().mockResolvedValue(null),
      deleteEnrollmentEntry: vi.fn().mockResolvedValue(undefined),
    },
    discountCodes: {
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
      createCode: vi.fn().mockResolvedValue(null),
      updateCode: vi.fn().mockResolvedValue(null),
      deleteCode: vi.fn().mockResolvedValue(undefined),
    },
    isCreateServiceDialogOpen: false,
    setIsCreateServiceDialogOpen: vi.fn(),
    isCreateInstanceDialogOpen: false,
    setIsCreateInstanceDialogOpen: vi.fn(),
    isCreateEnrollmentDialogOpen: false,
    setIsCreateEnrollmentDialogOpen: vi.fn(),
  };
  return {
    state,
    mockUseServicesPage: vi.fn(() => state),
  };
});

vi.mock('@/hooks/use-services-page', () => ({
  useServicesPage: mockUseServicesPage,
}));

import { ServicesPage } from '@/components/admin/services/services-page';

describe('ServicesPage', () => {
  it('renders header actions and switches views', async () => {
    const user = userEvent.setup();
    render(<ServicesPage />);

    expect(screen.getByRole('button', { name: 'Catalog' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discount codes' }));
    expect(state.setActiveView).toHaveBeenCalledWith('discount-codes');
  });

  it('opens create-service dialog from header action', async () => {
    const user = userEvent.setup();
    render(<ServicesPage />);

    await user.click(screen.getByRole('button', { name: 'New service' }));
    expect(state.setIsCreateServiceDialogOpen).toHaveBeenCalledWith(true);
  });

  it('renders service detail before the services list', () => {
    render(<ServicesPage />);

    const detailHeading = screen.getByRole('heading', { name: 'Service detail' });
    const listHeading = screen.getByRole('heading', { name: /^Services \(/ });

    expect(detailHeading.compareDocumentPosition(listHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
