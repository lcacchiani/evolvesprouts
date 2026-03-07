'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatEnumLabel } from '@/lib/format';

import type { components } from '@/types/generated/admin-api.generated';
import { SERVICE_TYPES } from '@/types/services';
import type { ServiceDetail, ServiceType } from '@/types/services';

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

export interface ServiceDetailPanelProps {
  service: ServiceDetail | null;
  isLoading: boolean;
  error: string;
  onCancelSelection: () => void;
  onCreate: (payload: ApiSchemas['CreateServiceRequest']) => Promise<void> | void;
  onUpdate: (payload: ApiSchemas['PartialUpdateServiceRequest']) => Promise<void> | void;
  onUploadCover: (fileName: string, contentType: string) => Promise<void> | void;
}

export function ServiceDetailPanel({
  service,
  isLoading,
  error,
  onCancelSelection,
  onCreate,
  onUpdate,
  onUploadCover,
}: ServiceDetailPanelProps) {
  const isEditMode = Boolean(service);
  const [serviceType, setServiceType] = useState<ServiceType>(service?.serviceType ?? 'training_course');
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(
    service
      ? {
          title: service.title,
          description: service.description ?? '',
          deliveryMode: service.deliveryMode,
          status: service.status,
        }
      : DEFAULT_SERVICE_FORM
  );
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(
    service
      ? {
          pricingUnit: service.trainingDetails?.pricingUnit ?? 'per_person',
          defaultPrice: service.trainingDetails?.defaultPrice ?? '',
          defaultCurrency: service.trainingDetails?.defaultCurrency ?? 'HKD',
        }
      : DEFAULT_TRAINING_FORM
  );
  const [eventForm, setEventForm] = useState<EventFormState>(
    service
      ? {
          eventCategory: service.eventDetails?.eventCategory ?? 'workshop',
        }
      : DEFAULT_EVENT_FORM
  );
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(
    service
      ? {
          consultationFormat: service.consultationDetails?.consultationFormat ?? 'one_on_one',
          maxGroupSize: service.consultationDetails?.maxGroupSize?.toString() ?? '',
          durationMinutes: service.consultationDetails?.durationMinutes?.toString() ?? '60',
          pricingModel: service.consultationDetails?.pricingModel ?? 'free',
          defaultHourlyRate: service.consultationDetails?.defaultHourlyRate ?? '',
          defaultPackagePrice: service.consultationDetails?.defaultPackagePrice ?? '',
          defaultPackageSessions: service.consultationDetails?.defaultPackageSessions?.toString() ?? '',
          defaultCurrency: service.consultationDetails?.defaultCurrency ?? 'HKD',
          calendlyUrl: service.consultationDetails?.calendlyUrl ?? '',
        }
      : DEFAULT_CONSULTATION_FORM
  );
  const [coverFileName, setCoverFileName] = useState('cover-image.jpg');

  const buildTypeSpecificPayload = (
    currentServiceType: ServiceType
  ):
    | Pick<ApiSchemas['CreateServiceRequest'], 'training_details'>
    | Pick<ApiSchemas['CreateServiceRequest'], 'event_details'>
    | Pick<ApiSchemas['CreateServiceRequest'], 'consultation_details'> => {
    if (currentServiceType === 'training_course') {
      return {
        training_details: {
          pricing_unit: trainingForm.pricingUnit,
          default_price: trainingForm.defaultPrice.trim() || null,
          default_currency: trainingForm.defaultCurrency.trim() || 'HKD',
        },
      };
    }
    if (currentServiceType === 'event') {
      return {
        event_details: {
          event_category: eventForm.eventCategory,
        },
      };
    }
    return {
      consultation_details: {
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
      },
    };
  };

  return (
    <Card
      title='Services section'
      description={
        isEditMode
          ? 'Update Service for the selected row, or cancel to return to add mode.'
          : 'Add Service using the form below.'
      }
      className='space-y-4'
    >
      {!isEditMode ? (
        <div>
          <Label htmlFor='service-type'>Service type</Label>
          <Select
            id='service-type'
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value as ServiceType)}
          >
            {SERVICE_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {formatEnumLabel(entry)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <ServiceFormFields value={serviceForm} onChange={setServiceForm} />

      {serviceType === 'training_course' ? (
        <TrainingFormFields value={trainingForm} onChange={setTrainingForm} />
      ) : null}
      {serviceType === 'event' ? <EventFormFields value={eventForm} onChange={setEventForm} /> : null}
      {serviceType === 'consultation' ? (
        <ConsultationFormFields value={consultationForm} onChange={setConsultationForm} />
      ) : null}

      {isEditMode ? (
        <div>
          <Label htmlFor='service-detail-cover-file-name'>Cover image file name</Label>
          <Input
            id='service-detail-cover-file-name'
            value={coverFileName}
            onChange={(event) => setCoverFileName(event.target.value)}
          />
        </div>
      ) : null}

      {error ? <p className='text-sm text-red-600'>{error}</p> : null}

      <div className='flex flex-wrap justify-start gap-2'>
        {isEditMode ? (
          <Button
            type='button'
            disabled={isLoading || !service}
            onClick={() => {
              if (!service) {
                return;
              }
              void onUpdate({
                title: serviceForm.title.trim(),
                description: serviceForm.description.trim() || null,
                delivery_mode: serviceForm.deliveryMode,
                status: serviceForm.status,
                ...buildTypeSpecificPayload(service.serviceType),
              });
            }}
          >
            {isLoading ? 'Updating...' : 'Update Service'}
          </Button>
        ) : (
          <Button
            type='button'
            disabled={isLoading || !serviceForm.title.trim()}
            onClick={() =>
              void onCreate({
                service_type: serviceType,
                title: serviceForm.title.trim(),
                description: serviceForm.description.trim() || null,
                delivery_mode: serviceForm.deliveryMode,
                status: serviceForm.status,
                ...buildTypeSpecificPayload(serviceType),
              })
            }
          >
            {isLoading ? 'Adding...' : 'Add Service'}
          </Button>
        )}
        {isEditMode ? (
          <>
            <Button
              type='button'
              variant='secondary'
              onClick={onCancelSelection}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={isLoading || !coverFileName.trim() || !service}
              onClick={() => void onUploadCover(coverFileName.trim(), 'image/jpeg')}
            >
              Generate cover upload URL
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}
