'use client';

import { useEffect, useMemo, useState } from 'react';

import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Button } from '@/components/ui/button';
import { AdminInlineError } from '@/components/ui/admin-inline-error';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatEnumLabel } from '@/lib/format';
import { getServiceDiscountCodeUsageSummary } from '@/lib/services-api';

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

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface ServiceDetailPanelProps {
  service: ServiceDetail | null;
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
  const [discountUsageSummary, setDiscountUsageSummary] = useState<{
    totalCurrentUses: number;
    referencingCodeCount: number;
  } | null>(null);
  const [discountUsageLoadState, setDiscountUsageLoadState] = useState<DiscountUsageLoadState>('idle');

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
      if (!service) {
        setServiceType('training_course');
        setServiceForm(DEFAULT_SERVICE_FORM);
        setTrainingForm(DEFAULT_TRAINING_FORM);
        setEventForm(DEFAULT_EVENT_FORM);
        setConsultationForm(DEFAULT_CONSULTATION_FORM);
        return;
      }
      setServiceType(service.serviceType);
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
      });
      setConsultationForm({
        consultationFormat: service.consultationDetails?.consultationFormat ?? 'one_on_one',
        maxGroupSize: service.consultationDetails?.maxGroupSize?.toString() ?? '',
        durationMinutes: service.consultationDetails?.durationMinutes?.toString() ?? '60',
        pricingModel: service.consultationDetails?.pricingModel ?? 'free',
        defaultHourlyRate: service.consultationDetails?.defaultHourlyRate ?? '',
        defaultPackagePrice: service.consultationDetails?.defaultPackagePrice ?? '',
        defaultPackageSessions: service.consultationDetails?.defaultPackageSessions?.toString() ?? '',
        defaultCurrency: service.consultationDetails?.defaultCurrency ?? 'HKD',
        calendlyUrl: service.consultationDetails?.calendlyUrl ?? '',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [service]);

  const slugPayloadValue = useMemo(() => {
    const t = serviceForm.slug.trim().toLowerCase();
    return t.length ? t : null;
  }, [serviceForm.slug]);

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
    await onUpdate({
      title: serviceForm.title.trim(),
      description: serviceForm.description.trim() || null,
      slug: newSlug,
      delivery_mode: serviceForm.deliveryMode,
      status: serviceForm.status,
      ...buildTypeSpecificPayload(service.serviceType),
    });
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
                  !serviceForm.title.trim() ||
                  Boolean(serviceForm.slug.trim() && !SLUG_PATTERN.test(serviceForm.slug.trim().toLowerCase()))
                }
                onClick={() =>
                  void onCreate({
                    service_type: serviceType,
                    title: serviceForm.title.trim(),
                    description: serviceForm.description.trim() || null,
                    slug: slugPayloadValue,
                    delivery_mode: serviceForm.deliveryMode,
                    status: serviceForm.status,
                    ...buildTypeSpecificPayload(serviceType),
                  })
                }
              >
                {isLoading ? 'Adding...' : 'Add service'}
              </Button>
            )}
          </>
        }
      >
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div>
            <Label htmlFor='service-type'>Service type</Label>
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
              placeholder='Service title'
            />
          </div>
        </div>

        <ServiceFormFields
          value={serviceForm}
          onChange={setServiceForm}
          hideTitle
          slugUsageLoadError={
            discountUsageLoadState === 'error'
              ? 'Could not load discount code usage. Try again later.'
              : undefined
          }
        />

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

        {error ? <AdminInlineError>{error}</AdminInlineError> : null}
      </AdminEditorCard>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
