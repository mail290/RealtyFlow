// =====================================================================
// Photo capture helper — compress BEFORE storing in IndexedDB.
// =====================================================================
// Compressing before storage (not before upload) keeps the device quota
// from filling up during an offline round. JPEG (not WebP) because
// @react-pdf/renderer in Phase 3 can't embed WebP. Target 300–450 kB per
// image, ~5 MB per inspection.
// =====================================================================

import imageCompression from 'browser-image-compression';

export interface CompressedPhoto {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
}

const OPTIONS = {
  maxWidthOrHeight: 1600,
  initialQuality: 0.8,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  // library normalises EXIF orientation when it redraws to canvas, so an
  // iPhone portrait shot won't end up sideways in the report.
};

export async function compressPhoto(file: File | Blob): Promise<CompressedPhoto> {
  const input = file instanceof File ? file : new File([file], 'photo.jpg', { type: 'image/jpeg' });
  const blob = await imageCompression(input, OPTIONS);
  const { width, height } = await readDimensions(blob);
  return { blob, width, height, bytes: blob.size };
}

function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Storage path: kh/{org}/{property}/{inspection}/{photo}.jpg */
export function photoStoragePath(
  orgId: string,
  propertyId: string,
  inspectionId: string,
  photoId: string,
): string {
  return `kh/${orgId}/${propertyId}/${inspectionId}/${photoId}.jpg`;
}
