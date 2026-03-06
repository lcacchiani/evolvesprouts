'use client';

import { useState } from 'react';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { FormDialog } from '@/components/ui/form-dialog';

import type { components } from '@/types/generated/admin-api.generated';
import { SERVICE_TYPES } from '@/types/services';
import type { ServiceType } from '@/types/services';

import { ConsultationFormFields, type ConsultationFormState } from './consultation-form-fields';
import { EventFormFields, type EventFormState } from './event-form-fields';
import {
  DEFAULT_CONSULTATION_FORM,
  DEFAULT_EVENT_FORM,
  DEFAULT_SERVICE_FORM,
  DEFAULT_TRAINING_FORM,
} from './form-defaults';
import { ServiceFormFields, type ServiceFormState } from './service-form-fields';
import { TrainingFormFields, type TrainingFormState } from './training-form-fields';

type ApiSchemas = components['schemas'];

export interface CreateServiceDialogProps {
  open: boolean;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onCreate: (payload: ApiSchemas['CreateServiceRequest']) => Promise<void> | void;
}

export function CreateServiceDialog({
  open,
  isLoading,
  error,
  onClose,
  onCreate,
}: CreateServiceDialogProps) {
  const [serviceType, setServiceType] = useState<ServiceType>('training_course');
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(DEFAULT_SERVICE_FORM);
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(DEFAULT_TRAINING_FORM);
  const [eventForm, setEventForm] = useState<EventFormState>(DEFAULT_EVENT_FORM);
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(
    DEFAULT_CONSULTATION_FORM
  );

  const handleSubmit = async () => {
    const payload: ApiSchemas['CreateServiceRequest'] = {
      service_type: serviceType,
      title: serviceForm.title.trim(),
      description: serviceForm.description.trim() || null,
      delivery_mode: serviceForm.deliveryMode,
      status: serviceForm.status,
    };

    if (serviceType === 'training_course') {
      payload.training_details = {
        pricing_unit: trainingForm.pricingUnit,
        default_price: trainingForm.defaultPrice.trim() || null,
        default_currency: trainingForm.defaultCurrency.trim() || 'HKD',
      };
    } else if (serviceType === 'event') {
      payload.event_details = {
        event_category: eventForm.eventCategory,
      };
    } else {
      payload.consultation_details = {
        consultation_format: consultationForm.consultationFormat,
        max_group_size: consultationForm.maxGroupSize ? Number(consultationForm.maxGroupSize) : null,
        duration_minutes: consultationForm.durationMinutes
          ? Number(consultationForm.durationMinutes)
          : null,
        pricing_model: consultationForm.pricingModel,
        default_hourly_rate: consultationForm.defaultHourlyRate.trim() || null,
        default_package_price: consultationForm.defaultPackagePrice.trim() || null,
        default_package_sessions: consultationForm.defaultPackageSessions
          ? Number(consultationForm.defaultPackageSessions)
          : null,
        default_currency: consultationForm.defaultCurrency.trim() || 'HKD',
        calendly_url: consultationForm.calendlyUrl.trim() || null,
      };
    }

    await onCreate(payload);
  };

  return (
    <FormDialog
      open={open}
      title='Create service'
      isLoading={isLoading}
      error={error}
      submitLabel='Create service'
      submitDisabled={!serviceForm.title.trim()}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div>
        <Label htmlFor='service-type'>Service type</Label>
        <Select
          id='service-type'
          value={serviceType}
          onChange={(event) => setServiceType(event.target.value as ServiceType)}
        >
          {SERVICE_TYPES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
      </div>

      <ServiceFormFields value={serviceForm} onChange={setServiceForm} />

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
