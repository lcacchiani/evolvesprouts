'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDiscountCodes } from './use-discount-codes';
import { useVenues } from './use-venues';
import { useEnrollmentList } from './use-enrollment-list';
import { useEnrollmentMutations } from './use-enrollment-mutations';
import { useInstanceList } from './use-instance-list';
import { useInstanceMutations } from './use-instance-mutations';
import { useLocationList } from './use-location-list';
import { useServiceDetail } from './use-service-detail';
import { useServiceList } from './use-service-list';
import { useServiceMutations } from './use-service-mutations';

export type ServicesView = 'catalog' | 'events' | 'discount-codes' | 'venues';

export function useServicesPage() {
  const [activeView, setActiveView] = useState<ServicesView>('catalog');
  const [selectedServiceIdState, setSelectedServiceIdState] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const prevActiveViewRef = useRef<ServicesView>('catalog');
  const shouldAutoSelectFirstServiceOnEventsRef = useRef(false);

  const serviceList = useServiceList();
  const selectedServiceId = selectedServiceIdState;

  const setSelectedServiceId = useCallback((serviceId: string | null) => {
    setSelectedServiceIdState(serviceId);
    setSelectedInstanceId(null);
  }, []);

  const serviceDetail = useServiceDetail(selectedServiceId);
  const instanceList = useInstanceList(selectedServiceId);
  const enrollmentList = useEnrollmentList(selectedServiceId, selectedInstanceId);
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

  const selectedService = useMemo(
    () => serviceList.services.find((entry) => entry.id === selectedServiceId) ?? null,
    [serviceList.services, selectedServiceId]
  );
  const selectedInstance = useMemo(
    () => instanceList.instances.find((entry) => entry.id === selectedInstanceId) ?? null,
    [instanceList.instances, selectedInstanceId]
  );

  const setSelectedInstanceIdWithMode = useCallback((instanceId: string | null) => {
    setSelectedInstanceId(instanceId);
  }, []);

  useEffect(() => {
    const previous = prevActiveViewRef.current;
    prevActiveViewRef.current = activeView;
    if (activeView !== 'events') {
      shouldAutoSelectFirstServiceOnEventsRef.current = false;
      return;
    }
    if (previous !== 'events' && !selectedServiceId) {
      shouldAutoSelectFirstServiceOnEventsRef.current = true;
    }
  }, [activeView, selectedServiceId]);

  useEffect(() => {
    if (activeView !== 'events') {
      return;
    }
    if (!shouldAutoSelectFirstServiceOnEventsRef.current) {
      return;
    }
    if (serviceList.isLoading) {
      return;
    }
    const eventService = serviceList.services.find((entry) => entry.serviceType === 'event');
    const first = eventService ?? serviceList.services[0];
    if (first) {
      setSelectedServiceIdState(first.id);
    }
    shouldAutoSelectFirstServiceOnEventsRef.current = false;
  }, [activeView, serviceList.isLoading, serviceList.services]);

  return {
    activeView,
    setActiveView,
    selectedServiceId,
    setSelectedServiceId,
    selectedService,
    selectedInstanceId,
    setSelectedInstanceId: setSelectedInstanceIdWithMode,
    selectedInstance,
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
