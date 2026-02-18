'use client';

import Image from 'next/image';
import { ButtonPrimitive } from '@/components/button-primitive';
import { CloseIcon } from '@/components/sections/navbar-icons';
import QRCode from 'qrcode';
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

export const MODAL_PANEL_BACKGROUND =
  'var(--es-color-surface-white, #FFFFFF)';
const MODAL_OVERLAY_BACKGROUND = 'rgba(16, 14, 11, 0.6)';
const FPS_GENERATOR_SCRIPT_SOURCE = '/scripts/fps-generator.js';
const FPS_LOGO_SOURCE = '/images/fps-logo.svg';
const FPS_MERCHANT_NAME = 'Ida De Gregorio';
const FPS_MOBILE_NUMBER = '85297942094';
const FPS_QR_CODE_SIZE_PX = 128;

interface FpsGenerationResult {
  data?: string;
  isError: () => boolean;
}

interface FpsInstance {
  merchantName: string;
  setMobile: (value: string | number) => void;
  setAmount: (value: string | number) => void;
  setDynamic: () => void;
  generate: () => FpsGenerationResult;
}

interface FpsConstructor {
  new (): FpsInstance;
}

declare global {
  interface Window {
    FPS?: FpsConstructor;
  }
}

const externalScriptLoadMap = new Map<string, Promise<void>>();

function isExternalScriptLoaded(source: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (source === FPS_GENERATOR_SCRIPT_SOURCE) {
    return typeof window.FPS === 'function';
  }

  return false;
}

function loadExternalScript(source: string): Promise<void> {
  if (typeof window === 'undefined' || isExternalScriptLoaded(source)) {
    return Promise.resolve();
  }

  const cachedPromise = externalScriptLoadMap.get(source);
  if (cachedPromise) {
    return cachedPromise;
  }

  const existingScript = document.querySelector(
    `script[src="${source}"]`,
  ) as HTMLScriptElement | null;

  const loadingPromise = new Promise<void>((resolve, reject) => {
    if (isExternalScriptLoaded(source)) {
      resolve();
      return;
    }

    const handleLoad = () => {
      resolve();
    };
    const handleError = () => {
      reject(new Error(`Failed to load script: ${source}`));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = source;
    script.async = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);
  });

  externalScriptLoadMap.set(source, loadingPromise);
  return loadingPromise;
}

export function ModalOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className='fixed inset-0 z-[80] overflow-y-auto'>
      <ButtonPrimitive
        variant='icon'
        aria-label='Close modal'
        className='absolute inset-0 border-0'
        style={{ backgroundColor: MODAL_OVERLAY_BACKGROUND }}
        onClick={onClose}
      />
      <div className='relative z-10 flex min-h-full items-start justify-center px-4 pb-4 pt-6 sm:px-6 sm:pt-8'>
        {children}
      </div>
    </div>
  );
}

export function CloseButton({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  return (
    <ButtonPrimitive
      variant='icon'
      aria-label={label}
      onClick={onClose}
      className='es-btn--icon-surface h-10 w-10 rounded-full'
    >
      <CloseIcon />
    </ButtonPrimitive>
  );
}

export function FpsQrCode({ amount }: { amount: number }) {
  const [qrCodeImageDataUrl, setQrCodeImageDataUrl] = useState('');
  const qrCodeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void loadExternalScript(FPS_GENERATOR_SCRIPT_SOURCE)
      .then(async () => {
        const Fps = window.FPS;
        if (!Fps) {
          return;
        }

        const fpsPayloadGenerator = new Fps();
        fpsPayloadGenerator.merchantName = FPS_MERCHANT_NAME;
        fpsPayloadGenerator.setMobile(FPS_MOBILE_NUMBER);
        fpsPayloadGenerator.setAmount(String(amount));
        fpsPayloadGenerator.setDynamic();

        const payloadResult = fpsPayloadGenerator.generate();
        if (payloadResult.isError() || !payloadResult.data || isCancelled) {
          return;
        }

        const imageDataUrl = await QRCode.toDataURL(payloadResult.data, {
          width: FPS_QR_CODE_SIZE_PX,
          margin: 0,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        if (!isCancelled) {
          setQrCodeImageDataUrl(imageDataUrl);
        }
      })
      .catch(() => {
        // The QR container remains blank when the payload cannot be generated.
      });

    return () => {
      isCancelled = true;
    };
  }, [amount]);

  return (
    <div
      ref={qrCodeContainerRef}
      className='flex w-full items-center justify-between gap-4 rounded-[14px] border es-border-input bg-white p-3 text-center'
    >
      <Image
        src={FPS_LOGO_SOURCE}
        alt='FPS'
        width={92}
        height={86}
        className='h-auto w-[92px] shrink-0'
      />
      <div
        aria-label='FPS payment QR code'
        className='flex h-[128px] w-[128px] shrink-0 items-center justify-center rounded-[8px] border es-border-divider bg-white'
      >
        {qrCodeImageDataUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qrCodeImageDataUrl}
            alt='FPS payment QR code'
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
