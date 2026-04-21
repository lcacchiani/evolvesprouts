import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OrganizationsPanel } from '@/components/admin/contacts/organizations-panel';

import type { useAdminCrmOrganizations } from '@/hooks/use-admin-crm-organizations';
import type { components } from '@/types/generated/admin-api.generated';

const noopRefresh = vi.fn().mockResolvedValue(undefined);

const hkArea = {
  id: 'area-hk',
  parentId: null,
  name: 'Hong Kong',
  level: 'country' as const,
  code: 'HK',
  sovereignCountryId: null,
  active: true,
  displayOrder: 0,
};

function buildOrgsHook(
  overrides: Partial<ReturnType<typeof useAdminCrmOrganizations>> = {}
): ReturnType<typeof useAdminCrmOrganizations> {
  return {
    organizations: [],
    filters: { query: '', active: '' as const },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: '',
    loadMore: vi.fn(),
    totalCount: 0,
    isSaving: false,
    createOrganization: vi.fn().mockResolvedValue(null),
    updateOrganization: vi.fn().mockResolvedValue(null),
    addMember: vi.fn().mockResolvedValue(null),
    removeMember: vi.fn().mockResolvedValue(null),
    refetch: vi.fn(),
    crmRelationshipOptions: ['prospect', 'customer', 'partner', 'vendor'] as unknown as ReturnType<
      typeof useAdminCrmOrganizations
    >['crmRelationshipOptions'],
    ...overrides,
  };
}

describe('OrganizationsPanel', () => {
  it('creates an organisation with default type', async () => {
    const user = userEvent.setup();
    const createOrganization = vi.fn().mockResolvedValue(null);
    const organizations = buildOrgsHook({ createOrganization });

    render(
      <OrganizationsPanel
        organizations={organizations}
        tags={[]}
        locations={[]}
        geographicAreas={[]}
        areasLoading={false}
        refreshLocations={noopRefresh}
        contactOptions={[]}
        contactsForMembership={[]}
      />
    );

    await user.type(screen.getByLabelText('Name'), 'Acme');
    await user.click(screen.getByRole('button', { name: 'Create organisation' }));

    expect(createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Acme',
        organization_type: 'company',
      })
    );
  });

  it('read-only when linked location is partner-org locked', async () => {
    const user = userEvent.setup();
    const row: components['schemas']['AdminOrganization'] = {
      id: 'org-1',
      name: 'Partner Org',
      organization_type: 'company',
      relationship_type: 'partner',
      slug: 'partner-org',
      website: null,
      location_id: 'loc-1',
      location_summary: {
        id: 'loc-1',
        name: null,
        area_id: 'area-hk',
        area_name: 'Hong Kong',
        address: 'Locked St',
        lat: null,
        lng: null,
      },
      tag_ids: [],
      tags: [],
      members: [],
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    };
    const organizations = buildOrgsHook({
      organizations: [row],
    });

    render(
      <OrganizationsPanel
        organizations={organizations}
        tags={[]}
        locations={[
          {
            id: 'loc-1',
            name: null,
            areaId: 'area-hk',
            address: 'Locked St',
            lat: null,
            lng: null,
            createdAt: null,
            updatedAt: null,
            lockedFromPartnerOrg: true,
            partnerOrganizationLabels: ['Partner Org'],
          },
        ]}
        geographicAreas={[hkArea]}
        areasLoading={false}
        refreshLocations={noopRefresh}
        contactOptions={[]}
        contactsForMembership={[]}
      />
    );

    await user.click(screen.getByText('Partner Org'));

    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.getByText(/Managed from the partner organisation/)).toBeInTheDocument();
  });
});
