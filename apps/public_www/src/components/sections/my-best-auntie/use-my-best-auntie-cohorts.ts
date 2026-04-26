'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Locale } from '@/content';
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
  locale: Locale;
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
  locale,
  initialCohorts,
  serviceKey,
  serviceType,
}: UseMyBestAuntieCohortsOptions): UseMyBestAuntieCohortsResult {
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const shouldFetch = crmApiClient !== null;
  const [cohorts, setCohorts] = useState<MyBestAuntieEventCohort[]>(initialCohorts);
  const [isLoading, setIsLoading] = useState(() => shouldFetch);
  const [hasRequestError, setHasRequestError] = useState(false);

  useEffect(() => {
    setCohorts(initialCohorts);
  }, [initialCohorts]);

  useEffect(() => {
    const controller = new AbortController();

    if (!shouldFetch || !crmApiClient) {
      setIsLoading(false);
      return () => {
        controller.abort();
      };
    }

    fetchEventsPayload(crmApiClient, controller.signal, {
      serviceKey,
      serviceType,
    })
      .then((payload) => {
        const normalized = normalizeMyBestAuntieCohortsFromPayload(payload, locale);
        setHasRequestError(false);
        setCohorts(normalized);
      })
      .catch((error) => {
        if (isAbortRequestError(error)) {
          return;
        }
        setHasRequestError(true);
        setCohorts(initialCohorts);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [crmApiClient, initialCohorts, locale, serviceKey, serviceType, shouldFetch]);

  const effectiveCohorts =
    isLoading || hasRequestError ? initialCohorts : cohorts;

  return {
    cohorts: effectiveCohorts,
    isLoading,
    hasRequestError,
  };
}
