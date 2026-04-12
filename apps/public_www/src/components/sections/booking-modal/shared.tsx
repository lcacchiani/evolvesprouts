'use client';

import Image from 'next/image';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { OverlayBackdrop } from '@/components/shared/overlay-surface';
import {
  generateFpsQrImageDataUrl,
  hasFpsQrConfiguration,
} from '@/lib/fps-qr-code';
import {
  type Ref,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import enContent from '@/content/en.json';

const CLOSE_ICON_SOURCE = '/images/close.svg';

export function ModalOverlay({
  onClose,
  overlayAriaLabel = enContent.bookingModal.paymentModal.closeOverlayLabel,
  children,
}: {
  onClose: () => void;
  overlayAriaLabel?: string;
  children: ReactNode;
}) {
  const overlayContent = (
    <div className='fixed inset-0 z-[80] overflow-y-auto'>
      <OverlayBackdrop
        ariaLabel={overlayAriaLabel}
        className='es-booking-modal-overlay border-0'
        onClick={onClose}
      />
      <div className='relative z-10 flex min-h-full items-start justify-center px-4 pb-4 pt-6 sm:px-6 sm:pt-8'>
        {children}
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(overlayContent, document.body);
}

export function CloseButton({
  label,
  onClose,
  buttonRef,
}: {
  label: string;
  onClose: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <ButtonPrimitive
      variant='icon'
      buttonRef={buttonRef}
      aria-label={label}
      onClick={onClose}
      className='es-btn--icon-surface h-10 w-10 rounded-full'
    >
      <Image
        src={CLOSE_ICON_SOURCE}
        alt=''
        aria-hidden='true'
        width={18}
        height={18}
        className='h-[18px] w-[18px]'
      />
    </ButtonPrimitive>
  );
}

export function FpsQrCode({
  amount,
  label = enContent.bookingModal.paymentModal.fpsQrCodeLabel,
}: {
  amount: number;
  label?: string;
}) {
  const [qrCodeImageDataUrl, setQrCodeImageDataUrl] = useState('');
  const qrCodeContainerRef = useRef<HTMLDivElement | null>(null);
  const hasFpsConfiguration = hasFpsQrConfiguration();

  useEffect(() => {
    if (!hasFpsConfiguration) {
      return;
    }

    let isCancelled = false;

    void generateFpsQrImageDataUrl(amount).then((imageDataUrl) => {
      if (!isCancelled && imageDataUrl) {
        setQrCodeImageDataUrl(imageDataUrl);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [amount, hasFpsConfiguration]);

  if (!hasFpsConfiguration) {
    return null;
  }

  return (
    <div
      ref={qrCodeContainerRef}
      className='flex shrink-0 items-center justify-center text-center'
    >
      <div
        aria-label={label}
        className='flex h-[128px] w-[128px] shrink-0 items-center justify-center'
      >
        {qrCodeImageDataUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qrCodeImageDataUrl}
            alt={label}
            className='h-[128px] w-[128px]'
          />
        )}
      </div>
    </div>
  );
}

export function DiscountBadge({ label }: { label: string }) {
  return (
    <p className='rounded-lg es-bg-surface-success-pale px-3 py-2 text-sm es-text-success'>
      {label}
    </p>
  );
}
