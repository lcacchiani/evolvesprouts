'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { AdminInlineError } from '@/components/ui/admin-inline-error';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';

import { buildSessionSlotsUtcPayload } from '@/lib/format';
import { computeSuggestedInstanceSlug, INSTANCE_SLUG_PATTERN } from '@/lib/slug-utils';

import type { components } from '@/types/generated/admin-api.generated';
import type { ServiceSummary, ServiceType } from '@/types/services';

import { ConsultationFormFields, type ConsultationFormState } from './consultation-form-fields';
import {
  EventCategoryControl,
  EventDefaultCurrencyControl,
  EventDefaultPriceControl,
  type EventFormState,
} from './event-form-fields';
import {
  DEFAULT_CONSULTATION_FORM,
  DEFAULT_EVENT_FORM,
  DEFAULT_INSTANCE_FORM,
  DEFAULT_TRAINING_FORM,
} from './form-defaults';
import { EventInstancePartnersField } from './event-instance-partners-field';
import {
  InstanceFormFields,
  InstanceInstructorField,
  type InstanceFormState,
} from './instance-form-fields';
import { SessionSlotEditor } from './session-slot-editor';
import { TrainingFormFields, type TrainingFormState } from './training-form-fields';

type ApiSchemas = components['schemas'];

export interface CreateInstanceDialogProps {
  open: boolean;
  serviceType: ServiceType;
  /** When set, used to suggest training_course slugs (MBA vs other). */
  serviceSummary?: ServiceSummary | null;
  /** Parent service default venue when the instance row has no location yet (matches instance panel). */
  serviceDefaultLocationId?: string | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onCreate: (payload: ApiSchemas['CreateInstanceRequest']) => Promise<void> | void;
}

export function CreateInstanceDialog({
  open,
  serviceType,
  serviceSummary = null,
  serviceDefaultLocationId = null,
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
  const [sessionSlotsError, setSessionSlotsError] = useState('');
  const [slugSubmitError, setSlugSubmitError] = useState('');
  const slugTouchedRef = useRef(false);

  const effectiveSessionSlotDefaultLocationId = useMemo(
    () => instanceForm.locationId.trim() || serviceDefaultLocationId?.trim() || null,
    [instanceForm.locationId, serviceDefaultLocationId]
  );

  const suggestedSlug = useMemo(
    () => computeSuggestedInstanceSlug(serviceType, serviceSummary ?? null, instanceForm),
    [serviceType, serviceSummary, instanceForm]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    slugTouchedRef.current = false;
    queueMicrotask(() => {
      setInstanceForm(DEFAULT_INSTANCE_FORM);
      setTrainingForm(DEFAULT_TRAINING_FORM);
      setEventForm(DEFAULT_EVENT_FORM);
      setConsultationForm(DEFAULT_CONSULTATION_FORM);
      setSessionSlotsError('');
      setSlugSubmitError('');
    });
  }, [open]);

  useEffect(() => {
    if (!open || slugTouchedRef.current) {
      return;
    }
    if (serviceType !== 'event' && serviceType !== 'training_course') {
      return;
    }
    const next = suggestedSlug.trim().toLowerCase();
    queueMicrotask(() => {
      setInstanceForm((prev) => ({ ...prev, slug: next }));
    });
  }, [open, serviceType, suggestedSlug]);

  const eventPriceMissing = serviceType === 'event' && !eventForm.defaultPrice.trim();
  const cohortTrimmed = instanceForm.cohort.trim().toLowerCase();
  const cohortInvalid = Boolean(cohortTrimmed) && !INSTANCE_SLUG_PATTERN.test(cohortTrimmed);
  const slugTrimmed = instanceForm.slug.trim().toLowerCase();
  const slugPatternInvalid = Boolean(slugTrimmed) && !INSTANCE_SLUG_PATTERN.test(slugTrimmed);
  const handleSubmit = async () => {
    setSlugSubmitError('');
    if (serviceType === 'event' || serviceType === 'training_course') {
      if (!slugTrimmed) {
        setSlugSubmitError('slug is required for event and training_course instances');
        return;
      }
      if (!INSTANCE_SLUG_PATTERN.test(slugTrimmed)) {
        setSlugSubmitError('Use lowercase letters, digits, and single hyphens between segments.');
        return;
      }
    }
    const slotsPayload = buildSessionSlotsUtcPayload(instanceForm.sessionSlots);
    if (!slotsPayload.ok) {
      setSessionSlotsError(slotsPayload.message);
      return;
    }
    setSessionSlotsError('');
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
      cohort: cohortTrimmed || null,
      notes: instanceForm.notes.trim() || null,
      external_url: instanceForm.externalUrl.trim() || null,
      partner_organization_ids:
        serviceType === 'event' ? instanceForm.partnerOrganizations.map((row) => row.id) : [],
      session_slots: slotsPayload.session_slots,
    };

    if (serviceType === 'training_course') {
      payload.training_details = {
        training_format: 'group',
        price: trainingForm.defaultPrice || '0',
        currency: trainingForm.defaultCurrency || 'HKD',
        pricing_unit: trainingForm.pricingUnit,
      };
    } else if (serviceType === 'event') {
      const priceStr = eventForm.defaultPrice.trim();
      const currencyStr = (eventForm.defaultCurrency || 'HKD').trim();
      payload.event_ticket_tiers = [
        {
          name: eventForm.eventCategory,
          description: null,
          price: priceStr,
          currency: currencyStr || 'HKD',
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
      };
    }
    await onCreate(payload);
  };

  const slugFieldMode = serviceType === 'consultation' ? 'optional' : 'required';
  const slugAccessory =
    serviceType === 'event' || serviceType === 'training_course' ? (
      <Button
        type='button'
        variant='secondary'
        className='text-xs'
        onClick={() => {
          slugTouchedRef.current = false;
          setInstanceForm((prev) => ({ ...prev, slug: suggestedSlug.trim().toLowerCase() }));
          setSlugSubmitError('');
        }}
      >
        Reset to suggestion
      </Button>
    ) : null;

  return (
    <FormDialog
      open={open}
      title='Create Instance'
      isLoading={isLoading}
      error={error}
      submitLabel='Create instance'
      submitDisabled={eventPriceMissing || cohortInvalid || slugPatternInvalid}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <InstanceFormFields
        value={instanceForm}
        onChange={(next) => {
          if (next.slug !== instanceForm.slug) {
            slugTouchedRef.current = true;
          }
          setInstanceForm(next);
        }}
        slugFieldMode={slugFieldMode}
        slugFieldError={slugSubmitError}
        slugFieldAccessory={slugAccessory}
      />
      {serviceType === 'training_course' ? (
        <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <InstanceInstructorField
            value={instanceForm.instructorId}
            onChange={(instructorId) =>
              setInstanceForm((prev) => ({ ...prev, instructorId }))
            }
          />
          <div className='sm:col-span-1' />
        </div>
      ) : null}
      {serviceType === 'consultation' || serviceType === 'event' ? (
        <div className='mt-3'>
          <InstanceInstructorField
            value={instanceForm.instructorId}
            onChange={(instructorId) =>
              setInstanceForm((prev) => ({ ...prev, instructorId }))
            }
          />
        </div>
      ) : null}
      {serviceType === 'training_course' ? (
        <div className='mt-3'>
          <TrainingFormFields value={trainingForm} onChange={setTrainingForm} />
        </div>
      ) : null}
      {serviceType === 'event' ? (
        <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <EventCategoryControl value={eventForm} onChange={setEventForm} categoryFieldId='dialog-event-category' />
          <EventDefaultPriceControl value={eventForm} onChange={setEventForm} />
          <EventDefaultCurrencyControl value={eventForm} onChange={setEventForm} />
        </div>
      ) : null}
      {serviceType === 'event' ? (
        <div className='mt-3'>
          <EventInstancePartnersField
            value={instanceForm.partnerOrganizations}
            onChange={(next) => setInstanceForm((prev) => ({ ...prev, partnerOrganizations: next }))}
          />
        </div>
      ) : null}
      {serviceType === 'consultation' ? (
        <div className='mt-3'>
          <ConsultationFormFields value={consultationForm} onChange={setConsultationForm} />
        </div>
      ) : null}
      <div className='mt-3'>
        <SessionSlotEditor
          slots={instanceForm.sessionSlots}
          defaultLocationId={effectiveSessionSlotDefaultLocationId}
          onChange={(sessionSlots) => {
            setSessionSlotsError('');
            setInstanceForm((prev) => ({ ...prev, sessionSlots }));
          }}
        />
        {sessionSlotsError ? <AdminInlineError>{sessionSlotsError}</AdminInlineError> : null}
      </div>
    </FormDialog>
  );
}
