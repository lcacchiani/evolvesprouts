'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ConsultationInstanceRowDFields,
  ConsultationInstanceRowEFields,
  type ConsultationFormState,
} from './consultation-form-fields';
import {
  EventCategoryControl,
  EventDefaultCurrencyControl,
  EventDefaultPriceControl,
  type EventFormState,
} from './event-form-fields';
import {
  DEFAULT_CONSULTATION_FORM,
  DEFAULT_EVENT_FORM,
  DEFAULT_INSTANCE_FORM,
  DEFAULT_TRAINING_FORM,
} from './form-defaults';
import { EventInstancePartnersField } from './event-instance-partners-field';
import {
  InstanceFormFields,
  InstanceInstructorField,
  type InstanceFormState,
} from './instance-form-fields';
import { SessionSlotEditor } from './session-slot-editor';
import {
  TrainingCurrencyControl,
  TrainingPriceControl,
  TrainingPricingUnitControl,
  type TrainingFormState,
} from './training-form-fields';

import type { components } from '@/types/generated/admin-api.generated';
import {
  normalizeEventCategoryFromApi,
  type EventCategory,
  type LocationSummary,
  type PartnerOrgRef,
  type ServiceInstance,
  type ServiceSummary,
  type ServiceType,
} from '@/types/services';

import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Button } from '@/components/ui/button';
import { AdminInlineError } from '@/components/ui/admin-inline-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useInstructorUsers } from '@/hooks/use-instructor-users';
import { getAdminDefaultCurrencyCode } from '@/lib/config';

type ApiSchemas = components['schemas'];
const defaultCurrencyCode = getAdminDefaultCurrencyCode();

export interface InstanceDetailPanelProps {
  instance: ServiceInstance | null;
  selectedServiceId: string | null;
  serviceOptions: ServiceSummary[];
  locationOptions: LocationSummary[];
  isLoadingLocations: boolean;
  serviceType: ServiceType | null;
  isLoading: boolean;
  error: string;
  locationError?: string;
  onSelectService: (serviceId: string | null) => void;
  onCancelSelection: () => void;
  onCreate: (serviceId: string, payload: ApiSchemas['CreateInstanceRequest']) => Promise<void> | void;
  onUpdate: (
    serviceId: string,
    instanceId: string,
    payload: ApiSchemas['UpdateInstanceRequest']
  ) => Promise<void> | void;
}

function mergeServiceIntoInstanceForm(
  prev: InstanceFormState,
  service: ServiceSummary
): InstanceFormState {
  return {
    ...prev,
    title: service.title,
    description: service.description ?? '',
    deliveryMode: service.deliveryMode,
  };
}

function mergeServiceIntoEventForm(_prev: EventFormState, service: ServiceSummary): EventFormState {
  if (service.serviceType !== 'event') {
    return DEFAULT_EVENT_FORM;
  }
  const ed = service.eventDetails;
  return {
    eventCategory: ed?.eventCategory ?? 'workshop',
    defaultPrice: ed?.defaultPrice ?? '',
    defaultCurrency: ed?.defaultCurrency ?? defaultCurrencyCode,
  };
}

function resolveInheritedEventCategory(
  selectedService: ServiceSummary | null,
  instance: ServiceInstance | null
): EventCategory {
  const fromService = selectedService?.eventDetails?.eventCategory;
  if (fromService) {
    return fromService;
  }
  const tierName = instance?.eventTicketTiers?.[0]?.name;
  if (tierName) {
    return normalizeEventCategoryFromApi(tierName);
  }
  return 'workshop';
}

function mergeServiceIntoTrainingForm(
  prev: TrainingFormState,
  service: ServiceSummary
): TrainingFormState {
  if (service.serviceType !== 'training_course' || !service.trainingDetails) {
    return prev;
  }
  const td = service.trainingDetails;
  return {
    ...prev,
    pricingUnit: td.pricingUnit,
    defaultPrice: td.defaultPrice ?? '',
    defaultCurrency: td.defaultCurrency ?? defaultCurrencyCode,
  };
}

function mapPartnerRefsFromInstance(instance: ServiceInstance): PartnerOrgRef[] {
  return instance.partnerOrganizations.map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
}

export function InstanceDetailPanel({
  instance,
  selectedServiceId,
  serviceOptions,
  locationOptions,
  isLoadingLocations,
  serviceType,
  isLoading,
  error,
  locationError = '',
  onSelectService,
  onCancelSelection,
  onCreate,
  onUpdate,
}: InstanceDetailPanelProps) {
  const isEditMode = Boolean(instance);
  const lastMergedServiceIdForCreateRef = useRef<string | null>(null);
  const { users: instructorUsers, isLoading: isLoadingInstructors } = useInstructorUsers(
    Boolean(selectedServiceId)
  );

  const [instanceForm, setInstanceForm] = useState<InstanceFormState>(
    instance
      ? {
          title: instance.title ?? '',
          slug: instance.slug ?? '',
          description: instance.description ?? '',
          status: instance.status,
          deliveryMode: instance.deliveryMode ?? '',
          locationId: instance.locationId ?? '',
          maxCapacity: instance.maxCapacity?.toString() ?? '',
          waitlistEnabled: instance.waitlistEnabled,
          instructorId: instance.instructorId ?? '',
          notes: instance.notes ?? '',
          externalUrl: instance.externalUrl ?? '',
          partnerOrganizations: mapPartnerRefsFromInstance(instance),
          sessionSlots: instance.sessionSlots,
        }
      : DEFAULT_INSTANCE_FORM
  );
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(
    instance
      ? {
          pricingUnit: instance.trainingDetails?.pricingUnit ?? 'per_person',
          defaultPrice: instance.trainingDetails?.price ?? '',
          defaultCurrency: instance.trainingDetails?.currency ?? defaultCurrencyCode,
        }
      : DEFAULT_TRAINING_FORM
  );
  const [eventForm, setEventForm] = useState<EventFormState>(
    instance
      ? {
          eventCategory: 'workshop',
          defaultPrice: instance.eventTicketTiers?.[0]?.price ?? '',
          defaultCurrency: instance.eventTicketTiers?.[0]?.currency ?? defaultCurrencyCode,
        }
      : DEFAULT_EVENT_FORM
  );
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(
    instance
      ? {
          consultationFormat: 'one_on_one',
          maxGroupSize: '',
          durationMinutes: '60',
          pricingModel: instance.consultationDetails?.pricingModel ?? 'free',
          defaultHourlyRate: instance.consultationDetails?.price ?? '',
          defaultPackagePrice: '',
          defaultPackageSessions: instance.consultationDetails?.packageSessions?.toString() ?? '',
          defaultCurrency: instance.consultationDetails?.currency ?? defaultCurrencyCode,
        }
      : DEFAULT_CONSULTATION_FORM
  );

  const handleSelectService = useCallback(
    (serviceId: string | null) => {
      onSelectService(serviceId);
      if (!serviceId) {
        lastMergedServiceIdForCreateRef.current = null;
        setEventForm(DEFAULT_EVENT_FORM);
        return;
      }
      const svc = serviceOptions.find((entry) => entry.id === serviceId);
      if (!svc) {
        return;
      }
      lastMergedServiceIdForCreateRef.current = serviceId;
      setInstanceForm((prev) => mergeServiceIntoInstanceForm(prev, svc));
      setTrainingForm((prev) => mergeServiceIntoTrainingForm(prev, svc));
      setEventForm((prev) => mergeServiceIntoEventForm(prev, svc));
    },
    [onSelectService, serviceOptions]
  );

  useEffect(() => {
    if (instance || !selectedServiceId) {
      return;
    }
    const svc = serviceOptions.find((entry) => entry.id === selectedServiceId);
    if (!svc) {
      return;
    }
    if (lastMergedServiceIdForCreateRef.current === selectedServiceId) {
      return;
    }
    lastMergedServiceIdForCreateRef.current = selectedServiceId;
    queueMicrotask(() => {
      setInstanceForm((prev) => mergeServiceIntoInstanceForm(prev, svc));
      setTrainingForm((prev) => mergeServiceIntoTrainingForm(prev, svc));
      setEventForm((prev) => mergeServiceIntoEventForm(prev, svc));
    });
  }, [instance, selectedServiceId, serviceOptions]);

  useEffect(() => {
    if (!instance) {
      return;
    }
    queueMicrotask(() => {
      setInstanceForm({
        title: instance.title ?? '',
        slug: instance.slug ?? '',
        description: instance.description ?? '',
        status: instance.status,
        deliveryMode: instance.deliveryMode ?? '',
        locationId: instance.locationId ?? '',
        maxCapacity: instance.maxCapacity?.toString() ?? '',
        waitlistEnabled: instance.waitlistEnabled,
        instructorId: instance.instructorId ?? '',
        notes: instance.notes ?? '',
        externalUrl: instance.externalUrl ?? '',
        partnerOrganizations: mapPartnerRefsFromInstance(instance),
        sessionSlots: instance.sessionSlots,
      });
      setTrainingForm({
        pricingUnit: instance.trainingDetails?.pricingUnit ?? 'per_person',
        defaultPrice: instance.trainingDetails?.price ?? '',
        defaultCurrency: instance.trainingDetails?.currency ?? defaultCurrencyCode,
      });
      setEventForm({
        eventCategory: resolveInheritedEventCategory(
          serviceOptions.find((entry) => entry.id === instance.serviceId) ?? null,
          instance
        ),
        defaultPrice: instance.eventTicketTiers?.[0]?.price ?? '',
        defaultCurrency: instance.eventTicketTiers?.[0]?.currency ?? defaultCurrencyCode,
      });
      setConsultationForm({
        consultationFormat: 'one_on_one',
        maxGroupSize: '',
        durationMinutes: '60',
        pricingModel: instance.consultationDetails?.pricingModel ?? 'free',
        defaultHourlyRate: instance.consultationDetails?.price ?? '',
        defaultPackagePrice: '',
        defaultPackageSessions: instance.consultationDetails?.packageSessions?.toString() ?? '',
        defaultCurrency: instance.consultationDetails?.currency ?? defaultCurrencyCode,
      });
    });
  }, [instance, serviceOptions]);

  const selectedService =
    serviceOptions.find((entry) => entry.id === selectedServiceId) ?? null;
  const effectiveServiceType = serviceType ?? selectedService?.serviceType ?? 'training_course';
  const canSubmit = Boolean(selectedServiceId);
  const typeFieldsLocked = !selectedServiceId;

  const buildCreatePayload = (): ApiSchemas['CreateInstanceRequest'] => {
    const slugTrimmed = instanceForm.slug.trim().toLowerCase();
    const payload: ApiSchemas['CreateInstanceRequest'] = {
      title: instanceForm.title.trim() || null,
      slug: slugTrimmed || null,
      description: instanceForm.description.trim() || null,
      status: instanceForm.status,
      delivery_mode: instanceForm.deliveryMode || undefined,
      location_id: instanceForm.locationId.trim() || null,
      max_capacity: instanceForm.maxCapacity ? Number(instanceForm.maxCapacity) : null,
      waitlist_enabled: instanceForm.waitlistEnabled,
      instructor_id: instanceForm.instructorId.trim() || null,
      notes: instanceForm.notes.trim() || null,
      external_url: instanceForm.externalUrl.trim() || null,
      partner_organization_ids: instanceForm.partnerOrganizations.map((row) => row.id),
      session_slots: instanceForm.sessionSlots.map((slot, index) => ({
        location_id: slot.locationId,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        sort_order: slot.sortOrder ?? index,
      })),
    };

    if (effectiveServiceType === 'training_course') {
      payload.training_details = {
        training_format: 'group',
        price: trainingForm.defaultPrice || '0',
        currency: trainingForm.defaultCurrency || defaultCurrencyCode,
        pricing_unit: trainingForm.pricingUnit,
      };
    } else if (effectiveServiceType === 'event') {
      const eventCategory = resolveInheritedEventCategory(selectedService, instance);
      const priceStr = eventForm.defaultPrice.trim();
      const currencyStr = (eventForm.defaultCurrency || defaultCurrencyCode).trim();
      payload.event_ticket_tiers = [
        {
          name: eventCategory,
          description: null,
          price: priceStr.length ? priceStr : null,
          currency: currencyStr.length ? currencyStr : null,
          max_quantity: null,
          sort_order: 0,
        },
      ];
    } else {
      payload.consultation_details = {
        pricing_model: consultationForm.pricingModel,
        price: consultationForm.defaultHourlyRate || null,
        currency: consultationForm.defaultCurrency || defaultCurrencyCode,
        package_sessions: consultationForm.defaultPackageSessions
          ? Number(consultationForm.defaultPackageSessions)
          : null,
      };
    }

    return payload;
  };

  const buildUpdatePayload = (): ApiSchemas['UpdateInstanceRequest'] => ({
    ...buildCreatePayload(),
    status: instanceForm.status,
  });

  const externalUrlInvalid =
    effectiveServiceType === 'event' &&
    Boolean(instanceForm.externalUrl.trim()) &&
    !/^https?:\/\//i.test(instanceForm.externalUrl.trim());

  return (
    <AdminEditorCard
      title='Instance'
      description='Add or update an instance using the same fields below.'
      actions={
        canSubmit ? (
          <>
            {isEditMode ? (
              <>
                <Button type='button' variant='secondary' disabled={isLoading} onClick={onCancelSelection}>
                  Cancel
                </Button>
                <Button
                  type='button'
                  disabled={isLoading || !instance || externalUrlInvalid}
                  onClick={() => {
                    if (!instance || !selectedServiceId) {
                      return;
                    }
                    void onUpdate(selectedServiceId, instance.id, buildUpdatePayload());
                  }}
                >
                  {isLoading ? 'Updating...' : 'Update instance'}
                </Button>
              </>
            ) : (
              <Button
                type='button'
                disabled={isLoading || !selectedServiceId || externalUrlInvalid}
                onClick={() => {
                  if (!selectedServiceId) {
                    return;
                  }
                  void onCreate(selectedServiceId, buildCreatePayload());
                }}
              >
                {isLoading ? 'Adding...' : 'Add instance'}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {!selectedService ? (
        <p className='text-sm text-slate-500'>Select a service to enable instance save actions.</p>
      ) : null}
      <InstanceFormFields
        value={instanceForm}
        serviceId={selectedServiceId}
        serviceOptions={serviceOptions}
        locationOptions={locationOptions}
        isLoadingLocations={isLoadingLocations}
        instructorOptions={instructorUsers}
        isLoadingInstructors={isLoadingInstructors}
        onSelectService={handleSelectService}
        onChange={setInstanceForm}
      />

      {effectiveServiceType === 'training_course' ? (
        <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
          <InstanceInstructorField
            value={instanceForm.instructorId}
            disabled={typeFieldsLocked}
            instructorOptions={instructorUsers}
            isLoadingInstructors={isLoadingInstructors}
            onChange={(instructorId) => setInstanceForm((prev) => ({ ...prev, instructorId }))}
          />
          <TrainingPricingUnitControl value={trainingForm} disabled={typeFieldsLocked} onChange={setTrainingForm} />
          <TrainingPriceControl value={trainingForm} disabled={typeFieldsLocked} onChange={setTrainingForm} />
          <TrainingCurrencyControl value={trainingForm} disabled={typeFieldsLocked} onChange={setTrainingForm} />
        </div>
      ) : null}

      {effectiveServiceType === 'event' ? (
        <>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <InstanceInstructorField
              value={instanceForm.instructorId}
              disabled={typeFieldsLocked}
              instructorOptions={instructorUsers}
              isLoadingInstructors={isLoadingInstructors}
              onChange={(instructorId) => setInstanceForm((prev) => ({ ...prev, instructorId }))}
            />
            <EventCategoryControl
              value={{
                ...eventForm,
                eventCategory: resolveInheritedEventCategory(selectedService, instance),
              }}
              disabled={typeFieldsLocked}
              onChange={setEventForm}
              categoryReadOnly
              categoryFieldId='instance-event-category'
            />
            <EventDefaultPriceControl
              value={eventForm}
              disabled={typeFieldsLocked}
              onChange={setEventForm}
              priceLabel='Price'
            />
            <EventDefaultCurrencyControl value={eventForm} disabled={typeFieldsLocked} onChange={setEventForm} />
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <div className='md:col-span-2'>
              <EventInstancePartnersField
                value={instanceForm.partnerOrganizations}
                disabled={typeFieldsLocked}
                onChange={(next) => setInstanceForm((prev) => ({ ...prev, partnerOrganizations: next }))}
              />
            </div>
            <div className='md:col-span-2'>
              <Label htmlFor='instance-external-url'>External URL</Label>
              <Input
                id='instance-external-url'
                value={instanceForm.externalUrl}
                disabled={typeFieldsLocked}
                onChange={(event) => setInstanceForm((prev) => ({ ...prev, externalUrl: event.target.value }))}
                placeholder='https://…'
                autoComplete='off'
              />
              {externalUrlInvalid ? (
                <p className='mt-1 text-xs text-red-600'>URL must start with http:// or https://</p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {effectiveServiceType === 'consultation' ? (
        <>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <InstanceInstructorField
              value={instanceForm.instructorId}
              disabled={typeFieldsLocked}
              instructorOptions={instructorUsers}
              isLoadingInstructors={isLoadingInstructors}
              onChange={(instructorId) => setInstanceForm((prev) => ({ ...prev, instructorId }))}
            />
            <ConsultationInstanceRowDFields
              value={consultationForm}
              disabled={typeFieldsLocked}
              onChange={setConsultationForm}
            />
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <ConsultationInstanceRowEFields
              value={consultationForm}
              disabled={typeFieldsLocked}
              onChange={setConsultationForm}
            />
          </div>
        </>
      ) : null}

      <div>
        <Label htmlFor='instance-notes'>Notes</Label>
        <Textarea
          id='instance-notes'
          value={instanceForm.notes}
          disabled={typeFieldsLocked}
          onChange={(event) => setInstanceForm((prev) => ({ ...prev, notes: event.target.value }))}
          rows={2}
        />
      </div>

      <SessionSlotEditor
        slots={instanceForm.sessionSlots}
        disabled={typeFieldsLocked}
        locationOptions={locationOptions}
        isLoadingLocations={isLoadingLocations}
        onChange={(sessionSlots) => setInstanceForm((prev) => ({ ...prev, sessionSlots }))}
      />

      {locationError ? <AdminInlineError>{locationError}</AdminInlineError> : null}
      {error ? <AdminInlineError>{error}</AdminInlineError> : null}
    </AdminEditorCard>
  );
}
