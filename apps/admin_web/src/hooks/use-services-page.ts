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
  const [isCreateEnrollmentDialogOpen, setIsCreateEnrollmentDialogOpen] = useState(false);

  const serviceList = useServiceList();

  const selectedServiceId = useMemo(() => {
    if (selectedServiceIdState !== undefined) {
      return selectedServiceIdState;
    }
    return serviceList.services[0]?.id ?? null;
  }, [selectedServiceIdState, serviceList.services]);

  const setSelectedServiceId = useCallback((serviceId: string | null) => {
    setSelectedServiceIdState(serviceId);
    setSelectedInstanceId(null);
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

  return {
    activeView,
    setActiveView,
    selectedServiceId,
    setSelectedServiceId,
    selectedService,
    selectedInstanceId,
    setSelectedInstanceId,
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
    setIsCreateServiceDialogOpen,
    isCreateInstanceDialogOpen,
    setIsCreateInstanceDialogOpen,
    isCreateEnrollmentDialogOpen,
    setIsCreateEnrollmentDialogOpen,
  };
}
