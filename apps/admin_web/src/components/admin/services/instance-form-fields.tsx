'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel, formatLocationLabel } from '@/lib/format';

import { INSTANCE_STATUSES, SERVICE_DELIVERY_MODES } from '@/types/services';
import type { InstanceStatus, LocationSummary, ServiceDeliveryMode, ServiceSummary } from '@/types/services';

import { SessionSlotEditor } from './session-slot-editor';

import type { SessionSlot } from '@/types/services';

/** Same pattern as service referral slugs; matches backend `SERVICE_INSTANCE_SLUG_RE`. */
const INSTANCE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
  notes: string;
  sessionSlots: SessionSlot[];
}

export interface InstanceFormFieldsProps {
  value: InstanceFormState;
  serviceId?: string | null;
  serviceOptions?: ServiceSummary[];
  locationOptions?: LocationSummary[];
  isLoadingLocations?: boolean;
  /** When true, omit the instructor field (shown beside training pricing instead). */
  hideInstructorField?: boolean;
  instructorOptions?: InstanceInstructorOption[];
  isLoadingInstructors?: boolean;
  onSelectService?: (serviceId: string | null) => void;
  onChange: (value: InstanceFormState) => void;
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
  instructorOptions?: InstanceInstructorOption[];
  isLoadingInstructors?: boolean;
  onChange: (instructorId: string) => void;
}

/** Instructor select for instance flows; pairs with `TrainingFormFields` `prePricingUnitColumn`. */
export function InstanceInstructorField({
  value,
  disabled = false,
  instructorOptions = [],
  isLoadingInstructors = false,
  onChange,
}: InstanceInstructorFieldProps) {
  const instructorExists = instructorOptions.some((entry) => entry.sub === value);
  return (
    <div>
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
  serviceOptions = [],
  locationOptions = [],
  isLoadingLocations = false,
  hideInstructorField = false,
  instructorOptions = [],
  isLoadingInstructors = false,
  onSelectService,
  onChange,
}: InstanceFormFieldsProps) {
  const canSelectService = Boolean(onSelectService);
  const serviceExists = serviceOptions.some((entry) => entry.id === serviceId);
  const locationExists = locationOptions.some((entry) => entry.id === value.locationId);
  const selectedLocationValue = locationExists ? value.locationId : value.locationId || '';
  const hasLocationOptions = locationOptions.length > 0;
  const instanceFieldsLocked = canSelectService && !serviceId;

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
                  {service.title}
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
          <Label htmlFor='instance-slug'>Referral slug</Label>
          <Input
            id='instance-slug'
            value={value.slug}
            disabled={instanceFieldsLocked}
            onChange={(event) => onChange({ ...value, slug: event.target.value })}
            onBlur={() => onChange({ ...value, slug: value.slug.trim().toLowerCase() })}
            placeholder='e.g. spring-workshop'
            autoComplete='off'
          />
          {value.slug.trim() && !INSTANCE_SLUG_PATTERN.test(value.slug.trim().toLowerCase()) ? (
            <p className='mt-1 text-xs text-red-600'>
              Use lowercase letters and numbers, with single hyphens between segments (no leading or trailing
              hyphen).
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor='instance-status'>Status</Label>
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
                {isLoadingLocations ? 'Loading locations...' : 'Select location (optional)'}
              </option>
              {value.locationId && !locationExists ? (
                <option value={value.locationId}>{value.locationId}</option>
              ) : null}
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {formatLocationLabel(location)}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id='instance-location-id'
              value={value.locationId}
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
          <Label htmlFor='instance-waitlist'>Whitelist</Label>
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
      {!hideInstructorField ? (
        <InstanceInstructorField
          value={value.instructorId}
          disabled={instanceFieldsLocked}
          instructorOptions={instructorOptions}
          isLoadingInstructors={isLoadingInstructors}
          onChange={(instructorId) => onChange({ ...value, instructorId })}
        />
      ) : null}
      <div>
        <Label htmlFor='instance-notes'>Notes</Label>
        <Textarea
          id='instance-notes'
          value={value.notes}
          disabled={instanceFieldsLocked}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          rows={2}
        />
      </div>
      <SessionSlotEditor
        slots={value.sessionSlots}
        disabled={instanceFieldsLocked}
        locationOptions={locationOptions}
        isLoadingLocations={isLoadingLocations}
        onChange={(sessionSlots) => onChange({ ...value, sessionSlots })}
      />
    </div>
  );
}
