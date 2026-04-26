'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  createPublicCrmApiClient,
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  type EventsFetchParams,
  type MyBestAuntieEventCohort,
  fetchEventsPayload,
  normalizeMyBestAuntieCohortsFromPayload,
} from '@/lib/events-data';

export interface UseMyBestAuntieCohortsOptions {
  initialCohorts: MyBestAuntieEventCohort[];
  serviceKey: string;
  serviceType: EventsFetchParams['serviceType'];
}

export interface UseMyBestAuntieCohortsResult {
  cohorts: MyBestAuntieEventCohort[];
  isLoading: boolean;
  hasRequestError: boolean;
}

export function useMyBestAuntieCohorts({
  initialCohorts,
  serviceKey,
  serviceType,
}: UseMyBestAuntieCohortsOptions): UseMyBestAuntieCohortsResult {
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const shouldFetch = crmApiClient !== null;
  const initialCohortsRef = useRef(initialCohorts);
  const [cohorts, setCohorts] = useState<MyBestAuntieEventCohort[]>(initialCohorts);
  const [isLoading, setIsLoading] = useState(() => shouldFetch);
  const [hasRequestError, setHasRequestError] = useState(false);

  useEffect(() => {
    initialCohortsRef.current = initialCohorts;
  }, [initialCohorts]);

  useEffect(() => {
    const controller = new AbortController();

    if (!shouldFetch || !crmApiClient) {
      return () => {
        controller.abort();
      };
    }

    fetchEventsPayload(crmApiClient, controller.signal, {
      serviceKey,
      serviceType,
    })
      .then((payload) => {
        const normalized = normalizeMyBestAuntieCohortsFromPayload(payload);
        setHasRequestError(false);
        setCohorts(normalized);
      })
      .catch((error) => {
        if (isAbortRequestError(error)) {
          return;
        }
        setHasRequestError(true);
        setCohorts(initialCohortsRef.current);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [crmApiClient, serviceKey, serviceType, shouldFetch]);

  const effectiveCohorts =
    isLoading || hasRequestError ? initialCohorts : cohorts;

  return {
    cohorts: effectiveCohorts,
    isLoading,
    hasRequestError,
  };
}
