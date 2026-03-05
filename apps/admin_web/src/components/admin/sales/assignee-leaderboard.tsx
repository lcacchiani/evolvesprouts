import type { AdminUser } from '@/types/leads';

import { Card } from '@/components/ui/card';

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
    <Card title='Team performance'>
      <div className='overflow-x-auto rounded-md border border-slate-200'>
        <table className='w-full min-w-[520px] divide-y divide-slate-200 text-left'>
          <thead className='bg-slate-100 text-xs uppercase tracking-[0.08em] text-slate-700'>
            <tr>
              <th className='px-3 py-2 font-semibold'>Assignee</th>
              <th className='px-3 py-2 font-semibold'>Total</th>
              <th className='px-3 py-2 font-semibold'>Converted</th>
              <th className='px-3 py-2 font-semibold'>Conversion rate</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-200 bg-white text-sm'>
            {values.length === 0 ? (
              <tr>
                <td className='px-3 py-6 text-slate-600' colSpan={4}>
                  No assignee performance data.
                </td>
              </tr>
            ) : (
              values.map((entry) => (
                <tr key={entry.assignedTo ?? 'unassigned'}>
                  <td className='px-3 py-2 text-slate-900'>{resolveUserLabel(entry.assignedTo, users)}</td>
                  <td className='px-3 py-2 text-slate-700'>{entry.total}</td>
                  <td className='px-3 py-2 text-slate-700'>{entry.converted}</td>
                  <td className='px-3 py-2 text-slate-700'>{(entry.conversionRate * 100).toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
