import { afterEach, describe, expect, it, vi } from 'vitest';

const toCanvasMock = vi.fn(async (canvas: HTMLCanvasElement) => {
  void canvas;
});

vi.mock('qrcode', async () => {
  const actual = await vi.importActual<typeof import('qrcode')>('qrcode');
  return {
    default: {
      ...actual.default,
      toCanvas: (...args: unknown[]) => toCanvasMock(...args),
    },
  };
});

describe('generateReferralQrPngDataUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws QR first, white pad, then logo when branding is off', async () => {
    const drawImageSpy = vi.fn();
    const fillRectSpy = vi.fn();
    const toDataURLSpy = vi.fn().mockReturnValue('data:image/png;base64,AA');

    const originalCreateElement = Document.prototype.createElement.bind(document);
    const createElementSpy = vi.spyOn(Document.prototype, 'createElement').mockImplementation(
      function patchedCreateElement(this: Document, tagName: string, options?: unknown) {
        if (tagName !== 'canvas') {
          return originalCreateElement(tagName, options as never);
        }
        const canvas = originalCreateElement('canvas', options as never);
        canvas.getContext = vi.fn(() => {
          return {
            fillStyle: '',
            fillRect: fillRectSpy,
            drawImage: drawImageSpy,
          } as unknown as CanvasRenderingContext2D;
        });
        canvas.toDataURL = toDataURLSpy;
        return canvas;
      },
    );

    const OriginalImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
      crossOrigin = '';
      naturalWidth = 10;
      naturalHeight = 10;
      width = 10;
      height = 10;
      constructor() {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }
    // @ts-expect-error test shim
    globalThis.Image = MockImage;

    const { generateReferralQrPngDataUrl } = await import('@/lib/qr-code-image');

    await generateReferralQrPngDataUrl({
      url: 'https://example.com',
      size: 200,
      logoSrc: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
      applyBranding: false,
    });

    expect(toCanvasMock).toHaveBeenCalled();
    expect(fillRectSpy).toHaveBeenCalled();
    const fillArgs = fillRectSpy.mock.calls[0] as [number, number, number, number];
    for (const n of fillArgs) {
      expect(Number.isInteger(n)).toBe(true);
    }
    expect(drawImageSpy).toHaveBeenCalled();
    const drawArgs = drawImageSpy.mock.calls[0] as [unknown, number, number, number, number];
    for (const n of drawArgs.slice(1)) {
      expect(Number.isInteger(n)).toBe(true);
    }
    expect(toDataURLSpy).toHaveBeenCalledWith('image/png');

    createElementSpy.mockRestore();
    globalThis.Image = OriginalImage;
  });

  it('skips logo pad and drawImage when logoSrc is omitted', async () => {
    const drawImageSpy = vi.fn();
    const fillRectSpy = vi.fn();
    const toDataURLSpy = vi.fn().mockReturnValue('data:image/png;base64,BB');

    const originalCreateElement = Document.prototype.createElement.bind(document);
    const createElementSpy = vi.spyOn(Document.prototype, 'createElement').mockImplementation(
      function patchedCreateElement(this: Document, tagName: string, options?: unknown) {
        if (tagName !== 'canvas') {
          return originalCreateElement(tagName, options as never);
        }
        const canvas = originalCreateElement('canvas', options as never);
        canvas.getContext = vi.fn(() => {
          return {
            fillStyle: '',
            fillRect: fillRectSpy,
            drawImage: drawImageSpy,
          } as unknown as CanvasRenderingContext2D;
        });
        canvas.toDataURL = toDataURLSpy;
        return canvas;
      },
    );

    const { generateReferralQrPngDataUrl } = await import('@/lib/qr-code-image');

    await generateReferralQrPngDataUrl({
      url: 'https://example.com',
      size: 200,
      applyBranding: false,
    });

    expect(toCanvasMock).toHaveBeenCalled();
    expect(fillRectSpy).not.toHaveBeenCalled();
    expect(drawImageSpy).not.toHaveBeenCalled();
    expect(toDataURLSpy).toHaveBeenCalledWith('image/png');

    createElementSpy.mockRestore();
  });

  it('uses branded renderer without calling toCanvas when applyBranding is true', async () => {
    toCanvasMock.mockClear();
    const drawImageSpy = vi.fn();
    const fillRectSpy = vi.fn();
    const toDataURLSpy = vi.fn().mockReturnValue('data:image/png;base64,CC');

    const originalCreateElement = Document.prototype.createElement.bind(document);
    const createElementSpy = vi.spyOn(Document.prototype, 'createElement').mockImplementation(
      function patchedCreateElement(this: Document, tagName: string, options?: unknown) {
        if (tagName !== 'canvas') {
          return originalCreateElement(tagName, options as never);
        }
        const canvas = originalCreateElement('canvas', options as never);
        canvas.getContext = vi.fn(() => {
          return {
            fillStyle: '',
            fillRect: fillRectSpy,
            drawImage: drawImageSpy,
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            arcTo: vi.fn(),
            closePath: vi.fn(),
            fill: vi.fn(),
          } as unknown as CanvasRenderingContext2D;
        });
        canvas.toDataURL = toDataURLSpy;
        return canvas;
      },
    );

    const { generateReferralQrPngDataUrl } = await import('@/lib/qr-code-image');

    await generateReferralQrPngDataUrl({
      url: 'https://example.com',
      size: 200,
    });

    expect(toCanvasMock).not.toHaveBeenCalled();
    expect(fillRectSpy).toHaveBeenCalled();
    expect(drawImageSpy).not.toHaveBeenCalled();
    expect(toDataURLSpy).toHaveBeenCalledWith('image/png');

    createElementSpy.mockRestore();
  });
});
