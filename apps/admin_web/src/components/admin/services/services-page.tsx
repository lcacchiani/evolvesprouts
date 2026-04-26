'use client';

import { useCallback, useMemo, useState } from 'react';

import { StatusBanner } from '@/components/status-banner';

import { useServicesPage, type ServicesView } from '@/hooks/use-services-page';
import { compareInstancesByFirstSlotStartsDesc, formatServiceTitleWithTier } from '@/lib/format';
import { getInstance, getService } from '@/lib/services-api';
import type { ServiceDetail, ServiceInstance } from '@/types/services';

import { DiscountCodesPanel } from './discount-codes-panel';
import { VenuesPanel } from './venues-panel';
import { EnrollmentListPanel } from './enrollment-list-panel';
import { InstanceDetailPanel } from './instance-detail-panel';
import { InstanceListPanel } from './instance-list-panel';
import { ServiceDetailPanel } from './service-detail-panel';
import { ServiceListPanel } from './service-list-panel';
import { PartnersTab } from './partners-tab';
import { ServicesHeader } from './services-header';

export function ServicesPage() {
  const state = useServicesPage();
  const [showArchivedDiscountServices, setShowArchivedDiscountServices] = useState(false);
  const [duplicateServiceTemplate, setDuplicateServiceTemplate] = useState<ServiceDetail | null>(null);
  const [duplicateInstanceTemplate, setDuplicateInstanceTemplate] = useState<ServiceInstance | null>(null);
  const [servicesEditorRemountKey, setServicesEditorRemountKey] = useState(0);

  const bumpServicesEditorKey = useCallback(() => {
    setServicesEditorRemountKey((key) => key + 1);
  }, []);

  const handleDuplicateService = useCallback(async (serviceId: string) => {
    const detail = await getService(serviceId);
    if (!detail) {
      return false;
    }
    setDuplicateInstanceTemplate(null);
    setDuplicateServiceTemplate(detail);
    state.setSelectedServiceId(null);
    bumpServicesEditorKey();
    return true;
  }, [bumpServicesEditorKey, state]);

  const handleDuplicateInstance = useCallback(
    async (instance: ServiceInstance) => {
      const full = await getInstance(instance.serviceId, instance.id);
      const row = full ?? instance;
      setDuplicateServiceTemplate(null);
      setDuplicateInstanceTemplate(row);
      state.setSelectedServiceId(row.serviceId);
      bumpServicesEditorKey();
      return true;
    },
    [bumpServicesEditorKey, state]
  );

  const handleSetActiveView = useCallback(
    (view: ServicesView) => {
      if (view !== 'catalog') {
        setDuplicateServiceTemplate(null);
      }
      if (view !== 'instances') {
        setDuplicateInstanceTemplate(null);
      }
      state.setActiveView(view);
    },
    [state]
  );
  const allServiceOptionsIncludingArchived = state.serviceList.services;
  const pickerServiceOptions = useMemo(() => {
    if (showArchivedDiscountServices) {
      return allServiceOptionsIncludingArchived;
    }
    return allServiceOptionsIncludingArchived.filter((svc) => svc.status !== 'archived');
  }, [showArchivedDiscountServices, allServiceOptionsIncludingArchived]);
  const normalizedInstanceSearch = state.instancesSearchQuery.trim().toLowerCase();
  const filteredInstances = useMemo(() => {
    if (state.activeView !== 'instances' || !normalizedInstanceSearch) {
      return state.instanceList.instances;
    }
    return state.instanceList.instances.filter((instance) => {
      const parts: string[] = [
        instance.resolvedTitle,
        instance.title,
        instance.parentServiceTitle,
        instance.parentServiceTier,
        instance.parentServiceTitle
          ? formatServiceTitleWithTier(instance.parentServiceTitle, instance.parentServiceTier)
          : null,
        instance.instructorId,
        instance.status,
      ].filter((value): value is string => Boolean(value));
      const cohortTrimmed = instance.cohort?.trim();
      if (cohortTrimmed) {
        parts.push(cohortTrimmed);
      }
      const searchable = parts.join(' ').toLowerCase();
      return searchable.includes(normalizedInstanceSearch);
    });
  }, [normalizedInstanceSearch, state.activeView, state.instanceList.instances]);
  const instancesTableRows = useMemo(() => {
    if (state.activeView !== 'instances') {
      return filteredInstances;
    }
    return [...filteredInstances].sort(compareInstancesByFirstSlotStartsDesc);
  }, [filteredInstances, state.activeView]);
  const instancesContextServiceId =
    state.activeView === 'instances'
      ? (state.selectedInstance?.serviceId ?? state.selectedServiceId)
      : state.selectedServiceId;
  const allServiceOptions = state.serviceList.services;
  const selectedServiceDetail =
    state.selectedServiceId && state.serviceDetail.service?.id === state.selectedServiceId
      ? state.serviceDetail.service
      : null;
  const serviceDetailPanelKey = `${state.selectedServiceId ?? 'create-service'}-${
    selectedServiceDetail ? 'loaded' : 'empty'
  }-${servicesEditorRemountKey}-${duplicateServiceTemplate?.id ?? ''}`;
  const instanceDetailPanelKey = `${state.selectedInstanceId ?? 'create-instance'}-${
    state.selectedService?.serviceType ?? 'none'
  }-${servicesEditorRemountKey}-${duplicateInstanceTemplate?.id ?? ''}`;
  const hasAnyError =
    state.serviceList.error ||
    state.serviceDetail.error ||
    state.serviceMutations.error ||
    state.instanceList.error ||
    state.instanceMutations.error ||
    state.enrollmentList.error ||
    state.enrollmentMutations.error ||
    state.discountCodes.error ||
    state.venues.error;

  return (
    <div className='space-y-4'>
      {hasAnyError ? (
        <StatusBanner variant='error' title='Services'>
          {hasAnyError}
        </StatusBanner>
      ) : null}

      <ServicesHeader activeView={state.activeView} onSetView={handleSetActiveView} />

      {state.activeView === 'catalog' ? (
        <>
          <ServiceDetailPanel
            key={serviceDetailPanelKey}
            service={selectedServiceDetail}
            createPrefillFromService={duplicateServiceTemplate}
            locationOptions={state.locationList.locations}
            isLoadingLocations={state.isLoadingLocations}
            locationError={state.locationError || undefined}
            isLoading={state.serviceMutations.isLoading}
            error={state.serviceMutations.error}
            onCancelSelection={() => {
              setDuplicateServiceTemplate(null);
              state.setSelectedServiceId(null);
            }}
            onCreate={async (payload) => {
              await state.serviceMutations.createServiceEntry(payload);
              setDuplicateServiceTemplate(null);
              state.setSelectedServiceId(null);
            }}
            onUpdate={async (payload) => {
              if (!state.selectedServiceId) {
                return;
              }
              await state.serviceMutations.updateServiceEntry(state.selectedServiceId, payload, true);
            }}
            onUploadCover={async (fileName, contentType) => {
              if (!state.selectedServiceId) {
                return;
              }
              await state.serviceMutations.createCoverImageUpload(state.selectedServiceId, {
                file_name: fileName,
                content_type: contentType,
              });
            }}
          />
          <ServiceListPanel
            services={state.serviceList.services}
            selectedServiceId={state.selectedServiceId}
            filters={state.serviceList.filters}
            isLoading={state.serviceList.isLoading}
            isLoadingMore={state.serviceList.isLoadingMore}
            hasMore={state.serviceList.hasMore}
            error={state.serviceList.error}
            isMutating={state.serviceMutations.isLoading}
            onSelectService={(serviceId) => {
              setDuplicateServiceTemplate(null);
              state.setSelectedServiceId(serviceId);
            }}
            onFilterChange={state.serviceList.setFilter}
            onLoadMore={state.serviceList.loadMore}
            onDuplicateService={handleDuplicateService}
            onDeleteService={async (serviceId) => {
              if (state.selectedServiceId === serviceId) {
                setDuplicateServiceTemplate(null);
                state.setSelectedServiceId(null);
              }
              await state.serviceMutations.deleteServiceEntry(serviceId);
            }}
          />
        </>
      ) : state.activeView === 'instances' ? (
        <>
          <InstanceDetailPanel
            key={instanceDetailPanelKey}
            instance={state.selectedInstance}
            createPrefillInstance={duplicateInstanceTemplate}
            entityTags={state.entityTags}
            entityTagsLoading={state.entityTagsLoading}
            entityTagsError={state.entityTagsError}
            selectedServiceId={instancesContextServiceId}
            serviceOptions={allServiceOptions}
            locationOptions={state.locationList.locations}
            isLoadingLocations={state.locationList.isLoading}
            serviceType={
              state.selectedInstance?.parentServiceType ??
              state.selectedService?.serviceType ??
              null
            }
            isLoading={state.instanceMutations.isLoading}
            error={state.instanceMutations.error}
            locationError={state.locationList.error}
            onSelectService={(serviceId) => {
              setDuplicateInstanceTemplate(null);
              state.setSelectedServiceId(serviceId);
            }}
            onCancelSelection={() => {
              setDuplicateInstanceTemplate(null);
              state.setSelectedInstanceId(null);
            }}
            onCreate={async (serviceId, payload) => {
              if (!serviceId) {
                return;
              }
              await state.instanceMutations.createInstanceEntry(serviceId, payload);
              setDuplicateInstanceTemplate(null);
              state.setSelectedInstanceId(null);
            }}
            onUpdate={async (serviceId, instanceId, payload) => {
              if (!serviceId) {
                return;
              }
              await state.instanceMutations.updateInstanceEntry(serviceId, instanceId, payload);
            }}
          />
          <InstanceListPanel
            instances={instancesTableRows}
            selectedInstanceId={state.selectedInstanceId}
            isLoading={state.instanceList.isLoading}
            isLoadingMore={state.instanceList.isLoadingMore}
            hasMore={state.instanceList.hasMore}
            error={state.instanceList.error}
            isMutating={state.instanceMutations.isLoading}
            onSelectInstance={(instanceId) => {
              setDuplicateInstanceTemplate(null);
              state.setSelectedInstanceId(instanceId);
            }}
            onLoadMore={state.instanceList.loadMore}
            showServiceColumn
            searchFilter={{
              value: state.instancesSearchQuery,
              onChange: state.setInstancesSearchQuery,
            }}
            serviceTypeFilter={{
              value: state.instancesServiceTypeFilter,
              onChange: state.setInstancesServiceTypeFilter,
            }}
            serviceFilter={{
              value: state.instancesServiceFilter,
              options: allServiceOptions.map((s) => ({
                id: s.id,
                title: formatServiceTitleWithTier(s.title, s.serviceTier),
              })),
              onChange: state.setInstancesServiceFilter,
            }}
            onDuplicateInstance={handleDuplicateInstance}
            onDeleteInstance={async (instanceId, serviceId) => {
              if (state.selectedInstanceId === instanceId) {
                setDuplicateInstanceTemplate(null);
                state.setSelectedInstanceId(null);
              }
              await state.instanceMutations.deleteInstanceEntry(serviceId, instanceId);
            }}
          />
          <EnrollmentListPanel
            enrollments={state.enrollmentList.enrollments}
            canCreate={Boolean(instancesContextServiceId && state.selectedInstanceId)}
            isLoading={state.enrollmentList.isLoading}
            isLoadingMore={state.enrollmentList.isLoadingMore}
            hasMore={state.enrollmentList.hasMore}
            error={state.enrollmentList.error}
            isMutating={state.enrollmentMutations.isLoading}
            onLoadMore={state.enrollmentList.loadMore}
            onCreate={async (payload) => {
              if (!instancesContextServiceId || !state.selectedInstanceId) {
                return;
              }
              await state.enrollmentMutations.createEnrollmentEntry(
                instancesContextServiceId,
                state.selectedInstanceId,
                payload
              );
            }}
            onUpdate={async (enrollmentId, payload) => {
              if (!instancesContextServiceId || !state.selectedInstanceId) {
                return;
              }
              await state.enrollmentMutations.updateEnrollmentEntry(
                instancesContextServiceId,
                state.selectedInstanceId,
                enrollmentId,
                payload
              );
            }}
            onDelete={async (enrollmentId) => {
              if (!instancesContextServiceId || !state.selectedInstanceId) {
                return;
              }
              await state.enrollmentMutations.deleteEnrollmentEntry(
                instancesContextServiceId,
                state.selectedInstanceId,
                enrollmentId
              );
            }}
          />
        </>
      ) : state.activeView === 'discount-codes' ? (
        <DiscountCodesPanel
          codes={state.discountCodes.codes}
          filters={state.discountCodes.filters}
          isLoading={state.discountCodes.isLoading}
          isLoadingMore={state.discountCodes.isLoadingMore}
          isSaving={state.discountCodes.isSaving}
          hasMore={state.discountCodes.hasMore}
          error={state.discountCodes.error}
          serviceOptions={pickerServiceOptions}
          serviceDirectoryForDisplay={allServiceOptionsIncludingArchived}
          instanceOptionsRefreshKey={state.instanceOptionsCacheVersion}
          showArchivedServices={showArchivedDiscountServices}
          onShowArchivedChange={setShowArchivedDiscountServices}
          onFilterChange={state.discountCodes.setFilter}
          onLoadMore={state.discountCodes.loadMore}
          onCreate={(payload, options) =>
            state.discountCodes.createCode(payload, {
              suppressSaving: options?.batchSaving,
            })
          }
          onUpdate={state.discountCodes.updateCode}
          onDelete={state.discountCodes.deleteCode}
          onDiscountCodesRefresh={state.discountCodes.refetch}
        />
      ) : state.activeView === 'venues' ? (
        <VenuesPanel
          venues={state.venues.venues}
          geographicAreas={state.venues.geographicAreas}
          areasLoading={state.venues.areasLoading}
          filters={state.venues.filters}
          isLoading={state.venues.isLoading}
          isLoadingMore={state.venues.isLoadingMore}
          isSaving={state.venues.isSaving}
          hasMore={state.venues.hasMore}
          error={state.venues.error}
          onFilterChange={state.venues.setFilter}
          onLoadMore={state.venues.loadMore}
          onCreate={state.venues.createVenue}
          onUpdate={state.venues.updateVenue}
          onUpdatePartial={state.venues.updateVenuePartial}
          onDelete={state.venues.deleteVenue}
        />
      ) : (
        <PartnersTab
          locations={state.locationList.locations}
          geographicAreas={state.venues.geographicAreas}
          areasLoading={state.venues.areasLoading}
          refreshLocations={async () => {
            await state.locationList.refetch();
          }}
        />
      )}
    </div>
  );
}
