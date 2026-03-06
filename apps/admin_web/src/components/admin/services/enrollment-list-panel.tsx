'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import type { Enrollment } from '@/types/services';

export interface EnrollmentListPanelProps {
  enrollments: Enrollment[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  onLoadMore: () => Promise<void> | void;
  onOpenCreate: () => void;
  onUpdateStatus: (enrollmentId: string, status: Enrollment['status']) => Promise<void> | void;
  onDelete: (enrollmentId: string) => Promise<void> | void;
}

export function EnrollmentListPanel({
  enrollments,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onOpenCreate,
  onUpdateStatus,
  onDelete,
}: EnrollmentListPanelProps) {
  return (
    <Card title='Enrollments'>
      <div className='mb-2 flex justify-end'>
        <Button type='button' size='sm' onClick={onOpenCreate}>
          New enrollment
        </Button>
      </div>
      {error ? <p className='mb-2 text-sm text-red-600'>{error}</p> : null}
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[760px] text-left text-sm'>
          <thead className='text-slate-500'>
            <tr>
              <th className='py-2 pr-3 font-medium'>Parent</th>
              <th className='py-2 pr-3 font-medium'>Status</th>
              <th className='py-2 pr-3 font-medium'>Amount</th>
              <th className='py-2 pr-3 font-medium'>Enrolled at</th>
              <th className='py-2 pr-3 font-medium'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => (
              <tr key={enrollment.id} className='border-t'>
                <td className='py-2 pr-3'>
                  {enrollment.contactId ?? enrollment.familyId ?? enrollment.organizationId ?? '-'}
                </td>
                <td className='py-2 pr-3'>{enrollment.status}</td>
                <td className='py-2 pr-3'>
                  {enrollment.amountPaid ? `${enrollment.amountPaid} ${enrollment.currency ?? ''}` : '-'}
                </td>
                <td className='py-2 pr-3'>{enrollment.enrolledAt ?? '-'}</td>
                <td className='py-2 pr-3'>
                  <div className='flex gap-1'>
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      onClick={() => void onUpdateStatus(enrollment.id, 'confirmed')}
                    >
                      Confirm
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      onClick={() => void onDelete(enrollment.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isLoading ? <p className='mt-3 text-sm text-slate-500'>Loading enrollments...</p> : null}
      {hasMore ? (
        <div className='mt-3'>
          <Button type='button' variant='outline' onClick={() => void onLoadMore()} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
