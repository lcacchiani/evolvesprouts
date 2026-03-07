'use client';

import { StatusBanner } from '@/components/status-banner';

import { useServicesPage } from '@/hooks/use-services-page';

import { CreateEnrollmentDialog } from './create-enrollment-dialog';
import { CreateInstanceDialog } from './create-instance-dialog';
import { CreateServiceDialog } from './create-service-dialog';
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
        onNewService={() => state.setIsCreateServiceDialogOpen(true)}
      />

      {state.activeView === 'catalog' ? (
        <>
          <ServiceDetailPanel
            service={state.serviceDetail.service}
            isLoading={state.serviceMutations.isLoading}
            error={state.serviceMutations.error}
            onUpdate={async (payload) => {
              if (!state.selectedServiceId) {
                return;
              }
              await state.serviceMutations.updateServiceEntry(state.selectedServiceId, {
                title: payload.title,
                description: payload.description,
                status: payload.status,
              }, true);
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
          <InstanceListPanel
            instances={state.instanceList.instances}
            selectedInstanceId={state.selectedInstanceId}
            isLoading={state.instanceList.isLoading}
            isLoadingMore={state.instanceList.isLoadingMore}
            hasMore={state.instanceList.hasMore}
            error={state.instanceList.error}
            onSelectInstance={state.setSelectedInstanceId}
            onLoadMore={state.instanceList.loadMore}
            onOpenCreate={() => state.setIsCreateInstanceDialogOpen(true)}
          />
          <InstanceDetailPanel instance={state.selectedInstance} />
          <EnrollmentListPanel
            enrollments={state.enrollmentList.enrollments}
            isLoading={state.enrollmentList.isLoading}
            isLoadingMore={state.enrollmentList.isLoadingMore}
            hasMore={state.enrollmentList.hasMore}
            error={state.enrollmentList.error}
            onLoadMore={state.enrollmentList.loadMore}
            onOpenCreate={() => state.setIsCreateEnrollmentDialogOpen(true)}
            onUpdateStatus={async (enrollmentId, status) => {
              if (!state.selectedServiceId || !state.selectedInstanceId) {
                return;
              }
              await state.enrollmentMutations.updateEnrollmentEntry(
                state.selectedServiceId,
                state.selectedInstanceId,
                enrollmentId,
                { status }
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
          onDelete={state.discountCodes.deleteCode}
        />
      )}

      <CreateServiceDialog
        key={state.isCreateServiceDialogOpen ? 'service-dialog-open' : 'service-dialog-closed'}
        open={state.isCreateServiceDialogOpen}
        isLoading={state.serviceMutations.isLoading}
        error={state.serviceMutations.error}
        onClose={() => state.setIsCreateServiceDialogOpen(false)}
        onCreate={async (payload) => {
          await state.serviceMutations.createServiceEntry(payload);
          state.setIsCreateServiceDialogOpen(false);
        }}
      />

      <CreateInstanceDialog
        key={state.isCreateInstanceDialogOpen ? 'instance-dialog-open' : 'instance-dialog-closed'}
        open={state.isCreateInstanceDialogOpen}
        serviceType={state.selectedService?.serviceType ?? 'training_course'}
        isLoading={state.instanceMutations.isLoading}
        error={state.instanceMutations.error}
        onClose={() => state.setIsCreateInstanceDialogOpen(false)}
        onCreate={async (payload) => {
          if (!state.selectedServiceId) {
            return;
          }
          await state.instanceMutations.createInstanceEntry(state.selectedServiceId, payload);
          state.setIsCreateInstanceDialogOpen(false);
        }}
      />

      <CreateEnrollmentDialog
        key={state.isCreateEnrollmentDialogOpen ? 'enrollment-dialog-open' : 'enrollment-dialog-closed'}
        open={state.isCreateEnrollmentDialogOpen}
        isLoading={state.enrollmentMutations.isLoading}
        error={state.enrollmentMutations.error}
        onClose={() => state.setIsCreateEnrollmentDialogOpen(false)}
        onCreate={async (payload) => {
          if (!state.selectedServiceId || !state.selectedInstanceId) {
            return;
          }
          await state.enrollmentMutations.createEnrollmentEntry(
            state.selectedServiceId,
            state.selectedInstanceId,
            payload
          );
          state.setIsCreateEnrollmentDialogOpen(false);
        }}
      />
    </div>
  );
}
