import type { MediaKind } from '@tripvault/shared';

/** SHA-256 of a blob as lowercase hex (used for duplicate detection). */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Read natural pixel dimensions of an image file. */
export function getImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image dimensions'));
    };
    img.src = url;
  });
}

export interface VideoMetadata {
  width: number;
  height: number;
  /** Seconds, rounded to 2 decimals. */
  duration: number;
}

/** Read pixel dimensions + duration of a video file (metadata only, no playback). */
export function getVideoMetadata(file: Blob): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => {
      const meta = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Math.round(video.duration * 100) / 100,
      };
      cleanup();
      resolve(meta);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read video metadata'));
    };
    video.src = url;
  });
}

function drawToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxDim: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, width, height };
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode JPEG'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Downscale an image to fit within `maxDim` and re-encode as JPEG.
 * Used for "Compressed" uploads.
 */
export async function compressImage(
  file: Blob,
  maxDim = 1920,
  quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number }> {
  const dims = await getImageDimensions(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read image'));
      el.src = url;
    });
    const { canvas, width, height } = drawToCanvas(img, dims.width, dims.height, maxDim);
    const blob = await canvasToJpegBlob(canvas, quality);
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Build a small JPEG thumbnail for an upload.
 * - Images: 320px canvas JPEG.
 * - Videos: capture a frame at ~1s via a <video> element.
 * Returns `null` on failure (uploads proceed without a thumbnail).
 */
export async function makeThumbnail(file: Blob, kind: MediaKind): Promise<Blob | null> {
  try {
    if (kind === 'image') {
      const dims = await getImageDimensions(file);
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Could not read image'));
          el.src = url;
        });
        const { canvas } = drawToCanvas(img, dims.width, dims.height, 320);
        return await canvasToJpegBlob(canvas, 0.75);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    // Video: seek to ~1s and capture the frame.
    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'auto';
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Video thumbnail timed out')), 8000);
        video.onloadeddata = () => {
          window.clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error('Could not load video'));
        };
        video.src = url;
      });
      const target = Math.min(1, (Number.isFinite(video.duration) ? video.duration : 1) / 2);
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Video seek timed out')), 8000);
        video.onseeked = () => {
          window.clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error('Could not seek video'));
        };
        video.currentTime = target;
      });
      if (!video.videoWidth || !video.videoHeight) throw new Error('No video dimensions');
      const { canvas } = drawToCanvas(video, video.videoWidth, video.videoHeight, 320);
      return await canvasToJpegBlob(canvas, 0.75);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

/**
 * PUT a blob to a presigned URL with progress callbacks.
 * Uses XMLHttpRequest because fetch has no upload-progress API.
 */
export function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(1, event.loaded / event.total));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (status ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.send(blob);
  });
}
