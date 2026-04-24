'use client';

import type { MouseEvent, ReactNode } from 'react';

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
  /** Replaces the copy icon while idle (success still shows a check). */
  idleIcon?: ReactNode;
  className?: string;
}

/**
 * Icon-only control: shows a green check briefly after `copied` is true,
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
  idleIcon,
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
      {copied ? <CheckIcon className='h-4 w-4' /> : (idleIcon ?? <CopyIcon className='h-4 w-4' />)}
    </Button>
  );
}
