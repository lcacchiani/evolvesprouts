import QRCode from 'qrcode';

const FPS_GENERATOR_SCRIPT_SOURCE = '/scripts/fps-generator.js';

const FPS_MERCHANT_NAME = process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME ?? '';
const FPS_MOBILE_NUMBER = process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER ?? '';
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

export function hasFpsQrConfiguration(): boolean {
  return (
    FPS_MERCHANT_NAME.trim().length > 0 && FPS_MOBILE_NUMBER.trim().length > 0
  );
}

/**
 * Same FPS payload + PNG data URL as the booking modal QR (for email attachment fields).
 */
export async function generateFpsQrImageDataUrl(
  amount: number,
): Promise<string | null> {
  if (typeof window === 'undefined' || !hasFpsQrConfiguration()) {
    return null;
  }

  // jsdom (Vitest) does not complete network loads for injected <script src>;
  // the load promise would hang forever and block booking submit.
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  try {
    await loadExternalScript(FPS_GENERATOR_SCRIPT_SOURCE);
    const Fps = window.FPS;
    if (!Fps) {
      return null;
    }

    const fpsPayloadGenerator = new Fps();
    fpsPayloadGenerator.merchantName = FPS_MERCHANT_NAME;
    fpsPayloadGenerator.setMobile(FPS_MOBILE_NUMBER);
    fpsPayloadGenerator.setAmount(String(amount));
    fpsPayloadGenerator.setDynamic();

    const payloadResult = fpsPayloadGenerator.generate();
    if (payloadResult.isError() || !payloadResult.data) {
      return null;
    }

    return await QRCode.toDataURL(payloadResult.data, {
      width: FPS_QR_CODE_SIZE_PX,
      margin: 0,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch {
    return null;
  }
}
