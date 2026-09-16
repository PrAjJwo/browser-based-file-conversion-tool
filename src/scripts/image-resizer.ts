/**
 * Client-Side Image Resizer Engine
 *
 * Provides high-quality HTML5 Canvas scaling, aspect-ratio calculations,
 * percentage scaling, format conversion (JPG, PNG, WebP), alpha compositing,
 * and lazy-loaded ZIP batch export.
 *
 * 100% in-browser processing with zero remote network requests.
 */

export type ResizeMode = 'dimensions' | 'percentage';
export type OutputFormat = 'original' | 'image/jpeg' | 'image/png' | 'image/webp';

export interface ResizeConfig {
  mode: ResizeMode;
  targetWidth?: number;
  targetHeight?: number;
  lockAspectRatio: boolean;
  percentage: number; // 1 to 500
  outputFormat: OutputFormat;
  quality: number; // 0.5 to 1.0
}

export interface ImageResizerItem {
  id: string;
  file: File;
  filename: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  aspectRatio: number;
  thumbnailUrl: string;
  status: 'ready' | 'resizing' | 'completed' | 'failed';
  errorMessage?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  resultWidth?: number;
  resultHeight?: number;
  resultSizeBytes?: number;
  resultFilename?: string;
  resultMime?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate unique item ID
 */
export function generateItemId(): string {
  return 'resize_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Determine MIME type from file extension or file.type
 */
export function getMimeType(file: File): string {
  if (file.type && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
    return file.type.toLowerCase();
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Extension corresponding to MIME type
 */
export function getExtensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Generate output filename avoiding double extensions (e.g. photo.jpg -> photo-resized.jpg)
 */
export function generateResizedFilename(
  originalFilename: string,
  outputMime: string,
  existingNames: Set<string> = new Set()
): string {
  const targetExt = getExtensionForMime(outputMime);
  // Strip trailing extension
  const base = originalFilename.replace(/\.(jpg|jpeg|png|webp)$/i, '') || 'image';

  let candidate = `${base}-resized.${targetExt}`;
  let counter = 2;

  while (existingNames.has(candidate.toLowerCase())) {
    candidate = `${base}-resized-${counter}.${targetExt}`;
    counter++;
  }

  existingNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Inspect image to get original dimensions and thumbnail
 */
export async function inspectImageFile(file: File): Promise<{
  width: number;
  height: number;
  thumbnailUrl: string;
}> {
  // Validate supported type
  const lowerName = file.name.toLowerCase();
  const isImage =
    file.type.startsWith('image/') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp');

  if (!isImage) {
    throw new Error(`Unsupported file type: "${file.name}". Expected JPG, PNG, or WebP.`);
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Invalid image dimensions: ${width}x${height}`));
        return;
      }
      resolve({
        width,
        height,
        thumbnailUrl: objectUrl,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode "${file.name}". The image file may be corrupted.`));
    };

    img.src = objectUrl;
  });
}

/**
 * Calculate target dimensions based on config and source dimensions
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  config: ResizeConfig
): { width: number; height: number } {
  if (config.mode === 'percentage') {
    const factor = Math.max(1, Math.min(500, config.percentage || 100)) / 100;
    return {
      width: Math.max(1, Math.round(origWidth * factor)),
      height: Math.max(1, Math.round(origHeight * factor)),
    };
  }

  // Dimensions mode
  const targetW = config.targetWidth;
  const targetH = config.targetHeight;
  const aspectRatio = origWidth / origHeight;

  if (config.lockAspectRatio) {
    if (targetW && !targetH) {
      return {
        width: Math.max(1, Math.round(targetW)),
        height: Math.max(1, Math.round(targetW / aspectRatio)),
      };
    }
    if (!targetW && targetH) {
      return {
        width: Math.max(1, Math.round(targetH * aspectRatio)),
        height: Math.max(1, Math.round(targetH)),
      };
    }
    if (targetW && targetH) {
      // If both provided, fit within bounds while preserving aspect ratio
      return {
        width: Math.max(1, Math.round(targetW)),
        height: Math.max(1, Math.round(targetW / aspectRatio)),
      };
    }
    return { width: origWidth, height: origHeight };
  }

  // Unlocked aspect ratio
  return {
    width: Math.max(1, Math.round(targetW || origWidth)),
    height: Math.max(1, Math.round(targetH || origHeight)),
  };
}

/**
 * Execute client-side resize using HTML5 Canvas
 */
export async function resizeImageItem(
  item: ImageResizerItem,
  config: ResizeConfig,
  existingNames: Set<string> = new Set()
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  filename: string;
  mimeType: string;
}> {
  const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
    item.originalWidth,
    item.originalHeight,
    config
  );

  // Determine output MIME
  let outputMime = config.outputFormat;
  if (outputMime === 'original') {
    outputMime = getMimeType(item.file) as OutputFormat;
  }

  // Decode bitmap
  let sourceBitmap: ImageBitmap | HTMLImageElement;
  if (typeof createImageBitmap === 'function') {
    try {
      sourceBitmap = await createImageBitmap(item.file);
    } catch {
      // Fallback to Image element
      sourceBitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Bitmap decoding failed.'));
        img.src = item.thumbnailUrl;
      });
    }
  } else {
    sourceBitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bitmap decoding failed.'));
      img.src = item.thumbnailUrl;
    });
  }

  // Render to canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    if ('close' in sourceBitmap) (sourceBitmap as ImageBitmap).close();
    throw new Error('Could not create 2D canvas context.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // If output is JPEG, composite transparent pixels over a solid white background
  if (outputMime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.drawImage(sourceBitmap, 0, 0, targetWidth, targetHeight);

  if ('close' in sourceBitmap) {
    (sourceBitmap as ImageBitmap).close();
  }

  // Encode to Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    if (outputMime === 'image/png') {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas PNG encoding failed.'));
      }, 'image/png');
    } else {
      const quality = Math.max(0.5, Math.min(1.0, config.quality || 0.9));
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Canvas ${outputMime} encoding failed.`));
        },
        outputMime,
        quality
      );
    }
  });

  // Free canvas references
  canvas.width = 0;
  canvas.height = 0;

  const outFilename = generateResizedFilename(item.filename, outputMime, existingNames);

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    filename: outFilename,
    mimeType: outputMime,
  };
}

/**
 * Trigger immediate browser download of a blob
 */
export function downloadResizedBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Package multiple resized items into a ZIP archive using lazy-loaded JSZip
 */
export async function createResizedZip(items: ImageResizerItem[]): Promise<Blob> {
  const successfulItems = items.filter((item) => item.status === 'completed' && item.resultBlob);
  if (successfulItems.length === 0) {
    throw new Error('No successfully resized images to package.');
  }

  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;
  const zip = new JSZip();

  const usedNames = new Set<string>();

  for (const item of successfulItems) {
    if (!item.resultBlob) continue;
    let name = item.resultFilename || item.filename;
    let count = 2;
    const ext = name.split('.').pop() || 'jpg';
    const base = name.replace(/\.[^.]+$/, '');

    while (usedNames.has(name.toLowerCase())) {
      name = `${base}-${count}.${ext}`;
      count++;
    }
    usedNames.add(name.toLowerCase());
    zip.file(name, item.resultBlob);
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
