import type { EventFormState } from './event-form-fields';
import type { InstanceFormState } from './instance-form-fields';
import type { TrainingFormState } from './training-form-fields';

import type { components } from '@/types/generated/admin-api.generated';
import type { EventTicketTier, ServiceInstance, ServiceType } from '@/types/services';

import { getAdminDefaultCurrencyCode } from '@/lib/config';
import { buildSessionSlotsUtcPayload } from '@/lib/format';
import { INSTANCE_SLUG_PATTERN } from '@/lib/slug-utils';

type ApiSchemas = components['schemas'];
const defaultCurrencyCode = getAdminDefaultCurrencyCode();

export type BuildInstanceCreatePayloadSuccess = {
  ok: true;
  payload: ApiSchemas['CreateInstanceRequest'];
};

export type BuildInstanceUpdatePayloadSuccess = {
  ok: true;
  payload: ApiSchemas['UpdateInstanceRequest'];
};

export type BuildInstancePayloadFailure = {
  ok: false;
  slugSubmitError?: string;
  sessionSlotsError?: string;
};

export type BuildInstanceCreatePayloadResult = BuildInstanceCreatePayloadSuccess | BuildInstancePayloadFailure;
export type BuildInstanceUpdatePayloadResult = BuildInstanceUpdatePayloadSuccess | BuildInstancePayloadFailure;

export interface BuildInstanceCreatePayloadInput {
  instanceForm: InstanceFormState;
  tagIds: string[];
  effectiveServiceType: ServiceType;
  trainingForm: TrainingFormState;
  eventForm: EventFormState;
  resolvedEventCategory: EventFormState['eventCategory'];
  instance: ServiceInstance | null;
  duplicateEventTiersTemplate: EventTicketTier[] | null;
}

export function buildInstanceCreatePayload(
  input: BuildInstanceCreatePayloadInput,
): BuildInstanceCreatePayloadResult {
  const {
    instanceForm,
    tagIds,
    effectiveServiceType,
    trainingForm,
    eventForm,
    resolvedEventCategory,
    instance,
    duplicateEventTiersTemplate,
  } = input;

  const slotsPayload = buildSessionSlotsUtcPayload(instanceForm.sessionSlots);
  if (!slotsPayload.ok) {
    return { ok: false, sessionSlotsError: slotsPayload.message };
  }

  const slugTrimmed = instanceForm.slug.trim().toLowerCase();
  if (!slugTrimmed) {
    return { ok: false, slugSubmitError: 'slug is required' };
  }
  if (!INSTANCE_SLUG_PATTERN.test(slugTrimmed)) {
    return {
      ok: false,
      slugSubmitError: 'Use lowercase letters, digits, and single hyphens between segments.',
    };
  }

  const cohortTrimmed = instanceForm.cohort.trim().toLowerCase();
  const maxCapParsed = instanceForm.maxCapacity.trim() ? Number(instanceForm.maxCapacity) : null;
  const payload: ApiSchemas['CreateInstanceRequest'] = {
    title: instanceForm.title.trim() || null,
    slug: slugTrimmed,
    description: instanceForm.description.trim() || null,
    status: instanceForm.status,
    delivery_mode: instanceForm.deliveryMode || undefined,
    location_id: instanceForm.locationId.trim() || null,
    max_capacity: maxCapParsed,
    waitlist_enabled: instanceForm.waitlistEnabled,
    instructor_id: instanceForm.instructorId.trim() || null,
    cohort: cohortTrimmed || null,
    notes: instanceForm.notes.trim() || null,
    external_url: instanceForm.externalUrl.trim() || null,
    partner_organization_ids: instanceForm.partnerOrganizations.map((row) => row.id),
    tag_ids: tagIds,
    session_slots: slotsPayload.session_slots,
  };
  if (maxCapParsed !== null) {
    const trimmedOverride = instanceForm.capacityLeftOverride.trim();
    payload.capacity_left_override = trimmedOverride === '' ? null : Number(trimmedOverride);
  }

  if (effectiveServiceType === 'training_course') {
    payload.training_details = {
      training_format: 'group',
      price: trainingForm.defaultPrice || '0',
      currency: trainingForm.defaultCurrency || defaultCurrencyCode,
      pricing_unit: trainingForm.pricingUnit,
    };
  } else if (effectiveServiceType === 'event') {
    const priceStr = eventForm.defaultPrice.trim();
    const currencyStr = (eventForm.defaultCurrency || defaultCurrencyCode).trim();
    const tiers =
      (instance?.eventTicketTiers?.length ? instance.eventTicketTiers : null) ??
      (instance?.resolvedEventTicketTiers?.length ? instance.resolvedEventTicketTiers : null) ??
      duplicateEventTiersTemplate ??
      [];
    if (tiers.length > 1) {
      payload.event_ticket_tiers = tiers.map((tier, index) => ({
        name: tier.name,
        description: tier.description,
        price:
          tier.name === resolvedEventCategory
            ? priceStr
            : (tier.price ?? '0'),
        currency:
          tier.name === resolvedEventCategory
            ? (currencyStr || defaultCurrencyCode)
            : (tier.currency ?? defaultCurrencyCode),
        max_quantity: tier.maxQuantity,
        sort_order: tier.sortOrder ?? index,
      }));
    } else if (tiers.length === 1) {
      const t = tiers[0];
      payload.event_ticket_tiers = [
        {
          name: t.name,
          description: t.description,
          price: priceStr,
          currency: currencyStr || defaultCurrencyCode,
          max_quantity: t.maxQuantity,
          sort_order: t.sortOrder ?? 0,
        },
      ];
    } else {
      payload.event_ticket_tiers = [
        {
          name: resolvedEventCategory,
          description: null,
          price: priceStr,
          currency: currencyStr || defaultCurrencyCode,
          max_quantity: null,
          sort_order: 0,
        },
      ];
    }
  }

  return { ok: true, payload };
}

export function buildInstanceUpdatePayload(
  input: BuildInstanceCreatePayloadInput,
): BuildInstanceUpdatePayloadResult {
  const result = buildInstanceCreatePayload(input);
  if (!result.ok) {
    return result;
  }
  const payload: ApiSchemas['UpdateInstanceRequest'] = {
    ...result.payload,
    status: input.instanceForm.status,
  };
  const maxCapParsedForOverride = input.instanceForm.maxCapacity.trim()
    ? Number(input.instanceForm.maxCapacity)
    : null;
  if (maxCapParsedForOverride === null) {
    payload.capacity_left_override = null;
  }
  return { ok: true, payload };
}
