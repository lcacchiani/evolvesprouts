'use client';

import { StatusBanner } from '@/components/status-banner';

import { useServicesPage } from '@/hooks/use-services-page';

import { DiscountCodesPanel } from './discount-codes-panel';
import { EnrollmentListPanel } from './enrollment-list-panel';
import { InstanceDetailPanel } from './instance-detail-panel';
import { InstanceListPanel } from './instance-list-panel';
import { ServiceDetailPanel } from './service-detail-panel';
import { ServiceListPanel } from './service-list-panel';
import { ServicesHeader } from './services-header';

export function ServicesPage() {
  const state = useServicesPage();
  const hasAnyError =
    state.serviceList.error ||
    state.serviceDetail.error ||
    state.serviceMutations.error ||
    state.instanceList.error ||
    state.instanceMutations.error ||
    state.enrollmentList.error ||
    state.enrollmentMutations.error ||
    state.discountCodes.error;

  return (
    <div className='space-y-4'>
      {hasAnyError ? (
        <StatusBanner variant='error' title='Services'>
          {hasAnyError}
        </StatusBanner>
      ) : null}

      <ServicesHeader
        activeView={state.activeView}
        onSetView={state.setActiveView}
        onRefresh={async () => {
          await state.serviceList.refetch();
          await state.serviceDetail.refetch();
          await state.instanceList.refetch();
          await state.enrollmentList.refetch();
          await state.discountCodes.refetch();
        }}
        onNewService={state.startCreateService}
      />

      {state.activeView === 'catalog' ? (
        <>
          <ServiceDetailPanel
            key={`${state.isCreateServiceDialogOpen ? 'create' : 'edit'}-${state.selectedServiceId ?? 'none'}`}
            mode={state.isCreateServiceDialogOpen ? 'create' : 'edit'}
            service={state.serviceDetail.service}
            isLoading={state.serviceMutations.isLoading}
            error={state.serviceMutations.error}
            onStartCreate={state.startCreateService}
            onCancelCreate={state.cancelCreateService}
            onCreate={async (payload) => {
              await state.serviceMutations.createServiceEntry(payload);
              state.cancelCreateService();
            }}
            onUpdate={async (payload) => {
              if (!state.selectedServiceId) {
                return;
              }
              await state.serviceMutations.updateServiceEntry(state.selectedServiceId, payload, true);
            }}
            onDelete={async () => {
              if (!state.selectedServiceId) {
                return;
              }
              await state.serviceMutations.deleteServiceEntry(state.selectedServiceId);
              state.setSelectedServiceId(null);
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
            totalCount={state.serviceList.totalCount}
            isLoading={state.serviceList.isLoading}
            isLoadingMore={state.serviceList.isLoadingMore}
            hasMore={state.serviceList.hasMore}
            error={state.serviceList.error}
            onSelectService={state.setSelectedServiceId}
            onFilterChange={state.serviceList.setFilter}
            onClearFilters={state.serviceList.clearFilters}
            onLoadMore={state.serviceList.loadMore}
          />
          <InstanceDetailPanel
            key={`${state.isCreateInstanceDialogOpen ? 'create' : 'edit'}-${state.selectedInstanceId ?? 'none'}-${state.selectedService?.serviceType ?? 'none'}`}
            mode={state.isCreateInstanceDialogOpen ? 'create' : 'edit'}
            instance={state.selectedInstance}
            serviceType={state.selectedService?.serviceType ?? null}
            isLoading={state.instanceMutations.isLoading}
            error={state.instanceMutations.error}
            onStartCreate={state.startCreateInstance}
            onCancelCreate={state.cancelCreateInstance}
            onCreate={async (payload) => {
              if (!state.selectedServiceId) {
                return;
              }
              await state.instanceMutations.createInstanceEntry(state.selectedServiceId, payload);
              state.cancelCreateInstance();
            }}
            onUpdate={async (instanceId, payload) => {
              if (!state.selectedServiceId) {
                return;
              }
              await state.instanceMutations.updateInstanceEntry(state.selectedServiceId, instanceId, payload);
            }}
            onDelete={async (instanceId) => {
              if (!state.selectedServiceId) {
                return;
              }
              await state.instanceMutations.deleteInstanceEntry(state.selectedServiceId, instanceId);
              state.setSelectedInstanceId(null);
            }}
          />
          <InstanceListPanel
            instances={state.instanceList.instances}
            selectedInstanceId={state.selectedInstanceId}
            isLoading={state.instanceList.isLoading}
            isLoadingMore={state.instanceList.isLoadingMore}
            hasMore={state.instanceList.hasMore}
            error={state.instanceList.error}
            onSelectInstance={state.setSelectedInstanceId}
            onLoadMore={state.instanceList.loadMore}
            onOpenCreate={state.startCreateInstance}
          />
          <EnrollmentListPanel
            enrollments={state.enrollmentList.enrollments}
            canCreate={Boolean(state.selectedServiceId && state.selectedInstanceId)}
            isLoading={state.enrollmentList.isLoading}
            isLoadingMore={state.enrollmentList.isLoadingMore}
            hasMore={state.enrollmentList.hasMore}
            error={state.enrollmentList.error}
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
      ) : (
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
      )}
    </div>
  );
}
