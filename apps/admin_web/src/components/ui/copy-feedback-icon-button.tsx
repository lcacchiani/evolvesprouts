'use client';

import type { MouseEvent } from 'react';

import { CheckIcon, CopyIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';

export interface CopyFeedbackIconButtonProps {
  copied: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  idleLabel: string;
  copiedLabel: string;
  idleTitle?: string;
  copiedTitle?: string;
  /** Visual variant when not showing success (default `secondary`). */
  idleVariant?: 'secondary' | 'outline';
  className?: string;
}

/**
 * Icon-only copy control: shows a green check briefly after `copied` is true,
 * then callers clear via {@link useCopyFeedback}.
 */
export function CopyFeedbackIconButton({
  copied,
  disabled,
  onClick,
  idleLabel,
  copiedLabel,
  idleTitle,
  copiedTitle,
  idleVariant = 'secondary',
  className,
}: CopyFeedbackIconButtonProps) {
  return (
    <Button
      type='button'
      size='sm'
      variant={copied ? 'success' : idleVariant}
      disabled={disabled}
      className={
        className
          ? `transition-colors duration-300 ease-out ${className}`
          : 'transition-colors duration-300 ease-out'
      }
      aria-label={copied ? copiedLabel : idleLabel}
      title={copied ? (copiedTitle ?? copiedLabel) : (idleTitle ?? idleLabel)}
      onClick={onClick}
    >
      {copied ? <CheckIcon className='h-4 w-4' /> : <CopyIcon className='h-4 w-4' />}
    </Button>
  );
}
