'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel } from '@/lib/format';

import { INSTANCE_STATUSES, SERVICE_DELIVERY_MODES } from '@/types/services';
import type { InstanceStatus, LocationSummary, ServiceDeliveryMode, ServiceSummary } from '@/types/services';

import { SessionSlotEditor } from './session-slot-editor';

import type { SessionSlot } from '@/types/services';

export interface InstanceFormState {
  title: string;
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
  onSelectService?: (serviceId: string | null) => void;
  onChange: (value: InstanceFormState) => void;
}

function getLocationLabel(location: LocationSummary): string {
  return location.address?.trim() ? location.address : location.id;
}

export function InstanceFormFields({
  value,
  serviceId = null,
  serviceOptions = [],
  locationOptions = [],
  isLoadingLocations = false,
  onSelectService,
  onChange,
}: InstanceFormFieldsProps) {
  const canSelectService = Boolean(onSelectService);
  const serviceExists = serviceOptions.some((entry) => entry.id === serviceId);
  const locationExists = locationOptions.some((entry) => entry.id === value.locationId);
  const selectedLocationValue = locationExists ? value.locationId : value.locationId || '';
  const hasLocationOptions = locationOptions.length > 0;

  return (
    <div className='space-y-3'>
      <div className={`grid grid-cols-1 gap-3 ${canSelectService ? 'sm:grid-cols-2' : ''}`}>
        <div>
          <Label htmlFor='instance-title'>Title override</Label>
          <Input
            id='instance-title'
            value={value.title}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
            placeholder='Leave empty to inherit'
          />
        </div>
        {canSelectService ? (
          <div>
            <Label htmlFor='instance-service-id'>Service</Label>
            <Select
              id='instance-service-id'
              value={serviceId && serviceExists ? serviceId : ''}
              onChange={(event) => onSelectService(event.target.value || null)}
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
      </div>
      <div className='grid grid-cols-1 gap-3'>
        <div>
          <Label htmlFor='instance-status'>Status</Label>
          <Select
            id='instance-status'
            value={value.status}
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
        <Label htmlFor='instance-description'>Description override</Label>
        <Textarea
          id='instance-description'
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          rows={2}
          placeholder='Leave empty to inherit'
        />
      </div>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <div>
          <Label htmlFor='instance-delivery-mode'>Delivery mode override</Label>
          <Select
            id='instance-delivery-mode'
            value={value.deliveryMode}
            onChange={(event) => onChange({ ...value, deliveryMode: event.target.value as ServiceDeliveryMode | '' })}
          >
            <option value=''>Inherit</option>
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
                  {getLocationLabel(location)}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id='instance-location-id'
              value={value.locationId}
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
            onChange={(event) => onChange({ ...value, maxCapacity: event.target.value })}
            type='number'
            placeholder='Unlimited if empty'
          />
        </div>
      </div>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <div>
          <Label htmlFor='instance-instructor-id'>Instructor user sub</Label>
          <Input
            id='instance-instructor-id'
            value={value.instructorId}
            onChange={(event) => onChange({ ...value, instructorId: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor='instance-waitlist'>Waitlist enabled</Label>
          <Select
            id='instance-waitlist'
            value={value.waitlistEnabled ? 'true' : 'false'}
            onChange={(event) =>
              onChange({ ...value, waitlistEnabled: event.target.value === 'true' })
            }
          >
            <option value='false'>Disabled</option>
            <option value='true'>Enabled</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor='instance-notes'>Notes</Label>
        <Textarea
          id='instance-notes'
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          rows={2}
        />
      </div>
      <SessionSlotEditor
        slots={value.sessionSlots}
        onChange={(sessionSlots) => onChange({ ...value, sessionSlots })}
      />
    </div>
  );
}
