import type { ConsultationFormState } from './consultation-form-fields';
import type { EventFormState } from './event-form-fields';
import type { TrainingFormState } from './training-form-fields';
import type { ServiceFormState } from './service-form-fields';
import type { components } from '@/types/generated/admin-api.generated';
import type { ServiceType } from '@/types/services';

type ApiSchemas = components['schemas'];

export function buildServiceTypeSpecificPayload(
  currentServiceType: ServiceType,
  trainingForm: TrainingFormState,
  eventForm: EventFormState,
  consultationForm: ConsultationFormState,
):
  | Pick<ApiSchemas['CreateServiceRequest'], 'training_details'>
  | Pick<ApiSchemas['CreateServiceRequest'], 'event_details'>
  | Pick<ApiSchemas['CreateServiceRequest'], 'consultation_details'> {
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
        default_price: eventForm.defaultPrice.trim() || null,
        default_currency: eventForm.defaultCurrency.trim() || 'HKD',
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
    },
  };
}

export function buildServiceCreatePayload(input: {
  serviceType: ServiceType;
  serviceForm: ServiceFormState;
  serviceKey: string | null;
  bookingSystem: string;
  serviceTier: string;
  locationId: string;
  trainingForm: TrainingFormState;
  eventForm: EventFormState;
  consultationForm: ConsultationFormState;
}): ApiSchemas['CreateServiceRequest'] {
  const { serviceType, serviceForm, serviceKey, bookingSystem, serviceTier, locationId } = input;
  return {
    service_type: serviceType,
    title: serviceForm.title.trim(),
    description: serviceForm.description.trim() || null,
    service_key: serviceKey,
    booking_system: bookingSystem.trim() || null,
    service_tier: serviceTier.trim() || null,
    location_id: serviceForm.deliveryMode === 'online' ? null : locationId.trim() || null,
    delivery_mode: serviceForm.deliveryMode,
    status: serviceForm.status,
    ...buildServiceTypeSpecificPayload(
      serviceType,
      input.trainingForm,
      input.eventForm,
      input.consultationForm,
    ),
  };
}

export function buildServiceUpdatePayload(input: {
  serviceType: ServiceType;
  serviceForm: ServiceFormState;
  serviceKey: string | null;
  bookingSystem: string;
  serviceTier: string;
  locationId: string;
  trainingForm: TrainingFormState;
  eventForm: EventFormState;
  consultationForm: ConsultationFormState;
}): ApiSchemas['PartialUpdateServiceRequest'] {
  const { serviceForm, serviceKey, bookingSystem, serviceTier, locationId, serviceType } = input;
  return {
    title: serviceForm.title.trim(),
    description: serviceForm.description.trim() || null,
    service_key: serviceKey,
    booking_system: bookingSystem.trim() || null,
    service_tier: serviceTier.trim() || null,
    location_id: serviceForm.deliveryMode === 'online' ? null : locationId.trim() || null,
    delivery_mode: serviceForm.deliveryMode,
    status: serviceForm.status,
    ...buildServiceTypeSpecificPayload(
      serviceType,
      input.trainingForm,
      input.eventForm,
      input.consultationForm,
    ),
  };
}
