import type { AdminUser } from '@/types/leads';

import { Card } from '@/components/ui/card';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHead,
  AdminDataTableHeadCell,
} from '@/components/ui/admin-data-table';

export interface AssigneeLeaderboardProps {
  users: AdminUser[];
  values: Array<{
    assignedTo: string | null;
    total: number;
    converted: number;
    conversionRate: number;
  }>;
}

function resolveUserLabel(sub: string | null, users: AdminUser[]): string {
  if (!sub) {
    return 'Unassigned';
  }
  const user = users.find((entry) => entry.sub === sub);
  return user?.name || user?.email || sub;
}

export function AssigneeLeaderboard({ users, values }: AssigneeLeaderboardProps) {
  return (
    <Card title='Team Performance'>
      <div className='overflow-x-auto'>
        <AdminDataTable tableClassName='min-w-[520px]'>
          <AdminDataTableHead>
            <tr>
              <AdminDataTableHeadCell>Assignee</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Total</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Converted</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Conversion rate</AdminDataTableHeadCell>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {values.length === 0 ? (
              <tr>
                <AdminDataTableCell colSpan={4} className='py-6 text-slate-600'>
                  No assignee performance data.
                </AdminDataTableCell>
              </tr>
            ) : (
              values.map((entry) => (
                <tr key={entry.assignedTo ?? 'unassigned'}>
                  <AdminDataTableCell className='text-slate-900'>
                    {resolveUserLabel(entry.assignedTo, users)}
                  </AdminDataTableCell>
                  <AdminDataTableCell className='text-slate-700'>{entry.total}</AdminDataTableCell>
                  <AdminDataTableCell className='text-slate-700'>{entry.converted}</AdminDataTableCell>
                  <AdminDataTableCell className='text-slate-700'>
                    {(entry.conversionRate * 100).toFixed(1)}%
                  </AdminDataTableCell>
                </tr>
              ))
            )}
          </AdminDataTableBody>
        </AdminDataTable>
      </div>
    </Card>
  );
}
