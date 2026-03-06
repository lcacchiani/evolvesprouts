'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import type { components } from '@/types/generated/admin-api.generated';
import { SERVICE_TYPES } from '@/types/services';
import type { ServiceType } from '@/types/services';

import { ConsultationFormFields, type ConsultationFormState } from './consultation-form-fields';
import { EventFormFields, type EventFormState } from './event-form-fields';
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

const DEFAULT_SERVICE_FORM: ServiceFormState = {
  title: '',
  description: '',
  deliveryMode: 'online',
  status: 'draft',
};

const DEFAULT_TRAINING_FORM: TrainingFormState = {
  pricingUnit: 'per_person',
  defaultPrice: '',
  defaultCurrency: 'HKD',
};

const DEFAULT_EVENT_FORM: EventFormState = {
  eventCategory: 'workshop',
};

const DEFAULT_CONSULTATION_FORM: ConsultationFormState = {
  consultationFormat: 'one_on_one',
  maxGroupSize: '',
  durationMinutes: '60',
  pricingModel: 'free',
  defaultHourlyRate: '',
  defaultPackagePrice: '',
  defaultPackageSessions: '',
  defaultCurrency: 'HKD',
  calendlyUrl: '',
};

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

  if (!open) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className='w-full max-w-2xl'>
        <Card title='Create service' className='space-y-4'>
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

          {error ? <p className='text-sm text-red-600'>{error}</p> : null}
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='button'
              disabled={isLoading || !serviceForm.title.trim()}
              onClick={async () => {
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
              }}
            >
              {isLoading ? 'Creating...' : 'Create service'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
