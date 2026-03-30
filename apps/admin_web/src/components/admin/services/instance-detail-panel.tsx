'use client';

import { useMemo, useState } from 'react';

import { ConsultationFormFields, type ConsultationFormState } from './consultation-form-fields';
import { EventFormFields, type EventFormState } from './event-form-fields';
import {
  DEFAULT_CONSULTATION_FORM,
  DEFAULT_EVENT_FORM,
  DEFAULT_INSTANCE_FORM,
  DEFAULT_TRAINING_FORM,
} from './form-defaults';
import { InstanceFormFields, type InstanceFormState } from './instance-form-fields';
import { TrainingFormFields, type TrainingFormState } from './training-form-fields';

import type { components } from '@/types/generated/admin-api.generated';
import type { LocationSummary, ServiceInstance, ServiceSummary, ServiceType } from '@/types/services';

import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Button } from '@/components/ui/button';

type ApiSchemas = components['schemas'];

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
  const [instanceForm, setInstanceForm] = useState<InstanceFormState>(
    instance
      ? {
          title: instance.title ?? '',
          description: instance.description ?? '',
          status: instance.status,
          deliveryMode: instance.deliveryMode ?? '',
          locationId: instance.locationId ?? '',
          maxCapacity: instance.maxCapacity?.toString() ?? '',
          waitlistEnabled: instance.waitlistEnabled,
          instructorId: instance.instructorId ?? '',
          notes: instance.notes ?? '',
          sessionSlots: instance.sessionSlots,
        }
      : DEFAULT_INSTANCE_FORM
  );
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(
    instance
      ? {
          pricingUnit: instance.trainingDetails?.pricingUnit ?? 'per_person',
          defaultPrice: instance.trainingDetails?.price ?? '',
          defaultCurrency: instance.trainingDetails?.currency ?? 'HKD',
        }
      : DEFAULT_TRAINING_FORM
  );
  const [eventForm, setEventForm] = useState<EventFormState>(
    instance
      ? {
          eventCategory: 'workshop',
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
          defaultCurrency: instance.consultationDetails?.currency ?? 'HKD',
          calendlyUrl: instance.consultationDetails?.calendlyEventUrl ?? '',
        }
      : DEFAULT_CONSULTATION_FORM
  );

  const selectedService = useMemo(
    () => serviceOptions.find((entry) => entry.id === selectedServiceId) ?? null,
    [serviceOptions, selectedServiceId]
  );
  const effectiveServiceType = serviceType ?? selectedService?.serviceType ?? 'training_course';
  const canSubmit = Boolean(selectedServiceId);

  const buildCreatePayload = (): ApiSchemas['CreateInstanceRequest'] => {
    const payload: ApiSchemas['CreateInstanceRequest'] = {
      title: instanceForm.title.trim() || null,
      description: instanceForm.description.trim() || null,
      status: instanceForm.status,
      delivery_mode: instanceForm.deliveryMode || undefined,
      location_id: instanceForm.locationId.trim() || null,
      max_capacity: instanceForm.maxCapacity ? Number(instanceForm.maxCapacity) : null,
      waitlist_enabled: instanceForm.waitlistEnabled,
      instructor_id: instanceForm.instructorId.trim() || null,
      notes: instanceForm.notes.trim() || null,
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
        currency: trainingForm.defaultCurrency || 'HKD',
        pricing_unit: trainingForm.pricingUnit,
      };
    } else if (effectiveServiceType === 'event') {
      payload.event_ticket_tiers = [
        {
          name: eventForm.eventCategory,
          description: null,
          price: '0',
          currency: 'HKD',
          max_quantity: null,
          sort_order: 0,
        },
      ];
    } else {
      payload.consultation_details = {
        pricing_model: consultationForm.pricingModel,
        price: consultationForm.defaultHourlyRate || null,
        currency: consultationForm.defaultCurrency || 'HKD',
        package_sessions: consultationForm.defaultPackageSessions
          ? Number(consultationForm.defaultPackageSessions)
          : null,
        calendly_event_url: consultationForm.calendlyUrl || null,
      };
    }

    return payload;
  };

  const buildUpdatePayload = (): ApiSchemas['UpdateInstanceRequest'] => ({
    ...buildCreatePayload(),
    status: instanceForm.status,
  });

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
                  disabled={isLoading || !instance}
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
                disabled={isLoading || !selectedServiceId}
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
        onSelectService={onSelectService}
        onChange={setInstanceForm}
      />
      {effectiveServiceType === 'training_course' ? (
        <TrainingFormFields value={trainingForm} onChange={setTrainingForm} />
      ) : null}
      {effectiveServiceType === 'event' ? (
        <EventFormFields value={eventForm} onChange={setEventForm} />
      ) : null}
      {effectiveServiceType === 'consultation' ? (
        <ConsultationFormFields value={consultationForm} onChange={setConsultationForm} />
      ) : null}

      {locationError ? <p className='text-sm text-red-600'>{locationError}</p> : null}
      {error ? <p className='text-sm text-red-600'>{error}</p> : null}
    </AdminEditorCard>
  );
}
