'use client';

import { useMemo, useState } from 'react';

import { StatusBanner } from '@/components/status-banner';

import { useServicesPage } from '@/hooks/use-services-page';

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
  const allServiceOptionsIncludingArchived = state.serviceList.services;
  const pickerServiceOptions = useMemo(() => {
    if (showArchivedDiscountServices) {
      return allServiceOptionsIncludingArchived;
    }
    return allServiceOptionsIncludingArchived.filter((svc) => svc.status !== 'archived');
  }, [showArchivedDiscountServices, allServiceOptionsIncludingArchived]);
  const normalizedInstanceSearch = state.instancesSearchQuery.trim().toLowerCase();
  const filteredInstances =
    state.activeView === 'instances' && normalizedInstanceSearch
      ? state.instanceList.instances.filter((instance) => {
          const searchable = [
            instance.resolvedTitle,
            instance.title,
            instance.parentServiceTitle,
            instance.instructorId,
            instance.status,
          ]
            .filter((value): value is string => Boolean(value))
            .join(' ')
            .toLowerCase();
          return searchable.includes(normalizedInstanceSearch);
        })
      : state.instanceList.instances;
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
  }`;
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

      <ServicesHeader activeView={state.activeView} onSetView={state.setActiveView} />

      {state.activeView === 'catalog' ? (
        <>
          <ServiceDetailPanel
            key={serviceDetailPanelKey}
            service={selectedServiceDetail}
            isLoading={state.serviceMutations.isLoading}
            error={state.serviceMutations.error}
            onCancelSelection={() => state.setSelectedServiceId(null)}
            onCreate={async (payload) => {
              await state.serviceMutations.createServiceEntry(payload);
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
            onSelectService={state.setSelectedServiceId}
            onFilterChange={state.serviceList.setFilter}
            onLoadMore={state.serviceList.loadMore}
            onDeleteService={async (serviceId) => {
              if (state.selectedServiceId === serviceId) {
                state.setSelectedServiceId(null);
              }
              await state.serviceMutations.deleteServiceEntry(serviceId);
            }}
          />
        </>
      ) : state.activeView === 'instances' ? (
        <>
          <InstanceDetailPanel
            key={`${state.selectedInstanceId ?? 'create-instance'}-${state.selectedService?.serviceType ?? 'none'}`}
            instance={state.selectedInstance}
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
            onSelectService={state.setSelectedServiceId}
            onCancelSelection={() => state.setSelectedInstanceId(null)}
            onCreate={async (serviceId, payload) => {
              if (!serviceId) {
                return;
              }
              await state.instanceMutations.createInstanceEntry(serviceId, payload);
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
            instances={filteredInstances}
            selectedInstanceId={state.selectedInstanceId}
            isLoading={state.instanceList.isLoading}
            isLoadingMore={state.instanceList.isLoadingMore}
            hasMore={state.instanceList.hasMore}
            error={state.instanceList.error}
            isMutating={state.instanceMutations.isLoading}
            onSelectInstance={state.setSelectedInstanceId}
            onLoadMore={state.instanceList.loadMore}
            showServiceColumn
            showTypeColumn
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
              options: allServiceOptions.map((s) => ({ id: s.id, title: s.title })),
              onChange: state.setInstancesServiceFilter,
            }}
            onDeleteInstance={async (instanceId, serviceId) => {
              if (state.selectedInstanceId === instanceId) {
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
