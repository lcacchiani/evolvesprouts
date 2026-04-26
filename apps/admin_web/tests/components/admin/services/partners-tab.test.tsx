import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { refetch } = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock('@/components/admin/services/partners-section', () => ({
  PartnersSection: () => <div data-testid='partners-section-mock' />,
}));

vi.mock('@/hooks/use-partners', () => ({
  // New object each call simulates hook return identity changing across renders.
  usePartners: () => ({
    partners: [],
    filters: { query: '', active: '' },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: '',
    loadMore: vi.fn(),
    totalCount: 0,
    isSaving: false,
    createPartner: vi.fn(),
    updatePartner: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMember: vi.fn(),
    deletePartner: vi.fn(),
    refetch,
    relationshipOptions: ['partner'] as const,
  }),
}));

import { PartnersTab } from '@/components/admin/services/partners-tab';

const tabProps = {
  locations: [],
  geographicAreas: [],
  areasLoading: false,
  refreshLocations: vi.fn(),
};

describe('PartnersTab', () => {
  it('does not refetch on every render when hook returns a new object each time', () => {
    refetch.mockClear();

    const { rerender } = render(<PartnersTab {...tabProps} />);
    rerender(<PartnersTab {...tabProps} />);
    rerender(<PartnersTab {...tabProps} />);

    expect(refetch).not.toHaveBeenCalled();
  });
});
