'use client';

import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

export interface AdminEditorCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Primary and secondary actions, left-aligned (Cancel before Save when editing). */
  actions?: ReactNode;
}

export function AdminEditorCard({ title, description, children, actions }: AdminEditorCardProps) {
  return (
    <Card title={title} description={description} className='space-y-4'>
      {children}
      {actions ? <div className='flex flex-wrap justify-start gap-2'>{actions}</div> : null}
    </Card>
  );
}
