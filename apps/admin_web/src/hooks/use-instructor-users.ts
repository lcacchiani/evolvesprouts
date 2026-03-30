'use client';

import { useCallback, useEffect, useState } from 'react';

import { listInstructorUsers } from '@/lib/users-api';
import type { AdminUser } from '@/types/leads';
import { toErrorMessage } from './hook-errors';

export function useInstructorUsers(enabled: boolean) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    if (!enabled) {
      setUsers([]);
      setIsLoading(false);
      setError('');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await listInstructorUsers();
      setUsers(response.items);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load instructors.'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { users, isLoading, error, refetch };
}
