'use client';

import { useState } from 'react';

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
import type { ServiceInstance, ServiceType } from '@/types/services';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ApiSchemas = components['schemas'];

export interface InstanceDetailPanelProps {
  mode: 'create' | 'edit';
  instance: ServiceInstance | null;
  serviceType: ServiceType | null;
  isLoading: boolean;
  error: string;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onCreate: (payload: ApiSchemas['CreateInstanceRequest']) => Promise<void> | void;
  onUpdate: (
    instanceId: string,
    payload: ApiSchemas['UpdateInstanceRequest']
  ) => Promise<void> | void;
  onDelete: (instanceId: string) => Promise<void> | void;
}

export function InstanceDetailPanel({
  mode,
  instance,
  serviceType,
  isLoading,
  error,
  onStartCreate,
  onCancelCreate,
  onCreate,
  onUpdate,
  onDelete,
}: InstanceDetailPanelProps) {
  const [instanceForm, setInstanceForm] = useState<InstanceFormState>(
    mode === 'edit' && instance
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
    mode === 'edit' && instance
      ? {
          pricingUnit: instance.trainingDetails?.pricingUnit ?? 'per_person',
          defaultPrice: instance.trainingDetails?.price ?? '',
          defaultCurrency: instance.trainingDetails?.currency ?? 'HKD',
        }
      : DEFAULT_TRAINING_FORM
  );
  const [eventForm, setEventForm] = useState<EventFormState>(
    mode === 'edit' && instance
      ? {
          eventCategory: 'workshop',
        }
      : DEFAULT_EVENT_FORM
  );
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(
    mode === 'edit' && instance
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

  const effectiveServiceType = serviceType ?? 'training_course';

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
    <Card
      title={mode === 'create' ? 'Create instance' : 'Instance detail'}
      description={
        mode === 'create'
          ? 'Create a new instance inline above the instances list.'
          : 'Edit the selected instance inline above the instances list.'
      }
      className='space-y-4'
    >
      <div className='flex justify-end gap-2'>
        {mode === 'create' ? (
          <Button type='button' variant='secondary' onClick={onCancelCreate} disabled={isLoading}>
            Cancel
          </Button>
        ) : (
          <Button type='button' onClick={onStartCreate}>
            New instance
          </Button>
        )}
      </div>

      {!serviceType ? (
        <p className='text-sm text-slate-500'>Select a service before creating or editing instances.</p>
      ) : mode === 'edit' && !instance ? (
        <p className='text-sm text-slate-500'>Select an instance to edit, or create a new one.</p>
      ) : (
        <>
          <InstanceFormFields value={instanceForm} onChange={setInstanceForm} />
          {effectiveServiceType === 'training_course' ? (
            <TrainingFormFields value={trainingForm} onChange={setTrainingForm} />
          ) : null}
          {effectiveServiceType === 'event' ? (
            <EventFormFields value={eventForm} onChange={setEventForm} />
          ) : null}
          {effectiveServiceType === 'consultation' ? (
            <ConsultationFormFields value={consultationForm} onChange={setConsultationForm} />
          ) : null}

          {error ? <p className='text-sm text-red-600'>{error}</p> : null}

          <div className='flex flex-wrap justify-end gap-2'>
            {mode === 'create' ? (
              <Button type='button' disabled={isLoading} onClick={() => void onCreate(buildCreatePayload())}>
                {isLoading ? 'Creating...' : 'Create instance'}
              </Button>
            ) : (
              <>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={isLoading || !instance}
                  onClick={() => {
                    if (!instance) {
                      return;
                    }
                    void onUpdate(instance.id, buildUpdatePayload());
                  }}
                >
                  Save
                </Button>
                <Button
                  type='button'
                  variant='danger'
                  disabled={isLoading || !instance}
                  onClick={() => {
                    if (!instance) {
                      return;
                    }
                    void onDelete(instance.id);
                  }}
                >
                  Delete instance
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
