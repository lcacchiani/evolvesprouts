'use client';

import { useCallback, useEffect, useState } from 'react';

import { listAdminUsers } from '@/lib/users-api';
import type { AdminUser } from '@/types/leads';

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

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
