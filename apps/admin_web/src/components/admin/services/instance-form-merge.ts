import {
  DEFAULT_CONSULTATION_INSTANCE_FORM,
  DEFAULT_EVENT_FORM,
} from './form-defaults';
import type { ConsultationFormState } from './consultation-form-fields';
import type { EventFormState } from './event-form-fields';
import type { InstanceFormState } from './instance-form-fields';
import type { TrainingFormState } from './training-form-fields';

import { getAdminDefaultCurrencyCode } from '@/lib/config';
import { normalizeEventCategoryFromApi, mapSessionSlotsFromApiToForm } from '@/lib/format';
import {
  isConsultationLikeServiceType,
  type EventCategory,
  type EventTicketTier,
  type PartnerOrgRef,
  type ServiceInstance,
  type ServiceSummary,
  type SessionSlot,
  type SessionSlotFormRow,
} from '@/types/services';

const defaultCurrencyCode = getAdminDefaultCurrencyCode();

export function mergeServiceIntoInstanceForm(
  prev: InstanceFormState,
  service: ServiceSummary
): InstanceFormState {
  return {
    ...prev,
    deliveryMode: service.deliveryMode,
    locationId: service.locationId ?? '',
  };
}

export function mergeServiceIntoEventForm(_prev: EventFormState, service: ServiceSummary): EventFormState {
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

export function resolveInheritedEventCategory(
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

export function mergeServiceIntoTrainingForm(
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

export function mergeServiceIntoConsultationForm(
  prev: ConsultationFormState,
  service: ServiceSummary
): ConsultationFormState {
  if (!isConsultationLikeServiceType(service.serviceType)) {
    return prev;
  }
  if (!service.consultationDetails) {
    return DEFAULT_CONSULTATION_INSTANCE_FORM;
  }
  const cd = service.consultationDetails;
  const pm = cd.pricingModel;
  return {
    ...prev,
    pricingModel: pm,
    defaultHourlyRate: pm === 'hourly' ? (cd.defaultHourlyRate ?? '') : '',
    defaultPackagePrice: pm === 'package' ? (cd.defaultPackagePrice ?? '') : '',
    defaultPackageSessions: cd.defaultPackageSessions?.toString() ?? '',
    defaultCurrency: cd.defaultCurrency ?? defaultCurrencyCode,
  };
}

export function consultationFormFromInstanceResolved(instance: ServiceInstance): ConsultationFormState {
  const r = instance.resolvedConsultationDetails;
  if (!r) {
    return DEFAULT_CONSULTATION_INSTANCE_FORM;
  }
  const pm = r.pricingModel;
  return {
    consultationFormat: 'one_on_one',
    maxGroupSize: '',
    durationMinutes: '',
    pricingModel: pm,
    defaultHourlyRate: pm === 'hourly' ? (r.price ?? '') : '',
    defaultPackagePrice: pm === 'package' ? (r.price ?? '') : '',
    defaultPackageSessions: r.packageSessions?.toString() ?? '',
    defaultCurrency: r.currency ?? defaultCurrencyCode,
  };
}

export function mapPartnerRefsFromInstance(instance: ServiceInstance): PartnerOrgRef[] {
  return instance.partnerOrganizations.map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
    locationId: row.locationId ?? null,
  }));
}

export function cloneSessionSlotsForCreate(slots: SessionSlot[]): SessionSlotFormRow[] {
  return mapSessionSlotsFromApiToForm(slots).map((row) => ({
    id: null,
    instanceId: null,
    locationId: row.locationId,
    startsAtLocal: row.startsAtLocal,
    endsAtLocal: row.endsAtLocal,
    sortOrder: row.sortOrder,
  }));
}

export function cloneEventTiersForCreate(tiers: EventTicketTier[]): EventTicketTier[] {
  return tiers.map((tier, index) => ({
    id: null,
    instanceId: null,
    name: tier.name,
    description: tier.description,
    price: tier.price,
    currency: tier.currency,
    maxQuantity: tier.maxQuantity,
    sortOrder: tier.sortOrder ?? index,
  }));
}
