'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional fields (for example a void reason) rendered between the description and actions. */
  children?: ReactNode;
  /** When true, the confirm action is non-interactive (for example during an in-flight mutation). */
  confirmDisabled?: boolean;
  /** When true, only the cancel/secondary control is shown (use for preview dialogs). */
  hideConfirm?: boolean;
  /** ARIA role for the modal surface; use `dialog` for informational previews. */
  dialogRole?: 'dialog' | 'alertdialog';
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
  hideConfirm = false,
  dialogRole = 'alertdialog',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    focusableElements?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab' || !focusableElements || focusableElements.length === 0) {
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role={dialogRole}
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className='w-full max-w-md'
      >
        <Card className='space-y-4'>
          <div className='space-y-2'>
            <h2 id={titleId} className='text-base font-semibold text-slate-900'>
              {title}
            </h2>
            <p id={descriptionId} className='text-sm text-slate-600'>
              {description}
            </p>
          </div>
          {children}
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant={hideConfirm ? 'primary' : 'secondary'}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
            {hideConfirm ? null : (
              <Button
                type='button'
                variant={variant === 'danger' ? 'danger' : 'primary'}
                disabled={confirmDisabled}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
