'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel } from '@/lib/format';

import { SERVICE_DELIVERY_MODES, SERVICE_STATUSES } from '@/types/services';
import type { ServiceDeliveryMode, ServiceStatus } from '@/types/services';

export interface ServiceFormState {
  title: string;
  description: string;
  deliveryMode: ServiceDeliveryMode;
  status: ServiceStatus;
}

export interface ServiceFormFieldsProps {
  value: ServiceFormState;
  onChange: (value: ServiceFormState) => void;
  hideTitle?: boolean;
}

export function ServiceFormFields({ value, onChange, hideTitle = false }: ServiceFormFieldsProps) {
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
