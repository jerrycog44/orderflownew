/**
 * Client-side Proof-of-Delivery (POD) photo validation and compression utilities.
 *
 * Ensures captured/uploaded handover photos satisfy the backend `pod_photo_url`
 * constraint (<= 2 MB data URL in JPEG, PNG, or WebP format) before submission.
 */

export const MAX_POD_PHOTO_BYTES = 2 * 1024 * 1024;
export const TARGET_POD_PHOTO_BYTES = 1_500_000;
export const POD_DATA_URL_REGEX =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i;

const MAX_DIMENSION_PX = 1440;
const JPEG_QUALITIES = [0.82, 0.65, 0.48];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read the selected photo file.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the selected photo file.'));
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Unsupported or corrupted image file. Please choose a JPEG, PNG, or WebP photo.'));
    img.src = dataUrl;
  });
}

async function compressDataUrlToJpeg(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('Photo exceeds the 2 MB limit. Please select a smaller JPEG, PNG, or WebP image.');
  }

  const img = await loadImage(dataUrl);
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  if (!srcWidth || !srcHeight) {
    throw new Error('Unable to process the selected photo. Please try another image.');
  }

  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(srcWidth, srcHeight));
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to compress photo in this browser. Please choose a smaller image (< 2 MB).');
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  for (const quality of JPEG_QUALITIES) {
    const candidate = canvas.toDataURL('image/jpeg', quality);
    if (POD_DATA_URL_REGEX.test(candidate) && candidate.length <= MAX_POD_PHOTO_BYTES) {
      return candidate;
    }
  }

  throw new Error('Photo is still larger than 2 MB after compression. Please capture a closer or lower-resolution photo.');
}

/**
 * Validates and, if needed, compresses a user-selected POD handover image file
 * into a compliant JPEG/PNG/WebP base64 data URL under 2 MB.
 */
export async function preparePodPhotoDataUrl(file: File): Promise<string> {
  const mime = (file.type || '').toLowerCase();
  if (mime && (!mime.startsWith('image/') || mime === 'image/svg+xml')) {
    throw new Error('Please upload a valid image file (JPEG, PNG, or WebP).');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  if (POD_DATA_URL_REGEX.test(rawDataUrl) && rawDataUrl.length <= TARGET_POD_PHOTO_BYTES) {
    return rawDataUrl;
  }

  return compressDataUrlToJpeg(rawDataUrl);
}
