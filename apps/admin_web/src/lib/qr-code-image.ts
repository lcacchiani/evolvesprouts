import QRCode from 'qrcode';

export interface GenerateReferralQrPngDataUrlInput {
  url: string;
  size: number;
  /** When omitted or empty, the QR is generated without a centered logo. */
  logoSrc?: string;
}

/**
 * Draw a QR code, optionally with a centered logo overlay (error correction H).
 * Returns a PNG data URL suitable for download.
 */
export async function generateReferralQrPngDataUrl(
  input: GenerateReferralQrPngDataUrlInput,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = input.size;
  canvas.height = input.size;

  await QRCode.toCanvas(canvas, input.url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: input.size,
  });

  const logoSrc = input.logoSrc?.trim() ?? '';
  if (!logoSrc) {
    return canvas.toDataURL('image/png');
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  const logoSize = Math.round(input.size * 0.2);
  const pad = 7;
  const centerX = Math.floor((input.size - logoSize) / 2);
  const centerY = Math.floor((input.size - logoSize) / 2);
  const padX = Math.round(pad);
  const padY = Math.round(pad);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(centerX - padX, centerY - padY, logoSize + padX * 2, logoSize + padY * 2);

  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        ctx.drawImage(image, centerX, centerY, logoSize, logoSize);
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to draw logo'));
      }
    };
    image.onerror = () => {
      reject(new Error('Failed to load logo image'));
    };
    image.src = logoSrc;
  });

  return canvas.toDataURL('image/png');
}
