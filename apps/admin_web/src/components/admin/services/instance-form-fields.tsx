'use client';

import type { ReactNode } from 'react';

import { WarningTriangleIcon } from '@/components/icons/action-icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel, formatServiceTitleWithTier } from '@/lib/format';
import { formatInstanceLocationOptionLabel } from '@/lib/instance-location-options';
import { INSTANCE_SLUG_PATTERN } from '@/lib/slug-utils';

import { INSTANCE_STATUSES, SERVICE_DELIVERY_MODES } from '@/types/services';
import type {
  InstanceStatus,
  LocationSummary,
  PartnerOrgRef,
  ServiceDeliveryMode,
  ServiceSummary,
} from '@/types/services';

import type { SessionSlotFormRow } from '@/types/services';

export { INSTANCE_SLUG_PATTERN } from '@/lib/slug-utils';

export interface InstanceInstructorOption {
  sub: string;
  email: string | null;
  name: string | null;
}

export interface InstanceFormState {
  title: string;
  slug: string;
  description: string;
  status: InstanceStatus;
  deliveryMode: ServiceDeliveryMode | '';
  locationId: string;
  maxCapacity: string;
  waitlistEnabled: boolean;
  instructorId: string;
  cohort: string;
  notes: string;
  externalUrl: string;
  partnerOrganizations: PartnerOrgRef[];
  sessionSlots: SessionSlotFormRow[];
}

export interface InstanceFormFieldsProps {
  value: InstanceFormState;
  serviceId?: string | null;
  /** Service default location; used to show the correct option when the form `locationId` is still empty. */
  serviceLocationId?: string | null;
  serviceOptions?: ServiceSummary[];
  locationOptions?: LocationSummary[];
  isLoadingLocations?: boolean;
  instructorOptions?: InstanceInstructorOption[];
  isLoadingInstructors?: boolean;
  onSelectService?: (serviceId: string | null) => void;
  onChange: (value: InstanceFormState) => void;
  /** When `required`, show a required marker; consultations stay `optional`. */
  slugFieldMode?: 'required' | 'optional';
  /** Inline message under the slug field (for example submit validation or API field errors). */
  slugFieldError?: string;
  /** Optional control rendered under the slug input (for example “Reset to suggestion”). */
  slugFieldAccessory?: ReactNode;
}

function getInstructorOptionLabel(entry: InstanceInstructorOption): string {
  const name = entry.name?.trim();
  if (name) {
    return name;
  }
  const email = entry.email?.trim();
  if (email) {
    return email;
  }
  return entry.sub;
}

export interface InstanceInstructorFieldProps {
  value: string;
  disabled?: boolean;
  className?: string;
  instructorOptions?: InstanceInstructorOption[];
  isLoadingInstructors?: boolean;
  onChange: (instructorId: string) => void;
}

/** Instructor select for instance flows; composed in instance detail Row D. */
export function InstanceInstructorField({
  value,
  disabled = false,
  className,
  instructorOptions = [],
  isLoadingInstructors = false,
  onChange,
}: InstanceInstructorFieldProps) {
  const instructorExists = instructorOptions.some((entry) => entry.sub === value);
  return (
    <div className={className}>
      <Label htmlFor='instance-instructor-id'>Instructor</Label>
      <Select
        id='instance-instructor-id'
        value={value}
        disabled={disabled || isLoadingInstructors}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value=''>{isLoadingInstructors ? 'Loading instructors...' : 'None'}</option>
        {value.trim() && !instructorExists ? <option value={value}>{value}</option> : null}
        {instructorOptions.map((entry) => (
          <option key={entry.sub} value={entry.sub}>
            {getInstructorOptionLabel(entry)}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function InstanceFormFields({
  value,
  serviceId = null,
  serviceLocationId = null,
  serviceOptions = [],
  locationOptions = [],
  isLoadingLocations = false,
  instructorOptions = [],
  isLoadingInstructors = false,
  onSelectService,
  onChange,
  slugFieldMode = 'optional',
  slugFieldError = '',
  slugFieldAccessory = null,
}: InstanceFormFieldsProps) {
  const canSelectService = Boolean(onSelectService);
  const serviceExists = serviceOptions.some((entry) => entry.id === serviceId);
  const effectiveLocationId = value.locationId || (serviceLocationId ?? '');
  const locationExists = locationOptions.some((entry) => entry.id === effectiveLocationId);
  const selectedLocationValue = locationExists ? effectiveLocationId : effectiveLocationId || '';
  const hasLocationOptions = locationOptions.length > 0;
  const instanceFieldsLocked = canSelectService && !serviceId;
  const cohortTrimmed = value.cohort.trim().toLowerCase();
  const cohortInvalid = Boolean(cohortTrimmed) && !INSTANCE_SLUG_PATTERN.test(cohortTrimmed);
  const slugTrimmed = value.slug.trim().toLowerCase();
  const slugPatternInvalid = Boolean(slugTrimmed) && !INSTANCE_SLUG_PATTERN.test(slugTrimmed);

  const topRowClass =
    canSelectService && !instanceFieldsLocked
      ? 'grid grid-cols-1 gap-3 sm:grid-cols-4'
      : canSelectService && instanceFieldsLocked
        ? 'grid grid-cols-1 gap-3 sm:grid-cols-4'
        : 'grid grid-cols-1 gap-3 sm:grid-cols-3';

  return (
    <div className='space-y-3'>
      <div className={topRowClass}>
        {canSelectService ? (
          <div>
            <Label htmlFor='instance-service-id'>Service</Label>
            <Select
              id='instance-service-id'
              value={serviceId && serviceExists ? serviceId : ''}
              onChange={(event) => onSelectService?.(event.target.value || null)}
            >
              <option value=''>Select service</option>
              {serviceId && !serviceExists ? (
                <option value={serviceId}>{serviceId}</option>
              ) : null}
              {serviceOptions.map((service) => (
                <option key={service.id} value={service.id}>
                  {formatServiceTitleWithTier(service.title, service.serviceTier)}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div>
          <Label htmlFor='instance-title'>Title</Label>
          <Input
            id='instance-title'
            value={value.title}
            disabled={instanceFieldsLocked}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
            placeholder='Leave empty to inherit from service'
          />
        </div>
        <div>
          <Label htmlFor='instance-cohort'>Cohort</Label>
          <Input
            id='instance-cohort'
            value={value.cohort}
            disabled={instanceFieldsLocked}
            onChange={(event) => onChange({ ...value, cohort: event.target.value })}
            onBlur={() => onChange({ ...value, cohort: value.cohort.trim().toLowerCase() })}
            placeholder='e.g. spring-2026'
            autoComplete='off'
          />
          {cohortInvalid ? (
            <p className='mt-1 text-xs text-red-600'>
              Use lowercase letters and numbers, with single hyphens between segments (no leading or trailing
              hyphen).
            </p>
          ) : null}
        </div>
        <div>
          <div className='relative mb-1'>
            <Label htmlFor='instance-status' className='mb-0 block pr-7'>
              Status
            </Label>
            {value.status === 'scheduled' ? (
              <span
                className='absolute right-0 top-1/2 inline-flex -translate-y-1/2 text-amber-600'
                role='img'
                aria-label='Scheduled — not yet open for booking'
                title='Scheduled — not yet open for booking'
              >
                <WarningTriangleIcon className='h-4 w-4' aria-hidden />
              </span>
            ) : null}
          </div>
          <Select
            id='instance-status'
            value={value.status}
            disabled={instanceFieldsLocked}
            onChange={(event) => onChange({ ...value, status: event.target.value as InstanceStatus })}
          >
            {INSTANCE_STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {formatEnumLabel(entry)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor='instance-description'>Description</Label>
        <Textarea
          id='instance-description'
          value={value.description}
          disabled={instanceFieldsLocked}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          rows={2}
          placeholder='Leave empty to inherit from service'
        />
      </div>
      <div>
        <Label htmlFor='instance-slug'>
          Slug
          {slugFieldMode === 'required' ? (
            <span className='text-red-600' aria-hidden>
              {' '}
              *
            </span>
          ) : null}
        </Label>
        <Input
          id='instance-slug'
          value={value.slug}
          disabled={instanceFieldsLocked}
          onChange={(event) => onChange({ ...value, slug: event.target.value })}
          onBlur={() => onChange({ ...value, slug: value.slug.trim().toLowerCase() })}
          placeholder='e.g. spring-workshop-2026-04-20'
          autoComplete='off'
        />
        {slugFieldAccessory ? <div className='mt-1'>{slugFieldAccessory}</div> : null}
        {slugPatternInvalid ? (
          <p className='mt-1 text-xs text-red-600'>
            Use lowercase letters, digits, and single hyphens between segments (no leading or trailing hyphen).
          </p>
        ) : null}
        {slugFieldError ? <p className='mt-1 text-xs text-red-600'>{slugFieldError}</p> : null}
      </div>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-4'>
        <div>
          <Label htmlFor='instance-delivery-mode'>Delivery mode</Label>
          <Select
            id='instance-delivery-mode'
            value={value.deliveryMode}
            disabled={instanceFieldsLocked}
            onChange={(event) => onChange({ ...value, deliveryMode: event.target.value as ServiceDeliveryMode | '' })}
          >
            <option value=''>Inherit from service</option>
            {SERVICE_DELIVERY_MODES.map((entry) => (
              <option key={entry} value={entry}>
                {formatEnumLabel(entry)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor='instance-location-id'>Location</Label>
          {hasLocationOptions || isLoadingLocations ? (
            <Select
              id='instance-location-id'
              value={selectedLocationValue}
              disabled={instanceFieldsLocked}
              onChange={(event) => onChange({ ...value, locationId: event.target.value })}
            >
              <option value=''>
                {isLoadingLocations ? 'Loading locations...' : 'Select location'}
              </option>
              {effectiveLocationId && !locationExists ? (
                <option value={effectiveLocationId}>{effectiveLocationId}</option>
              ) : null}
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {formatInstanceLocationOptionLabel(location)}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id='instance-location-id'
              value={effectiveLocationId}
              disabled={instanceFieldsLocked}
              onChange={(event) => onChange({ ...value, locationId: event.target.value })}
              placeholder='Location UUID'
            />
          )}
        </div>
        <div>
          <Label htmlFor='instance-max-capacity'>Max capacity</Label>
          <Input
            id='instance-max-capacity'
            value={value.maxCapacity}
            disabled={instanceFieldsLocked}
            onChange={(event) => onChange({ ...value, maxCapacity: event.target.value })}
            type='number'
            placeholder='Unlimited if empty'
          />
        </div>
        <div>
          <Label htmlFor='instance-waitlist'>Waitlist</Label>
          <Select
            id='instance-waitlist'
            value={value.waitlistEnabled ? 'true' : 'false'}
            disabled={instanceFieldsLocked}
            onChange={(event) =>
              onChange({ ...value, waitlistEnabled: event.target.value === 'true' })
            }
          >
            <option value='false'>Disabled</option>
            <option value='true'>Enabled</option>
          </Select>
        </div>
      </div>
    </div>
  );
}
