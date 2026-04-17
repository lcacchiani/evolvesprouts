import QRCode from 'qrcode';

export interface GenerateReferralQrPngDataUrlInput {
  url: string;
  size: number;
  logoSrc: string;
}

/**
 * Draw a QR code with centered logo overlay (error correction H).
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

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  const logoSize = Math.round(input.size * 0.2);
  const pad = 7;
  const centerX = (input.size - logoSize) / 2;
  const centerY = (input.size - logoSize) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(centerX - pad, centerY - pad, logoSize + pad * 2, logoSize + pad * 2);

  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
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
    image.src = input.logoSrc;
  });

  return canvas.toDataURL('image/png');
}
