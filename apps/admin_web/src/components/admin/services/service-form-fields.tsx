'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel } from '@/lib/format';

import { SERVICE_DELIVERY_MODES, SERVICE_STATUSES } from '@/types/services';
import type { ServiceDeliveryMode, ServiceStatus } from '@/types/services';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface ServiceReferralSlugFieldProps {
  value: string;
  onChange: (next: string) => void;
  slugUsageLoadError?: string;
  slugConflictError?: string;
}

export function ServiceReferralSlugField({
  value,
  onChange,
  slugUsageLoadError,
  slugConflictError,
}: ServiceReferralSlugFieldProps) {
  return (
    <div>
      <Label htmlFor='service-slug'>Referral slug</Label>
      <Input
        id='service-slug'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(value.trim().toLowerCase())}
        placeholder='e.g. my-best-auntie'
        autoComplete='off'
      />
      {value.trim() && !SLUG_PATTERN.test(value.trim()) ? (
        <p className='mt-1 text-xs text-red-600'>
          Use lowercase letters and numbers, with single hyphens between segments (no leading or trailing
          hyphen).
        </p>
      ) : null}
      {slugUsageLoadError ? <p className='mt-1 text-xs text-amber-700'>{slugUsageLoadError}</p> : null}
      {slugConflictError ? <p className='mt-1 text-xs text-red-600'>{slugConflictError}</p> : null}
    </div>
  );
}

export interface ServiceFormState {
  title: string;
  description: string;
  slug: string;
  deliveryMode: ServiceDeliveryMode;
  status: ServiceStatus;
}

export interface ServiceFormFieldsProps {
  value: ServiceFormState;
  onChange: (value: ServiceFormState) => void;
  hideTitle?: boolean;
  slugUsageLoadError?: string;
  slugConflictError?: string;
}

export function ServiceFormFields({
  value,
  onChange,
  hideTitle = false,
  slugUsageLoadError,
  slugConflictError,
}: ServiceFormFieldsProps) {
  return (
    <div className='space-y-3'>
      {!hideTitle ? (
        <div>
          <Label htmlFor='service-title'>Title</Label>
          <Input
            id='service-title'
            value={value.title}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
            placeholder='Service title'
          />
        </div>
      ) : null}
      <div>
        <Label htmlFor='service-description'>Description</Label>
        <Textarea
          id='service-description'
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          rows={3}
          placeholder='Optional description'
        />
      </div>
      <ServiceReferralSlugField
        value={value.slug}
        onChange={(next) => onChange({ ...value, slug: next })}
        slugUsageLoadError={slugUsageLoadError}
        slugConflictError={slugConflictError}
      />
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <div>
          <Label htmlFor='service-delivery-mode'>Delivery mode</Label>
          <Select
            id='service-delivery-mode'
            value={value.deliveryMode}
            onChange={(event) =>
              onChange({ ...value, deliveryMode: event.target.value as ServiceDeliveryMode })
            }
          >
            {SERVICE_DELIVERY_MODES.map((entry) => (
              <option key={entry} value={entry}>
                {formatEnumLabel(entry)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor='service-status'>Status</Label>
          <Select
            id='service-status'
            value={value.status}
            onChange={(event) => onChange({ ...value, status: event.target.value as ServiceStatus })}
          >
            {SERVICE_STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {formatEnumLabel(entry)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
