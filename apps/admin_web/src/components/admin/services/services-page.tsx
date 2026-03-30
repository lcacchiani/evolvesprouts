'use client';

import { StatusBanner } from '@/components/status-banner';

import { useServicesPage } from '@/hooks/use-services-page';

import { DiscountCodesPanel } from './discount-codes-panel';
import { VenuesPanel } from './venues-panel';
import { EnrollmentListPanel } from './enrollment-list-panel';
import { InstanceDetailPanel } from './instance-detail-panel';
import { InstanceListPanel } from './instance-list-panel';
import { ServiceDetailPanel } from './service-detail-panel';
import { ServiceListPanel } from './service-list-panel';
import { ServicesHeader } from './services-header';

export function ServicesPage() {
  const state = useServicesPage();
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
      ) : state.activeView === 'events' ? (
        <>
          <InstanceDetailPanel
            key={`${state.selectedInstanceId ?? 'create-instance'}-${state.selectedService?.serviceType ?? 'none'}`}
            instance={state.selectedInstance}
            selectedServiceId={state.selectedServiceId}
            serviceOptions={state.serviceList.services}
            locationOptions={state.locationList.locations}
            isLoadingLocations={state.locationList.isLoading}
            serviceType={state.selectedService?.serviceType ?? null}
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
            instances={state.instanceList.instances}
            selectedInstanceId={state.selectedInstanceId}
            isLoading={state.instanceList.isLoading}
            isLoadingMore={state.instanceList.isLoadingMore}
            hasMore={state.instanceList.hasMore}
            error={state.instanceList.error}
            isMutating={state.instanceMutations.isLoading}
            onSelectInstance={state.setSelectedInstanceId}
            onLoadMore={state.instanceList.loadMore}
            onDeleteInstance={async (instanceId) => {
              if (!state.selectedServiceId) {
                return;
              }
              if (state.selectedInstanceId === instanceId) {
                state.setSelectedInstanceId(null);
              }
              await state.instanceMutations.deleteInstanceEntry(state.selectedServiceId, instanceId);
            }}
          />
          <EnrollmentListPanel
            enrollments={state.enrollmentList.enrollments}
            canCreate={Boolean(state.selectedServiceId && state.selectedInstanceId)}
            isLoading={state.enrollmentList.isLoading}
            isLoadingMore={state.enrollmentList.isLoadingMore}
            hasMore={state.enrollmentList.hasMore}
            error={state.enrollmentList.error}
            isMutating={state.enrollmentMutations.isLoading}
            onLoadMore={state.enrollmentList.loadMore}
            onCreate={async (payload) => {
              if (!state.selectedServiceId || !state.selectedInstanceId) {
                return;
              }
              await state.enrollmentMutations.createEnrollmentEntry(
                state.selectedServiceId,
                state.selectedInstanceId,
                payload
              );
            }}
            onUpdate={async (enrollmentId, payload) => {
              if (!state.selectedServiceId || !state.selectedInstanceId) {
                return;
              }
              await state.enrollmentMutations.updateEnrollmentEntry(
                state.selectedServiceId,
                state.selectedInstanceId,
                enrollmentId,
                payload
              );
            }}
            onDelete={async (enrollmentId) => {
              if (!state.selectedServiceId || !state.selectedInstanceId) {
                return;
              }
              await state.enrollmentMutations.deleteEnrollmentEntry(
                state.selectedServiceId,
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
          onFilterChange={state.discountCodes.setFilter}
          onLoadMore={state.discountCodes.loadMore}
          onCreate={state.discountCodes.createCode}
          onUpdate={state.discountCodes.updateCode}
          onDelete={state.discountCodes.deleteCode}
        />
      ) : (
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
          onDelete={state.venues.deleteVenue}
        />
      )}
    </div>
  );
}
