'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { clampAdminListLimit } from '@/lib/admin-list-limit';
import { listInstances } from '@/lib/services-api';
import type { ServiceInstance } from '@/types/services';

import { toErrorMessage } from './hook-errors';

export interface UseServiceInstanceOptionsResult {
  instances: ServiceInstance[];
  isLoading: boolean;
  error: string;
  loadForService: (serviceId: string | null) => Promise<void>;
  /** Clears cached instance lists; omit serviceId to clear all services. */
  invalidate: (serviceId?: string | null) => void;
}

export function useServiceInstanceOptions(refreshKey?: unknown): UseServiceInstanceOptionsResult {
  const cacheRef = useRef<Map<string, ServiceInstance[]>>(new Map());
  const [instances, setInstances] = useState<ServiceInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cacheRef.current.clear();
  }, [refreshKey]);

  const invalidate = useCallback((serviceId?: string | null) => {
    if (serviceId?.trim()) {
      cacheRef.current.delete(serviceId.trim());
      return;
    }
    cacheRef.current.clear();
  }, []);

  const loadForService = useCallback(async (serviceId: string | null) => {
    if (!serviceId?.trim()) {
      setInstances([]);
      setError('');
      return;
    }
    const key = serviceId.trim();
    const cached = cacheRef.current.get(key);
    if (cached) {
      setInstances(cached);
      setError('');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const page = await listInstances(key, { limit: clampAdminListLimit(100) });
      cacheRef.current.set(key, page.items);
      setInstances(page.items);
    } catch (caught) {
      setInstances([]);
      setError(toErrorMessage(caught, 'Failed to load instances'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { instances, isLoading, error, loadForService, invalidate };
}
