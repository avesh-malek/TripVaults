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

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  /** MIME type of `blob` — 'image/jpeg' when re-encoded, else the source type. */
  mimeType: string;
}

/** Load an image for canvas drawing, honoring EXIF orientation when possible. */
async function loadDrawable(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall through to the <img> path */
    }
  }
  const dims = await getImageDimensions(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read image'));
      el.src = url;
    });
    return { source: img, width: dims.width, height: dims.height, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * Build the upload payload for "Compressed" mode.
 *
 * - Downscales so the longest side fits within `maxDim` (aspect preserved).
 * - Re-encodes to JPEG at `quality`.
 * - Skips re-encoding entirely when it wouldn't help: images already within
 *   `maxDim` that are already JPEG are returned untouched, and if the JPEG
 *   re-encode isn't meaningfully smaller than the source the original bytes
 *   are kept (avoids making small PNGs/WebPs worse).
 * - Returns the actual blob + dimensions + MIME so the upload reservation
 *   metadata always matches the bytes being sent.
 */
export async function compressImage(
  file: Blob,
  fileType: string,
  opts?: { maxDim?: number; quality?: number },
): Promise<CompressedImage> {
  const { maxDim = 2048, quality = 0.85 } = opts ?? {};
  const drawable = await loadDrawable(file);
  try {
    const { width: naturalWidth, height: naturalHeight } = drawable;
    const longest = Math.max(naturalWidth, naturalHeight);
    const needsDownscale = longest > maxDim;

    // Already small and already JPEG — re-encoding only adds artifacts.
    if (!needsDownscale && fileType === 'image/jpeg') {
      return { blob: file, width: naturalWidth, height: naturalHeight, mimeType: fileType };
    }

    const scale = Math.min(1, maxDim / longest);
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported in this browser');
    ctx.drawImage(drawable.source, 0, 0, width, height);
    const jpeg = await canvasToJpegBlob(canvas, quality);

    // Don't "compress" into something barely smaller (or larger) than the source.
    if (jpeg.size >= file.size * 0.95) {
      return { blob: file, width: naturalWidth, height: naturalHeight, mimeType: fileType };
    }
    return { blob: jpeg, width, height, mimeType: 'image/jpeg' };
  } finally {
    drawable.close();
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
