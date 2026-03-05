'use client';

import { useCallback, useEffect, useState } from 'react';

import { listAdminUsers } from '@/lib/users-api';
import type { AdminUser } from '@/types/leads';
import { toErrorMessage } from './hook-errors';

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await listAdminUsers();
      setUsers(response.items);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load admin users.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { users, isLoading, error, refetch };
}
