'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { SERVICE_STATUSES } from '@/types/services';
import type { ServiceDetail, ServiceStatus } from '@/types/services';

export interface ServiceDetailPanelProps {
  service: ServiceDetail | null;
  isLoading: boolean;
  error: string;
  onUpdate: (payload: { title?: string; description?: string; status?: ServiceStatus }) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onUploadCover: (fileName: string, contentType: string) => Promise<void> | void;
}

export function ServiceDetailPanel({
  service,
  isLoading,
  error,
  onUpdate,
  onDelete,
  onUploadCover,
}: ServiceDetailPanelProps) {
  const [title, setTitle] = useState(service?.title ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [status, setStatus] = useState<ServiceStatus>(service?.status ?? 'draft');
  const [coverFileName, setCoverFileName] = useState('cover-image.jpg');

  if (!service) {
    return (
      <Card title='Service detail'>
        <p className='text-sm text-slate-500'>Select a service to view details.</p>
      </Card>
    );
  }

  return (
    <Card title='Service detail'>
      <div className='space-y-3'>
        <div>
          <Label htmlFor='service-detail-title'>Title</Label>
          <Input
            id='service-detail-title'
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor='service-detail-description'>Description</Label>
          <Textarea
            id='service-detail-description'
            value={description}
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div>
            <Label htmlFor='service-detail-status'>Status</Label>
            <Select
              id='service-detail-status'
              value={status}
              onChange={(event) => setStatus(event.target.value as ServiceStatus)}
            >
              {SERVICE_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='service-detail-cover-file-name'>Cover image file name</Label>
            <Input
              id='service-detail-cover-file-name'
              value={coverFileName}
              onChange={(event) => setCoverFileName(event.target.value)}
            />
          </div>
        </div>
        {error ? <p className='text-sm text-red-600'>{error}</p> : null}
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='secondary'
            disabled={isLoading}
            onClick={() => void onUpdate({ title, description, status })}
          >
            Save
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={isLoading || !coverFileName.trim()}
            onClick={() => void onUploadCover(coverFileName.trim(), 'image/jpeg')}
          >
            Generate cover upload URL
          </Button>
          <Button type='button' variant='danger' disabled={isLoading} onClick={() => void onDelete()}>
            Delete service
          </Button>
        </div>
      </div>
    </Card>
  );
}
