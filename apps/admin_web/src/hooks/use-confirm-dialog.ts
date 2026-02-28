'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConfirmDialogProps } from '@/components/ui/confirm-dialog';

type ConfirmDialogVariant = NonNullable<ConfirmDialogProps['variant']>;

export interface ConfirmDialogRequest {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
}

const NOOP = () => {};

export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const closeDialog = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
      }
      resolverRef.current = null;
    };
  }, []);

  const requestConfirm = useCallback((nextRequest: ConfirmDialogRequest) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setRequest(nextRequest);
    });
  }, []);

  const dialogProps: ConfirmDialogProps = request
    ? {
        open: true,
        title: request.title,
        description: request.description,
        confirmLabel: request.confirmLabel ?? 'Confirm',
        cancelLabel: request.cancelLabel ?? 'Cancel',
        variant: request.variant ?? 'default',
        onConfirm: () => closeDialog(true),
        onCancel: () => closeDialog(false),
      }
    : {
        open: false,
        title: '',
        description: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        variant: 'default',
        onConfirm: NOOP,
        onCancel: NOOP,
      };

  return [dialogProps, requestConfirm] as const;
}
