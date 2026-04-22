import type { ConsultationFormState } from './consultation-form-fields';
import type { EventFormState } from './event-form-fields';
import type { InstanceFormState } from './instance-form-fields';
import type { ServiceFormState } from './service-form-fields';
import type { TrainingFormState } from './training-form-fields';

export const DEFAULT_SERVICE_FORM: ServiceFormState = {
  title: '',
  description: '',
  slug: '',
  deliveryMode: 'online',
  status: 'draft',
};

export const DEFAULT_TRAINING_FORM: TrainingFormState = {
  pricingUnit: 'per_person',
  defaultPrice: '',
  defaultCurrency: 'HKD',
};

export const DEFAULT_EVENT_FORM: EventFormState = {
  eventCategory: 'workshop',
};

export const DEFAULT_CONSULTATION_FORM: ConsultationFormState = {
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

export const DEFAULT_INSTANCE_FORM: InstanceFormState = {
  title: '',
  slug: '',
  description: '',
  status: 'scheduled',
  deliveryMode: '',
  locationId: '',
  maxCapacity: '',
  waitlistEnabled: false,
  instructorId: '',
  notes: '',
  sessionSlots: [],
};
