'use client';

import { useCallback, useMemo, useState } from 'react';

import { useDiscountCodes } from './use-discount-codes';
import { useEnrollmentList } from './use-enrollment-list';
import { useEnrollmentMutations } from './use-enrollment-mutations';
import { useInstanceList } from './use-instance-list';
import { useInstanceMutations } from './use-instance-mutations';
import { useServiceDetail } from './use-service-detail';
import { useServiceList } from './use-service-list';
import { useServiceMutations } from './use-service-mutations';

export type ServicesView = 'catalog' | 'discount-codes';

export function useServicesPage() {
  const [activeView, setActiveView] = useState<ServicesView>('catalog');
  const [selectedServiceIdState, setSelectedServiceIdState] = useState<string | null | undefined>(
    undefined
  );
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [isCreateServiceDialogOpen, setIsCreateServiceDialogOpen] = useState(false);
  const [isCreateInstanceDialogOpen, setIsCreateInstanceDialogOpen] = useState(false);

  const serviceList = useServiceList();

  const selectedServiceId = useMemo(() => {
    if (isCreateServiceDialogOpen) {
      return null;
    }
    if (selectedServiceIdState !== undefined) {
      return selectedServiceIdState;
    }
    return serviceList.services[0]?.id ?? null;
  }, [isCreateServiceDialogOpen, selectedServiceIdState, serviceList.services]);

  const setSelectedServiceId = useCallback((serviceId: string | null) => {
    setSelectedServiceIdState(serviceId);
    setSelectedInstanceId(null);
    setIsCreateServiceDialogOpen(false);
    setIsCreateInstanceDialogOpen(false);
  }, []);

  const serviceDetail = useServiceDetail(selectedServiceId);
  const instanceList = useInstanceList(selectedServiceId);
  const enrollmentList = useEnrollmentList(selectedServiceId, selectedInstanceId);
  const discountCodes = useDiscountCodes();

  const serviceMutations = useServiceMutations({
    onSuccess: async (serviceId) => {
      await serviceList.refetch();
      if (serviceId) {
        setSelectedServiceIdState(serviceId);
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
        setSelectedInstanceId(instanceId);
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
    setIsCreateInstanceDialogOpen(false);
  }, []);

  const startCreateService = useCallback(() => {
    setSelectedServiceIdState(null);
    setSelectedInstanceId(null);
    setIsCreateServiceDialogOpen(true);
    setIsCreateInstanceDialogOpen(false);
  }, []);

  const cancelCreateService = useCallback(() => {
    setIsCreateServiceDialogOpen(false);
  }, []);

  const startCreateInstance = useCallback(() => {
    setSelectedInstanceId(null);
    setIsCreateInstanceDialogOpen(true);
  }, []);

  const cancelCreateInstance = useCallback(() => {
    setIsCreateInstanceDialogOpen(false);
  }, []);

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
    discountCodes,
    isCreateServiceDialogOpen,
    startCreateService,
    cancelCreateService,
    isCreateInstanceDialogOpen,
    startCreateInstance,
    cancelCreateInstance,
  };
}
