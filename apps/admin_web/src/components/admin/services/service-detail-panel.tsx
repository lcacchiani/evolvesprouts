'use client';

import { useEffect, useMemo, useState } from 'react';

import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Button } from '@/components/ui/button';
import { AdminInlineError } from '@/components/ui/admin-inline-error';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { WarningTriangleIcon } from '@/components/icons/action-icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatEnumLabel, formatLocationLabel } from '@/lib/format';
import { AdminApiError, readAdminApiErrorField } from '@/lib/api-admin-client';
import { getServiceDiscountCodeUsageSummary } from '@/lib/services-api';

import type { components } from '@/types/generated/admin-api.generated';
import { SERVICE_DELIVERY_MODES, SERVICE_STATUSES, SERVICE_TYPES } from '@/types/services';
import type { ServiceDeliveryMode } from '@/types/services';
import type { LocationSummary, ServiceDetail, ServiceType } from '@/types/services';

import {
  ConsultationCurrencyControl,
  ConsultationDurationControl,
  ConsultationHourlyRateControl,
  ConsultationMaxGroupSizeControl,
  ConsultationPackagePriceControl,
  ConsultationPackageSessionsControl,
  ConsultationPricingModelControl,
  ConsultationServiceFormatField,
  type ConsultationFormState,
} from './consultation-form-fields';
import {
  EventCategoryControl,
  EventDefaultCurrencyControl,
  EventDefaultPriceControl,
  type EventFormState,
} from './event-form-fields';
import {
  DEFAULT_CONSULTATION_FORM,
  DEFAULT_EVENT_FORM,
  DEFAULT_SERVICE_FORM,
  DEFAULT_TRAINING_FORM,
} from './form-defaults';
import { ServiceReferralSlugField, type ServiceFormState } from './service-form-fields';
import {
  TrainingCurrencyControl,
  TrainingPriceControl,
  TrainingPricingUnitControl,
  type TrainingFormState,
} from './training-form-fields';
import { ServiceTierControl } from './service-tier-control';

type ApiSchemas = components['schemas'];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface ServiceDetailPanelProps {
  service: ServiceDetail | null;
  /** When set with `service` null, seed the create form from this template (UI-only duplicate). */
  createPrefillFromService?: ServiceDetail | null;
  locationOptions?: LocationSummary[];
  isLoadingLocations?: boolean;
  locationError?: string | null;
  isLoading: boolean;
  error: string;
  onCancelSelection: () => void;
  onCreate: (payload: ApiSchemas['CreateServiceRequest']) => Promise<void> | void;
  onUpdate: (payload: ApiSchemas['PartialUpdateServiceRequest']) => Promise<void> | void;
  onUploadCover: (fileName: string, contentType: string) => Promise<void> | void;
}

type DiscountUsageLoadState = 'idle' | 'loading' | 'ok' | 'error';

export function ServiceDetailPanel({
  service,
  createPrefillFromService = null,
  locationOptions = [],
  isLoadingLocations = false,
  locationError = null,
  isLoading,
  error,
  onCancelSelection,
  onCreate,
  onUpdate,
  onUploadCover,
}: ServiceDetailPanelProps) {
  const isEditMode = Boolean(service);
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [serviceType, setServiceType] = useState<ServiceType>(service?.serviceType ?? 'training_course');
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(
    service
      ? {
          title: service.title,
          description: service.description ?? '',
          slug: service.slug ?? '',
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
          defaultPrice: service.eventDetails?.defaultPrice ?? '',
          defaultCurrency: service.eventDetails?.defaultCurrency ?? 'HKD',
        }
      : DEFAULT_EVENT_FORM
  );
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(
    service
      ? {
          consultationFormat: service.consultationDetails?.consultationFormat ?? 'one_on_one',
          maxGroupSize: service.consultationDetails?.maxGroupSize?.toString() ?? '',
          durationMinutes: service.consultationDetails?.durationMinutes?.toString() ?? '',
          pricingModel: service.consultationDetails?.pricingModel ?? 'free',
          defaultHourlyRate: service.consultationDetails?.defaultHourlyRate ?? '',
          defaultPackagePrice: service.consultationDetails?.defaultPackagePrice ?? '',
          defaultPackageSessions: service.consultationDetails?.defaultPackageSessions?.toString() ?? '',
          defaultCurrency: service.consultationDetails?.defaultCurrency ?? 'HKD',
        }
      : DEFAULT_CONSULTATION_FORM
  );
  const [coverFileName, setCoverFileName] = useState('');
  const [bookingSystem, setBookingSystem] = useState(service?.bookingSystem ?? '');
  const [serviceTier, setServiceTier] = useState(service?.serviceTier ?? '');
  const [locationId, setLocationId] = useState(service?.locationId ?? '');
  const [discountUsageSummary, setDiscountUsageSummary] = useState<{
    totalCurrentUses: number;
    referencingCodeCount: number;
  } | null>(null);
  const [discountUsageLoadState, setDiscountUsageLoadState] = useState<DiscountUsageLoadState>('idle');
  const [slugConflictError, setSlugConflictError] = useState('');
  const [conflictingSlugNormalized, setConflictingSlugNormalized] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!service?.id) {
        setDiscountUsageSummary(null);
        setDiscountUsageLoadState('idle');
        return;
      }
      setDiscountUsageLoadState('loading');
      setDiscountUsageSummary(null);
      void getServiceDiscountCodeUsageSummary(service.id).then(({ summary, error: loadError }) => {
        if (cancelled) {
          return;
        }
        if (loadError) {
          setDiscountUsageSummary(null);
          setDiscountUsageLoadState('error');
          return;
        }
        setDiscountUsageSummary(summary);
        setDiscountUsageLoadState('ok');
      });
    });
    return () => {
      cancelled = true;
    };
  }, [service?.id]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      if (!service && createPrefillFromService) {
        const p = createPrefillFromService;
        setServiceType(p.serviceType);
        setBookingSystem(p.bookingSystem ?? '');
        setServiceTier(p.serviceTier ?? '');
        setLocationId(p.locationId ?? '');
        setServiceForm({
          title: `${p.title} (copy)`,
          description: p.description ?? '',
          slug: p.slug ?? '',
          deliveryMode: p.deliveryMode,
          status: 'draft',
        });
        setTrainingForm(
          p.trainingDetails
            ? {
                pricingUnit: p.trainingDetails.pricingUnit,
                defaultPrice: p.trainingDetails.defaultPrice ?? '',
                defaultCurrency: p.trainingDetails.defaultCurrency ?? 'HKD',
              }
            : DEFAULT_TRAINING_FORM
        );
        setEventForm(
          p.eventDetails
            ? {
                eventCategory: p.eventDetails.eventCategory,
                defaultPrice: p.eventDetails.defaultPrice ?? '',
                defaultCurrency: p.eventDetails.defaultCurrency ?? 'HKD',
              }
            : DEFAULT_EVENT_FORM
        );
        setConsultationForm(
          p.consultationDetails
            ? {
                consultationFormat: p.consultationDetails.consultationFormat,
                maxGroupSize: p.consultationDetails.maxGroupSize?.toString() ?? '',
                durationMinutes: p.consultationDetails.durationMinutes?.toString() ?? '',
                pricingModel: p.consultationDetails.pricingModel,
                defaultHourlyRate: p.consultationDetails.defaultHourlyRate ?? '',
                defaultPackagePrice: p.consultationDetails.defaultPackagePrice ?? '',
                defaultPackageSessions: p.consultationDetails.defaultPackageSessions?.toString() ?? '',
                defaultCurrency: p.consultationDetails.defaultCurrency ?? 'HKD',
              }
            : DEFAULT_CONSULTATION_FORM
        );
        setSlugConflictError('');
        setConflictingSlugNormalized(null);
        return;
      }
      if (!service) {
        setServiceType('training_course');
        setServiceForm(DEFAULT_SERVICE_FORM);
        setTrainingForm(DEFAULT_TRAINING_FORM);
        setEventForm(DEFAULT_EVENT_FORM);
        setConsultationForm(DEFAULT_CONSULTATION_FORM);
        setBookingSystem('');
        setServiceTier('');
        setLocationId('');
        setSlugConflictError('');
        setConflictingSlugNormalized(null);
        return;
      }
      setServiceType(service.serviceType);
      setBookingSystem(service.bookingSystem ?? '');
      setServiceTier(service.serviceTier ?? '');
      setLocationId(service.locationId ?? '');
      setServiceForm({
        title: service.title,
        description: service.description ?? '',
        slug: service.slug ?? '',
        deliveryMode: service.deliveryMode,
        status: service.status,
      });
      setTrainingForm({
        pricingUnit: service.trainingDetails?.pricingUnit ?? 'per_person',
        defaultPrice: service.trainingDetails?.defaultPrice ?? '',
        defaultCurrency: service.trainingDetails?.defaultCurrency ?? 'HKD',
      });
      setEventForm({
        eventCategory: service.eventDetails?.eventCategory ?? 'workshop',
        defaultPrice: service.eventDetails?.defaultPrice ?? '',
        defaultCurrency: service.eventDetails?.defaultCurrency ?? 'HKD',
      });
      setConsultationForm({
        consultationFormat: service.consultationDetails?.consultationFormat ?? 'one_on_one',
        maxGroupSize: service.consultationDetails?.maxGroupSize?.toString() ?? '',
        durationMinutes: service.consultationDetails?.durationMinutes?.toString() ?? '',
        pricingModel: service.consultationDetails?.pricingModel ?? 'free',
        defaultHourlyRate: service.consultationDetails?.defaultHourlyRate ?? '',
        defaultPackagePrice: service.consultationDetails?.defaultPackagePrice ?? '',
        defaultPackageSessions: service.consultationDetails?.defaultPackageSessions?.toString() ?? '',
        defaultCurrency: service.consultationDetails?.defaultCurrency ?? 'HKD',
      });
      setSlugConflictError('');
      setConflictingSlugNormalized(null);
    });
    return () => {
      cancelled = true;
    };
  }, [service, createPrefillFromService]);

  const slugPayloadValue = useMemo(() => {
    const t = serviceForm.slug.trim().toLowerCase();
    return t.length ? t : null;
  }, [serviceForm.slug]);

  const hasLocationOptions = locationOptions.length > 0;
  const locationExists = locationOptions.some((entry) => entry.id === locationId);
  const selectedLocationValue = locationExists ? locationId : locationId || '';
  const showDefaultLocationField = serviceForm.deliveryMode !== 'online';

  const normalizedSlugInput = serviceForm.slug.trim().toLowerCase();
  const saveBlockedBySlugConflict =
    Boolean(slugConflictError) &&
    conflictingSlugNormalized !== null &&
    normalizedSlugInput === conflictingSlugNormalized;

  const tierTrimmedForValidation = serviceTier.trim().toLowerCase();
  const tierInvalid = Boolean(tierTrimmedForValidation) && !SLUG_PATTERN.test(tierTrimmedForValidation);

  const deliveryModeSelect = (
    <div>
      <Label htmlFor='service-delivery-mode'>Delivery mode</Label>
      <Select
        id='service-delivery-mode'
        value={serviceForm.deliveryMode}
        onChange={(event) => {
          const nextMode = event.target.value as ServiceDeliveryMode;
          setServiceForm({ ...serviceForm, deliveryMode: nextMode });
          if (nextMode === 'online') {
            setLocationId('');
          }
        }}
      >
        {SERVICE_DELIVERY_MODES.map((entry) => (
          <option key={entry} value={entry}>
            {formatEnumLabel(entry)}
          </option>
        ))}
      </Select>
    </div>
  );

  const bookingAndCover = (
    <>
      <div>
        <Label htmlFor='service-booking-system'>Booking system</Label>
        <Input
          id='service-booking-system'
          value={bookingSystem}
          onChange={(event) => setBookingSystem(event.target.value)}
          placeholder='e.g. training-booking'
          maxLength={80}
          autoComplete='off'
        />
      </div>
      <div>
        <Label htmlFor='service-detail-cover-file-name'>Cover file name</Label>
        <Input
          id='service-detail-cover-file-name'
          value={coverFileName}
          onChange={(event) => setCoverFileName(event.target.value)}
          placeholder='e.g. media-cover.jpg'
        />
      </div>
    </>
  );

  const defaultLocationField = (
    <div>
      <Label htmlFor='service-default-location'>Default location</Label>
      {hasLocationOptions || isLoadingLocations ? (
        <Select
          id='service-default-location'
          value={selectedLocationValue}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value=''>{isLoadingLocations ? 'Loading locations...' : 'Select location'}</option>
          {locationId && !locationExists ? <option value={locationId}>{locationId}</option> : null}
          {locationOptions.map((location) => (
            <option key={location.id} value={location.id}>
              {formatLocationLabel(location)}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id='service-default-location'
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          placeholder='Location UUID'
          autoComplete='off'
        />
      )}
      {locationError ? <p className='mt-1 text-xs text-red-600'>{locationError}</p> : null}
    </div>
  );

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
  };

  async function confirmSlugChangeIfNeeded(newSlug: string | null, oldSlug: string | null): Promise<boolean> {
    if (newSlug === oldSlug) {
      return true;
    }
    const usageUnknown = discountUsageLoadState === 'error' || discountUsageSummary === null;
    if (usageUnknown) {
      const confirmed = await requestConfirm({
        title: 'Change referral slug?',
        description:
          "We couldn't verify current discount code usage — if this slug is referenced by active codes, changing it may break printed QR codes and links. Continue?",
        confirmLabel: 'Continue',
        cancelLabel: 'Cancel',
        variant: 'default',
      });
      return confirmed;
    }
    if (discountUsageSummary.totalCurrentUses > 0) {
      const confirmed = await requestConfirm({
        title: 'Change referral slug?',
        description: `This service has active discount code usage (${discountUsageSummary.totalCurrentUses} past redemptions). Changing the slug will break any existing printed QR codes and links. Continue?`,
        confirmLabel: 'Continue',
        cancelLabel: 'Cancel',
        variant: 'default',
      });
      return confirmed;
    }
    return true;
  }

  async function submitUpdate() {
    if (!service) {
      return;
    }
    const slugTrimmed = serviceForm.slug.trim();
    if (slugTrimmed && !SLUG_PATTERN.test(slugTrimmed.toLowerCase())) {
      return;
    }
    const newSlug = slugTrimmed.toLowerCase() || null;
    const oldSlug = (service.slug ?? '').trim().toLowerCase() || null;
    const ok = await confirmSlugChangeIfNeeded(newSlug, oldSlug);
    if (!ok) {
      return;
    }
    try {
      await onUpdate({
        title: serviceForm.title.trim(),
        description: serviceForm.description.trim() || null,
        slug: newSlug,
        booking_system: bookingSystem.trim() || null,
        service_tier: serviceTier.trim() || null,
        location_id: serviceForm.deliveryMode === 'online' ? null : locationId.trim() || null,
        delivery_mode: serviceForm.deliveryMode,
        status: serviceForm.status,
        ...buildTypeSpecificPayload(service.serviceType),
      });
      setSlugConflictError('');
      setConflictingSlugNormalized(null);
    } catch (caught) {
      if (
        caught instanceof AdminApiError &&
        caught.statusCode === 409 &&
        readAdminApiErrorField(caught) === 'slug'
      ) {
        setSlugConflictError('Referral slug already in use. Choose another.');
        setConflictingSlugNormalized(newSlug ?? '');
        return;
      }
      throw caught;
    }
  }

  async function submitCreate() {
    try {
      await onCreate({
        service_type: serviceType,
        title: serviceForm.title.trim(),
        description: serviceForm.description.trim() || null,
        slug: slugPayloadValue,
        booking_system: bookingSystem.trim() || null,
        service_tier: serviceTier.trim() || null,
        location_id: serviceForm.deliveryMode === 'online' ? null : locationId.trim() || null,
        delivery_mode: serviceForm.deliveryMode,
        status: serviceForm.status,
        ...buildTypeSpecificPayload(serviceType),
      });
      setSlugConflictError('');
      setConflictingSlugNormalized(null);
    } catch (caught) {
      if (
        caught instanceof AdminApiError &&
        caught.statusCode === 409 &&
        readAdminApiErrorField(caught) === 'slug'
      ) {
        setSlugConflictError('Referral slug already in use. Choose another.');
        setConflictingSlugNormalized(slugPayloadValue ?? '');
        return;
      }
      throw caught;
    }
  }

  return (
    <>
      <AdminEditorCard
        title='Service'
        description='Add or update a service using the same fields below.'
        actions={
          <>
            {isEditMode ? (
              <>
                <Button type='button' variant='secondary' onClick={onCancelSelection} disabled={isLoading}>
                  Cancel
                </Button>
                <Button
                  type='button'
                  disabled={
                    isLoading ||
                    !service ||
                    saveBlockedBySlugConflict ||
                    tierInvalid ||
                    Boolean(serviceForm.slug.trim() && !SLUG_PATTERN.test(serviceForm.slug.trim().toLowerCase()))
                  }
                  onClick={() => void submitUpdate()}
                >
                  {isLoading ? 'Updating...' : 'Update service'}
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
            ) : (
              <Button
                type='button'
                disabled={
                  isLoading ||
                  saveBlockedBySlugConflict ||
                  tierInvalid ||
                  !serviceForm.title.trim() ||
                  Boolean(serviceForm.slug.trim() && !SLUG_PATTERN.test(serviceForm.slug.trim().toLowerCase()))
                }
                onClick={() => void submitCreate()}
              >
                {isLoading ? 'Adding...' : 'Add service'}
              </Button>
            )}
          </>
        }
      >
        <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
          <div>
            <Label htmlFor='service-type'>Type</Label>
            <Select
              id='service-type'
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value as ServiceType)}
              disabled={isEditMode}
            >
              {SERVICE_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='service-title'>Title</Label>
            <Input
              id='service-title'
              value={serviceForm.title}
              onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })}
            />
          </div>
          <ServiceReferralSlugField
            value={serviceForm.slug}
            onChange={(next) => {
              if (next !== serviceForm.slug) {
                setSlugConflictError('');
                setConflictingSlugNormalized(null);
              }
              setServiceForm({ ...serviceForm, slug: next });
            }}
            slugUsageLoadError={
              discountUsageLoadState === 'error'
                ? 'Could not load discount code usage. Try again later.'
                : undefined
            }
            slugConflictError={slugConflictError || undefined}
          />
          <div>
            <div className='relative mb-1'>
              <Label htmlFor='service-status' className='mb-0 block pr-7'>
                Status
              </Label>
              {serviceForm.status === 'draft' ? (
                <span
                  className='absolute right-0 top-1/2 inline-flex -translate-y-1/2 text-amber-600'
                  role='img'
                  aria-label='Draft — not published to the website'
                  title='Draft — not published to the website'
                >
                  <WarningTriangleIcon className='h-4 w-4' aria-hidden />
                </span>
              ) : null}
            </div>
            <Select
              id='service-status'
              value={serviceForm.status}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, status: event.target.value as ServiceFormState['status'] })
              }
            >
              {SERVICE_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor='service-description'>Description</Label>
          <Textarea
            id='service-description'
            value={serviceForm.description}
            onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })}
            rows={3}
          />
        </div>

        {serviceType === 'training_course' ? (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            {deliveryModeSelect}
            <ServiceTierControl
              value={serviceTier}
              onChange={setServiceTier}
              id='service-tier-training'
              invalid={tierInvalid}
            />
            {bookingAndCover}
          </div>
        ) : null}

        {serviceType === 'training_course' ? (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <TrainingPricingUnitControl value={trainingForm} onChange={setTrainingForm} />
            <TrainingPriceControl
              value={trainingForm}
              onChange={setTrainingForm}
              priceLabel='Default price'
            />
            <TrainingCurrencyControl value={trainingForm} onChange={setTrainingForm} />
            {showDefaultLocationField ? defaultLocationField : null}
          </div>
        ) : null}

        {serviceType === 'event' ? (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            {deliveryModeSelect}
            <ServiceTierControl
              value={serviceTier}
              onChange={setServiceTier}
              id='service-tier-event'
              invalid={tierInvalid}
            />
            {bookingAndCover}
          </div>
        ) : null}

        {serviceType === 'event' ? (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            <EventCategoryControl value={eventForm} onChange={setEventForm} categoryFieldId='service-event-category' />
            <EventDefaultPriceControl value={eventForm} onChange={setEventForm} />
            <EventDefaultCurrencyControl value={eventForm} onChange={setEventForm} />
            {showDefaultLocationField ? defaultLocationField : null}
          </div>
        ) : null}

        {serviceType === 'consultation' ? (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
            {deliveryModeSelect}
            <ServiceTierControl
              value={serviceTier}
              onChange={setServiceTier}
              id='service-tier-consultation'
              invalid={tierInvalid}
            />
            {bookingAndCover}
          </div>
        ) : null}

        {serviceType === 'consultation' ? (
          <>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
              <ConsultationPricingModelControl value={consultationForm} onChange={setConsultationForm} />
              {consultationForm.pricingModel === 'hourly' ? (
                <ConsultationHourlyRateControl value={consultationForm} onChange={setConsultationForm} />
              ) : null}
              {consultationForm.pricingModel === 'package' ? (
                <ConsultationPackagePriceControl value={consultationForm} onChange={setConsultationForm} />
              ) : null}
              {consultationForm.pricingModel !== 'free' ? (
                <ConsultationCurrencyControl value={consultationForm} onChange={setConsultationForm} />
              ) : null}
              {showDefaultLocationField ? defaultLocationField : null}
            </div>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
              <ConsultationServiceFormatField value={consultationForm} onChange={setConsultationForm} />
              <ConsultationDurationControl value={consultationForm} onChange={setConsultationForm} />
              {consultationForm.pricingModel === 'package' ? (
                <ConsultationPackageSessionsControl value={consultationForm} onChange={setConsultationForm} />
              ) : null}
              {consultationForm.consultationFormat !== 'one_on_one' ? (
                <ConsultationMaxGroupSizeControl value={consultationForm} onChange={setConsultationForm} />
              ) : null}
            </div>
          </>
        ) : null}

        {error ? <AdminInlineError>{error}</AdminInlineError> : null}
      </AdminEditorCard>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
