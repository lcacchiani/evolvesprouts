import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

function defineEnumValues<T extends string>() {
  return <U extends readonly T[]>(values: U & ([T] extends [U[number]] ? unknown : never)) => values;
}

export type ServiceType = ApiSchemas['ServiceType'];
export const SERVICE_TYPES = defineEnumValues<ServiceType>()(
  ['training_course', 'event', 'consultation'] as const satisfies readonly ServiceType[]
);

export type ServiceStatus = ApiSchemas['ServiceStatus'];
export const SERVICE_STATUSES = defineEnumValues<ServiceStatus>()(
  ['draft', 'published', 'archived'] as const satisfies readonly ServiceStatus[]
);

export type ServiceDeliveryMode = ApiSchemas['ServiceDeliveryMode'];
export const SERVICE_DELIVERY_MODES = defineEnumValues<ServiceDeliveryMode>()(
  ['online', 'in_person', 'hybrid'] as const satisfies readonly ServiceDeliveryMode[]
);

export type TrainingFormat = ApiSchemas['TrainingFormat'];
export const TRAINING_FORMATS = defineEnumValues<TrainingFormat>()(
  ['group', 'private'] as const satisfies readonly TrainingFormat[]
);

export type TrainingPricingUnit = ApiSchemas['TrainingPricingUnit'];
export const TRAINING_PRICING_UNITS = defineEnumValues<TrainingPricingUnit>()(
  ['per_person', 'per_family'] as const satisfies readonly TrainingPricingUnit[]
);

export type EventCategory = ApiSchemas['EventCategory'];
export const EVENT_CATEGORIES = defineEnumValues<EventCategory>()(
  ['workshop', 'webinar', 'open_house', 'community_meetup', 'other'] as const satisfies readonly EventCategory[]
);

export type ConsultationFormat = ApiSchemas['ConsultationFormat'];
export const CONSULTATION_FORMATS = defineEnumValues<ConsultationFormat>()(
  ['one_on_one', 'group'] as const satisfies readonly ConsultationFormat[]
);

export type ConsultationPricingModel = ApiSchemas['ConsultationPricingModel'];
export const CONSULTATION_PRICING_MODELS = defineEnumValues<ConsultationPricingModel>()(
  ['free', 'hourly', 'package'] as const satisfies readonly ConsultationPricingModel[]
);

export type InstanceStatus = ApiSchemas['InstanceStatus'];
export const INSTANCE_STATUSES = defineEnumValues<InstanceStatus>()(
  ['scheduled', 'open', 'full', 'in_progress', 'completed', 'cancelled'] as const satisfies readonly InstanceStatus[]
);

export type DiscountType = ApiSchemas['DiscountType'];
export const DISCOUNT_TYPES = defineEnumValues<DiscountType>()(
  ['percentage', 'absolute'] as const satisfies readonly DiscountType[]
);

export type EnrollmentStatus = ApiSchemas['EnrollmentStatus'];
export const ENROLLMENT_STATUSES = defineEnumValues<EnrollmentStatus>()(
  ['registered', 'waitlisted', 'confirmed', 'cancelled', 'completed'] as const satisfies readonly EnrollmentStatus[]
);

export interface ServiceSummary {
  id: string;
  serviceType: ServiceType;
  title: string;
  /** Lowercase referral slug from Aurora; null when unset. */
  slug: string | null;
  description: string | null;
  coverImageS3Key: string | null;
  deliveryMode: ServiceDeliveryMode;
  status: ServiceStatus;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  trainingDetails: {
    pricingUnit: TrainingPricingUnit;
    defaultPrice: string | null;
    defaultCurrency: string | null;
  } | null;
}

export interface ServiceDetail extends ServiceSummary {
  tagIds: string[];
  assetIds: string[];
  instancesCount: number;
  trainingDetails: {
    pricingUnit: TrainingPricingUnit;
    defaultPrice: string | null;
    defaultCurrency: string | null;
  } | null;
  eventDetails: {
    eventCategory: EventCategory;
  } | null;
  consultationDetails: {
    consultationFormat: ConsultationFormat;
    maxGroupSize: number | null;
    durationMinutes: number | null;
    pricingModel: ConsultationPricingModel;
    defaultHourlyRate: string | null;
    defaultPackagePrice: string | null;
    defaultPackageSessions: number | null;
    defaultCurrency: string | null;
    calendlyUrl: string | null;
  } | null;
}

export interface SessionSlot {
  id: string | null;
  instanceId: string | null;
  locationId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number | null;
}

export interface LocationSummary {
  id: string;
  name: string | null;
  areaId: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type GeographicAreaLevel = ApiSchemas['GeographicArea']['level'];

export interface GeographicAreaSummary {
  id: string;
  parentId: string | null;
  name: string;
  level: GeographicAreaLevel;
  code: string | null;
  sovereignCountryId: string | null;
  active: boolean;
  displayOrder: number;
}

export interface VenueFilters {
  areaId: string;
  search: string;
}

export const DEFAULT_VENUE_FILTERS: VenueFilters = {
  areaId: '',
  search: '',
};

export interface EventTicketTier {
  id: string | null;
  instanceId: string | null;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  maxQuantity: number | null;
  sortOrder: number | null;
}

export interface ServiceInstance {
  id: string;
  serviceId: string;
  parentServiceTitle: string | null;
  parentServiceType: ServiceType | null;
  title: string | null;
  description: string | null;
  coverImageS3Key: string | null;
  status: InstanceStatus;
  deliveryMode: ServiceDeliveryMode | null;
  locationId: string | null;
  maxCapacity: number | null;
  waitlistEnabled: boolean;
  instructorId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedTitle: string | null;
  resolvedDescription: string | null;
  resolvedCoverImageS3Key: string | null;
  resolvedDeliveryMode: string | null;
  sessionSlots: SessionSlot[];
  trainingDetails: {
    trainingFormat: TrainingFormat;
    price: string;
    currency: string;
    pricingUnit: TrainingPricingUnit;
  } | null;
  eventTicketTiers: EventTicketTier[];
  consultationDetails: {
    pricingModel: ConsultationPricingModel;
    price: string | null;
    currency: string;
    packageSessions: number | null;
    calendlyEventUrl: string | null;
  } | null;
}

export interface Enrollment {
  id: string;
  instanceId: string;
  contactId: string | null;
  familyId: string | null;
  organizationId: string | null;
  ticketTierId: string | null;
  discountCodeId: string | null;
  status: EnrollmentStatus;
  amountPaid: string | null;
  currency: string | null;
  enrolledAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: string;
  currency: string | null;
  validFrom: string | null;
  validUntil: string | null;
  serviceId: string | null;
  instanceId: string | null;
  maxUses: number | null;
  currentUses: number;
  active: boolean;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ServiceListFilters {
  serviceType: ServiceType | '';
  status: ServiceStatus | '';
  search: string;
}

export const DEFAULT_SERVICE_LIST_FILTERS: ServiceListFilters = {
  serviceType: '',
  status: '',
  search: '',
};

export interface InstanceListFilters {
  status: InstanceStatus | '';
}

export const DEFAULT_INSTANCE_LIST_FILTERS: InstanceListFilters = {
  status: '',
};

export interface EnrollmentListFilters {
  status: EnrollmentStatus | '';
}

export const DEFAULT_ENROLLMENT_LIST_FILTERS: EnrollmentListFilters = {
  status: '',
};

export type DiscountCodeScopeFilter = '' | 'unscoped' | 'service' | 'instance';

export interface DiscountCodeFilters {
  active: '' | 'true' | 'false';
  search: string;
  scope: DiscountCodeScopeFilter;
}

export const DEFAULT_DISCOUNT_CODE_FILTERS: DiscountCodeFilters = {
  active: '',
  search: '',
  scope: '',
};
