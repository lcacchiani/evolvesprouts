'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { toErrorMessage } from '@/hooks/hook-errors';
import { listEntityTags, type EntityTagRef } from '@/lib/entity-api';

import { useDiscountCodes } from './use-discount-codes';
import { useVenues } from './use-venues';
import { useEnrollmentList } from './use-enrollment-list';
import { useEnrollmentMutations } from './use-enrollment-mutations';
import { useInstanceList } from './use-instance-list';
import { useInstanceMutations } from './use-instance-mutations';
import { useLocationList } from './use-location-list';
import { useQueryTabState } from './use-query-tab-state';
import { useServiceDetail } from './use-service-detail';
import { useServiceList } from './use-service-list';
import { useServiceMutations } from './use-service-mutations';

export type ServicesView = 'catalog' | 'instances' | 'discount-codes' | 'venues';

export const SERVICES_VIEW_KEYS: readonly ServicesView[] = [
  'catalog',
  'instances',
  'discount-codes',
  'venues',
];
export const DEFAULT_SERVICES_VIEW: ServicesView = 'catalog';

export function useServicesPage() {
  const [activeView, setActiveView] = useQueryTabState<ServicesView>(
    SERVICES_VIEW_KEYS,
    DEFAULT_SERVICES_VIEW
  );
  const [selectedServiceIdState, setSelectedServiceIdState] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [instanceOptionsCacheVersion, setInstanceOptionsCacheVersion] = useState(0);
  const [instancesServiceFilter, setInstancesServiceFilter] = useState<string>('');
  const [instancesServiceTypeFilter, setInstancesServiceTypeFilter] = useState<string>('');
  const [instancesSearchQuery, setInstancesSearchQuery] = useState<string>('');
  const [entityTags, setEntityTags] = useState<EntityTagRef[]>([]);
  const [entityTagsLoading, setEntityTagsLoading] = useState(false);
  const [entityTagsError, setEntityTagsError] = useState('');

  const serviceList = useServiceList();
  const selectedServiceId = selectedServiceIdState;

  const setSelectedServiceId = useCallback((serviceId: string | null) => {
    setSelectedServiceIdState(serviceId);
    setSelectedInstanceId(null);
  }, []);

  useEffect(() => {
    if (activeView !== 'instances') {
      return;
    }
    let cancelled = false;
    void (async () => {
      setEntityTagsLoading(true);
      try {
        const tagList = await listEntityTags();
        if (!cancelled) {
          setEntityTags(tagList);
          setEntityTagsError('');
        }
      } catch (error) {
        if (!cancelled) {
          setEntityTagsError(toErrorMessage(error, 'Failed to load tags.'));
        }
      } finally {
        if (!cancelled) {
          setEntityTagsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeView]);

  const serviceDetail = useServiceDetail(selectedServiceId);
  const instanceList = useInstanceList(
    activeView === 'instances' ? null : selectedServiceId,
    activeView === 'instances'
      ? {
          listAllInstances: true,
          filterServiceId: instancesServiceFilter || null,
          filterServiceType: instancesServiceTypeFilter || null,
        }
      : undefined
  );

  const selectedService = useMemo(
    () => serviceList.services.find((entry) => entry.id === selectedServiceId) ?? null,
    [serviceList.services, selectedServiceId]
  );
  const selectedInstance = useMemo(
    () => instanceList.instances.find((entry) => entry.id === selectedInstanceId) ?? null,
    [instanceList.instances, selectedInstanceId]
  );

  const enrollmentServiceId =
    activeView === 'instances' ? (selectedInstance?.serviceId ?? null) : selectedServiceId;
  const enrollmentList = useEnrollmentList(enrollmentServiceId, selectedInstanceId);
  const locationList = useLocationList();
  const discountCodes = useDiscountCodes();
  const venues = useVenues({
    onMutationSuccess: async () => {
      await locationList.refetch();
    },
  });

  const serviceMutations = useServiceMutations({
    onSuccess: async (serviceId) => {
      await serviceList.refetch();
      if (serviceId) {
        setSelectedServiceIdState((current) => (current ? serviceId : current));
      }
      await serviceDetail.refetch();
      await instanceList.refetch();
      await enrollmentList.refetch();
    },
  });
  const instanceMutations = useInstanceMutations({
    onSuccess: async (instanceId) => {
      setInstanceOptionsCacheVersion((v) => v + 1);
      await instanceList.refetch();
      if (instanceId) {
        setSelectedInstanceId((current) => (current ? instanceId : current));
      }
      await enrollmentList.refetch();
    },
  });
  const enrollmentMutations = useEnrollmentMutations({
    onSuccess: async () => {
      await enrollmentList.refetch();
      await instanceList.refetch();
    },
  });

  const setSelectedInstanceIdWithMode = useCallback((instanceId: string | null) => {
    setSelectedInstanceId(instanceId);
  }, []);

  return {
    activeView,
    setActiveView,
    instanceOptionsCacheVersion,
    setInstanceOptionsCacheVersion,
    selectedServiceId,
    setSelectedServiceId,
    selectedService,
    selectedInstanceId,
    setSelectedInstanceId: setSelectedInstanceIdWithMode,
    selectedInstance,
    instancesServiceFilter,
    setInstancesServiceFilter,
    instancesServiceTypeFilter,
    setInstancesServiceTypeFilter,
    instancesSearchQuery,
    setInstancesSearchQuery,
    entityTags,
    entityTagsLoading,
    entityTagsError,
    serviceList,
    serviceDetail,
    serviceMutations,
    instanceList,
    instanceMutations,
    enrollmentList,
    enrollmentMutations,
    locationList,
    discountCodes,
    venues,
  };
}
