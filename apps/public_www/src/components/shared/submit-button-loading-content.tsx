import type { ReactNode } from 'react';

import { LoadingGearIcon } from '@/components/shared/loading-gear-icon';

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
        <LoadingGearIcon
          className='h-5 w-5 animate-spin'
          testId={loadingGearTestId}
        />
      </>
    );
  }

  return idleLabel;
}
