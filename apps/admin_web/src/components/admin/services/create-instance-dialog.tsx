'use client';

import { useState } from 'react';

import { FormDialog } from '@/components/ui/form-dialog';

import type { components } from '@/types/generated/admin-api.generated';
import type { ServiceType } from '@/types/services';

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

type ApiSchemas = components['schemas'];

export interface CreateInstanceDialogProps {
  open: boolean;
  serviceType: ServiceType;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onCreate: (payload: ApiSchemas['CreateInstanceRequest']) => Promise<void> | void;
}

export function CreateInstanceDialog({
  open,
  serviceType,
  isLoading,
  error,
  onClose,
  onCreate,
}: CreateInstanceDialogProps) {
  const [instanceForm, setInstanceForm] = useState<InstanceFormState>(DEFAULT_INSTANCE_FORM);
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(DEFAULT_TRAINING_FORM);
  const [eventForm, setEventForm] = useState<EventFormState>(DEFAULT_EVENT_FORM);
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(
    DEFAULT_CONSULTATION_FORM
  );

  const handleSubmit = async () => {
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
      session_slots: instanceForm.sessionSlots.map((slot, index) => ({
        location_id: slot.locationId,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        sort_order: slot.sortOrder ?? index,
      })),
    };

    if (serviceType === 'training_course') {
      payload.training_details = {
        training_format: 'group',
        price: trainingForm.defaultPrice || '0',
        currency: trainingForm.defaultCurrency || 'HKD',
        pricing_unit: trainingForm.pricingUnit,
      };
    } else if (serviceType === 'event') {
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
    await onCreate(payload);
  };

  return (
    <FormDialog
      open={open}
      title='Create Instance'
      isLoading={isLoading}
      error={error}
      submitLabel='Create instance'
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <InstanceFormFields value={instanceForm} onChange={setInstanceForm} />
      {serviceType === 'training_course' ? (
        <TrainingFormFields value={trainingForm} onChange={setTrainingForm} />
      ) : null}
      {serviceType === 'event' ? <EventFormFields value={eventForm} onChange={setEventForm} /> : null}
      {serviceType === 'consultation' ? (
        <ConsultationFormFields value={consultationForm} onChange={setConsultationForm} />
      ) : null}
    </FormDialog>
  );
}
