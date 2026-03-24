import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VendorsPanel } from '@/components/admin/finance/vendors-panel';

describe('VendorsPanel', () => {
  it('renders vendor table columns', () => {
    render(
      <VendorsPanel
        vendors={[
          {
            id: 'vendor-1',
            name: 'Acme Vendor',
            website: 'https://vendor.example.com',
            active: true,
            archivedAt: null,
            createdAt: null,
            updatedAt: null,
          },
        ]}
        filters={{ query: '', active: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        vendorSpendByVendorId={new Map([['vendor-1', 1234.56]])}
        isVendorSpendLoading={false}
      />
    );

    expect(screen.getByRole('heading', { name: 'Vendors' })).toBeInTheDocument();
    const columnHeaders = screen.getAllByRole('columnheader').map((el) => el.textContent?.trim() ?? '');
    expect(columnHeaders).toEqual(['Name', 'Status', 'Total spend (HKD)', 'Operations']);
    expect(screen.getByText('HK$1,234.56')).toBeInTheDocument();
  });

  it('creates a vendor from inline editor', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <VendorsPanel
        vendors={[]}
        filters={{ query: '', active: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        vendorSpendByVendorId={new Map()}
        isVendorSpendLoading={false}
      />
    );

    await user.type(screen.getByLabelText('Name'), 'Acme Vendor');
    await user.type(screen.getByLabelText('Website'), 'https://vendor.example.com');
    await user.click(screen.getByRole('button', { name: 'Create vendor' }));

    expect(onCreate).toHaveBeenCalledWith({
      name: 'Acme Vendor',
      website: 'https://vendor.example.com',
      active: true,
    });
  });
});
