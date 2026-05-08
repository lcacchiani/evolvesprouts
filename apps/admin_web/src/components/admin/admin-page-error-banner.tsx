'use client';

import { StatusBanner } from '@/components/status-banner';

export interface AdminPageErrorBannerProps {
  title: string;
  message?: string | null;
}

export function AdminPageErrorBanner({ title, message }: AdminPageErrorBannerProps) {
  if (!message?.trim()) {
    return null;
  }
  return (
    <StatusBanner variant='error' title={title}>
      {message}
    </StatusBanner>
  );
}
