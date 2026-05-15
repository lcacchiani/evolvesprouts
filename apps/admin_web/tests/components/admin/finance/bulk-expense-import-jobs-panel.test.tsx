import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/expenses-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/expenses-api')>();
  return {
    ...actual,
    listAdminBulkExpenseImportJobs: vi.fn(),
    deleteAdminBulkExpenseImportJob: vi.fn(),
  };
});

import { BulkExpenseImportJobsPanel } from '@/components/admin/finance/bulk-expense-import-jobs-panel';
import { deleteAdminBulkExpenseImportJob, listAdminBulkExpenseImportJobs } from '@/lib/expenses-api';

describe('BulkExpenseImportJobsPanel', () => {
  beforeEach(() => {
    vi.mocked(listAdminBulkExpenseImportJobs).mockResolvedValue({
      items: [
        {
          id: 'job-1',
          status: 'succeeded',
          errorMessage: null,
          createdCount: 2,
          createdAt: '2026-01-01T12:00:00.000Z',
          updatedAt: '2026-01-01T12:01:00.000Z',
          attachmentAssetId: 'asset-1',
          defaultVendorId: 'vendor-1',
          expenseStatus: 'submitted',
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });
    vi.mocked(deleteAdminBulkExpenseImportJob).mockResolvedValue(undefined);
  });

  it('uses Operations column header and deletes after confirmation', async () => {
    const user = userEvent.setup();
    const onAfterMutation = vi.fn();
    render(<BulkExpenseImportJobsPanel onAfterMutation={onAfterMutation} />);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Operations' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete bulk import job' }));
    await user.click(screen.getByRole('button', { name: 'Delete job' }));

    await waitFor(() => {
      expect(deleteAdminBulkExpenseImportJob).toHaveBeenCalledWith('job-1');
    });
    expect(listAdminBulkExpenseImportJobs.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onAfterMutation).toHaveBeenCalled();
  });
});
