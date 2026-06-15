'use client';

import {
  ConsultationInstanceRowDFields,
  ConsultationInstanceRowEFields,
  type ConsultationFormState,
} from './consultation-form-fields';
import {
  EventCategoryControl,
  EventDefaultCurrencyControl,
  EventDefaultPriceControl,
  type EventFormState,
} from './event-form-fields';
import { EventInstancePartnersField } from './event-instance-partners-field';
import { InstanceInstructorField, type InstanceInstructorOption } from './instance-form-fields';
import {
  TrainingCurrencyControl,
  TrainingPriceControl,
  TrainingPricingUnitControl,
  type TrainingFormState,
} from './training-form-fields';

import { isConsultationLikeServiceType, type ServiceType } from '@/types/services';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PartnerOrgRef } from '@/types/services';

export interface InstanceDetailTypeSectionsProps {
  effectiveServiceType: ServiceType;
  consultationCatalogPricingReadOnly: boolean;
  typeFieldsLocked: boolean;
  instructorId: string;
  onInstructorIdChange: (instructorId: string) => void;
  instructorUsers: InstanceInstructorOption[];
  isLoadingInstructors: boolean;
  trainingForm: TrainingFormState;
  onTrainingFormChange: (next: TrainingFormState) => void;
  eventForm: EventFormState;
  onEventFormChange: (next: EventFormState) => void;
  resolvedEventCategory: EventFormState['eventCategory'];
  consultationForm: ConsultationFormState;
  onConsultationFormChange: (next: ConsultationFormState) => void;
  partnerOrganizations: PartnerOrgRef[];
  onPartnerOrganizationsChange: (next: PartnerOrgRef[]) => void;
  externalUrl: string;
  onExternalUrlChange: (next: string) => void;
  externalUrlInvalid: boolean;
}

export function InstanceDetailTypeSections({
  effectiveServiceType,
  consultationCatalogPricingReadOnly,
  typeFieldsLocked,
  instructorId,
  onInstructorIdChange,
  instructorUsers,
  isLoadingInstructors,
  trainingForm,
  onTrainingFormChange,
  eventForm,
  onEventFormChange,
  resolvedEventCategory,
  consultationForm,
  onConsultationFormChange,
  partnerOrganizations,
  onPartnerOrganizationsChange,
  externalUrl,
  onExternalUrlChange,
  externalUrlInvalid,
}: InstanceDetailTypeSectionsProps) {
  return (
    <>
      {effectiveServiceType === 'training_course' ? (
        <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
          <InstanceInstructorField
            value={instructorId}
            disabled={typeFieldsLocked}
            instructorOptions={instructorUsers}
            isLoadingInstructors={isLoadingInstructors}
            onChange={onInstructorIdChange}
          />
          <TrainingPricingUnitControl value={trainingForm} disabled={typeFieldsLocked} onChange={onTrainingFormChange} />
          <TrainingPriceControl value={trainingForm} disabled={typeFieldsLocked} onChange={onTrainingFormChange} />
          <TrainingCurrencyControl value={trainingForm} disabled={typeFieldsLocked} onChange={onTrainingFormChange} />
        </div>
      ) : null}

      {effectiveServiceType === 'event' ? (
        <>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <InstanceInstructorField
              value={instructorId}
              disabled={typeFieldsLocked}
              instructorOptions={instructorUsers}
              isLoadingInstructors={isLoadingInstructors}
              onChange={onInstructorIdChange}
            />
            <EventCategoryControl
              value={{
                ...eventForm,
                eventCategory: resolvedEventCategory,
              }}
              disabled={typeFieldsLocked}
              onChange={(next) =>
                onEventFormChange({ ...next, eventCategory: resolvedEventCategory })
              }
              categoryReadOnly
              categoryFieldId='instance-event-category'
            />
            <EventDefaultPriceControl
              value={eventForm}
              disabled={typeFieldsLocked}
              onChange={onEventFormChange}
              priceLabel='Price'
            />
            <EventDefaultCurrencyControl value={eventForm} disabled={typeFieldsLocked} onChange={onEventFormChange} />
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <div className='md:col-span-2'>
              <EventInstancePartnersField
                value={partnerOrganizations}
                disabled={typeFieldsLocked}
                onChange={onPartnerOrganizationsChange}
              />
            </div>
            <div className='md:col-span-2'>
              <Label htmlFor='instance-external-url'>External URL</Label>
              <Input
                id='instance-external-url'
                value={externalUrl}
                disabled={typeFieldsLocked}
                onChange={(event) => onExternalUrlChange(event.target.value)}
                placeholder='https://…'
                autoComplete='off'
              />
              {externalUrlInvalid ? (
                <p className='mt-1 text-xs text-red-600'>URL must start with http:// or https://</p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {isConsultationLikeServiceType(effectiveServiceType) ? (
        <>
          {consultationCatalogPricingReadOnly ? (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
              <p className='md:col-span-4 text-sm text-slate-500'>
                Pricing is managed on the service catalog. Open the service detail panel to edit.
                {effectiveServiceType === 'intro_call'
                  ? ' Intro-call session slots here drive the public booking grid.'
                  : ''}
              </p>
            </div>
          ) : null}
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <InstanceInstructorField
              value={instructorId}
              disabled={typeFieldsLocked}
              instructorOptions={instructorUsers}
              isLoadingInstructors={isLoadingInstructors}
              onChange={onInstructorIdChange}
            />
            <ConsultationInstanceRowDFields
              value={consultationForm}
              disabled={typeFieldsLocked || consultationCatalogPricingReadOnly}
              onChange={onConsultationFormChange}
            />
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <ConsultationInstanceRowEFields
              value={consultationForm}
              disabled={typeFieldsLocked || consultationCatalogPricingReadOnly}
              onChange={onConsultationFormChange}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
