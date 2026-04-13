import type { ReactNode } from 'react';

import { LoadingGearIcon } from '@/components/shared/loading-gear-icon';

export function submitButtonClassName(isSubmitting: boolean, extra?: string): string {
  const base = isSubmitting
    ? 'inline-flex w-full items-center justify-center gap-2'
    : 'w-full';
  return extra ? `${extra} ${base}` : base;
}

interface SubmitButtonLoadingContentProps {
  isSubmitting: boolean;
  submittingLabel: string;
  idleLabel: ReactNode;
  loadingGearTestId?: string;
}

/**
 * Submit button body: visible idle label, or spinning gear with screen-reader
 * status text while a request is in flight (matches Contact Us behavior).
 */
export function SubmitButtonLoadingContent({
  isSubmitting,
  submittingLabel,
  idleLabel,
  loadingGearTestId,
}: SubmitButtonLoadingContentProps) {
  if (isSubmitting) {
    return (
      <>
        <span className='sr-only'>{submittingLabel}</span>
        <span
          className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border es-border-soft es-loading-gear-bubble'
          aria-hidden='true'
        >
          <LoadingGearIcon
            className='h-5 w-5 animate-spin'
            testId={loadingGearTestId}
          />
        </span>
      </>
    );
  }

  return idleLabel;
}
