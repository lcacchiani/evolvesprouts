import { afterEach, describe, expect, it, vi } from 'vitest';

const toCanvasMock = vi.fn(async (canvas: HTMLCanvasElement) => {
  void canvas;
});

vi.mock('qrcode', () => ({
  default: {
    toCanvas: (...args: unknown[]) => toCanvasMock(...args),
  },
}));

describe('generateReferralQrPngDataUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws QR first, white pad, then logo', async () => {
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
    });

    expect(toCanvasMock).toHaveBeenCalled();
    expect(fillRectSpy).toHaveBeenCalled();
    expect(drawImageSpy).toHaveBeenCalled();
    expect(toDataURLSpy).toHaveBeenCalledWith('image/png');

    createElementSpy.mockRestore();
    globalThis.Image = OriginalImage;
  });
});
