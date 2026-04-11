'use client';

import type { ReactNode } from 'react';

import { StatusBanner } from '@/components/status-banner';

import { Button } from './button';
import { Card } from './card';

export interface FormDialogProps {
  open: boolean;
  title: string;
  isLoading: boolean;
  error: string;
  submitLabel: string;
  submitDisabled?: boolean;
  maxWidth?: string;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
  children: ReactNode;
}

export function FormDialog({
  open,
  title,
  isLoading,
  error,
  submitLabel,
  submitDisabled = false,
  maxWidth = 'max-w-2xl',
  onClose,
  onSubmit,
  children,
}: FormDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`w-full ${maxWidth}`}>
        <Card title={title} className='space-y-4'>
          {children}
          {error ? (
            <StatusBanner variant='error' title={title}>
              {error}
            </StatusBanner>
          ) : null}
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='button'
              disabled={isLoading || submitDisabled}
              onClick={() => void onSubmit()}
            >
              {isLoading ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
