import { describe, it, expect, vi, afterEach } from 'vitest';
import { preparePodPhotoDataUrl, TARGET_POD_PHOTO_BYTES } from '../podPhoto';

describe('preparePodPhotoDataUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects non-image or SVG files before reading', async () => {
    const pdfFile = new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' });
    await expect(preparePodPhotoDataUrl(pdfFile)).rejects.toThrow(/valid image file/i);

    const svgFile = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' });
    await expect(preparePodPhotoDataUrl(svgFile)).rejects.toThrow(/valid image file/i);
  });

  it('returns compliant small JPEG/PNG/WebP data URLs unchanged', async () => {
    const expected = 'data:image/jpeg;base64,smallValidPayload';
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = expected;
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const file = new File(['abc'], 'handover.jpg', { type: 'image/jpeg' });
    await expect(preparePodPhotoDataUrl(file)).resolves.toBe(expected);
  });

  it('compresses oversized raster images via canvas to JPEG under 2 MB', async () => {
    const oversizedPayload = `data:image/jpeg;base64,${'A'.repeat(TARGET_POD_PHOTO_BYTES + 100)}`;
    const compressedPayload = 'data:image/jpeg;base64,compressedOkPayload';

    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = oversizedPayload;
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    class MockImage {
      naturalWidth = 3000;
      naturalHeight = 2000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', MockImage);

    const drawImage = vi.fn();
    const toDataURL = vi.fn().mockReturnValue(compressedPayload);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toDataURL,
        } as unknown as HTMLCanvasElement;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    }) as typeof document.createElement);

    const file = new File(['big'], 'camera.jpg', { type: 'image/jpeg' });
    const result = await preparePodPhotoDataUrl(file);

    expect(result).toBe(compressedPayload);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.82);
    createElementSpy.mockRestore();
  });
});
