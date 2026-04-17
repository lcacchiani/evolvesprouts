'use client';

import { useCallback, useRef, useState } from 'react';

import { listInstances } from '@/lib/services-api';
import type { ServiceInstance } from '@/types/services';

import { toErrorMessage } from './hook-errors';

export interface UseServiceInstanceOptionsResult {
  instances: ServiceInstance[];
  isLoading: boolean;
  error: string;
  loadForService: (serviceId: string | null) => Promise<void>;
}

export function useServiceInstanceOptions(): UseServiceInstanceOptionsResult {
  const cacheRef = useRef<Map<string, ServiceInstance[]>>(new Map());
  const [instances, setInstances] = useState<ServiceInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      const page = await listInstances(key, { limit: 100 });
      cacheRef.current.set(key, page.items);
      setInstances(page.items);
    } catch (caught) {
      setInstances([]);
      setError(toErrorMessage(caught, 'Failed to load instances'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { instances, isLoading, error, loadForService };
}
