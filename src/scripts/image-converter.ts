/**
 * Image Format Converter Engine
 * 100% Client-side format conversion between JPG, PNG, and WebP using Canvas API & createImageBitmap.
 */

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ConverterConfig {
  outputFormat: ImageFormat;
  quality: number; // 0.10 to 1.00 (default 0.90 for JPG/WebP)
}

export interface ImageConverterItem {
  id: string;
  file: File;
  filename: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  originalMime: string;
  thumbnailUrl: string;
  status: 'ready' | 'converting' | 'completed' | 'failed';
  errorMessage?: string;

  // Result fields
  resultBlob?: Blob;
  resultUrl?: string;
  resultWidth?: number;
  resultHeight?: number;
  resultSizeBytes?: number;
  resultFilename?: string;
  resultMime?: string;
  isLarger?: boolean;
  sizeDiffBytes?: number;
  sizePercentDiff?: number;
}

/**
 * Format bytes into human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Unique ID generator
 */
export function generateItemId(): string {
  return 'conv_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Determine MIME type from file extension or file.type
 */
export function getMimeType(file: { type?: string; name: string }): string {
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
 * Label for format
 */
export function getFormatLabel(mime: string): string {
  if (mime === 'image/jpeg') return 'JPG';
  if (mime === 'image/png') return 'PNG';
  if (mime === 'image/webp') return 'WebP';
  return 'Image';
}

/**
 * Generate output filename by swapping extension and resolving name collisions.
 * Examples:
 * photo.jpg -> photo.png
 * my photo.png -> my photo.webp
 * photo.final.webp -> photo.final.jpg
 * duplicate photo.png -> photo-2.png
 */
export function generateConvertedFilename(
  originalFilename: string,
  outputMime: string,
  existingNames: Set<string> = new Set()
): string {
  const targetExt = getExtensionForMime(outputMime);
  // Strip last extension only
  const base = originalFilename.replace(/\.(jpg|jpeg|png|webp)$/i, '') || 'image';

  let candidate = `${base}.${targetExt}`;
  let counter = 2;

  while (existingNames.has(candidate.toLowerCase())) {
    candidate = `${base}-${counter}.${targetExt}`;
    counter++;
  }

  existingNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Inspect image file to extract natural dimensions and thumbnail
 */
export async function inspectConverterFile(file: File): Promise<{
  width: number;
  height: number;
  mime: string;
  thumbnailUrl: string;
}> {
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

  const mime = getMimeType(file);

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
        mime,
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
 * Convert an individual image item
 */
export async function convertImageItem(
  item: ImageConverterItem,
  config: ConverterConfig,
  existingNames: Set<string> = new Set()
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  filename: string;
  mimeType: string;
  isLarger: boolean;
  sizeDiffBytes: number;
  sizePercentDiff: number;
}> {
  const targetWidth = item.originalWidth;
  const targetHeight = item.originalHeight;
  const outputMime = config.outputFormat;

  // Decode bitmap
  let sourceBitmap: ImageBitmap | HTMLImageElement;
  if (typeof createImageBitmap === 'function') {
    try {
      sourceBitmap = await createImageBitmap(item.file);
    } catch {
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

  // Transparency handling:
  // If output is JPEG, composite transparent alpha onto solid white (#FFFFFF)
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
      const quality = Math.max(0.1, Math.min(1.0, config.quality || 0.9));
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

  // Free canvas buffers
  canvas.width = 0;
  canvas.height = 0;

  const outFilename = generateConvertedFilename(item.filename, outputMime, existingNames);
  const isLarger = blob.size > item.originalSizeBytes;
  const sizeDiffBytes = Math.abs(blob.size - item.originalSizeBytes);
  const sizePercentDiff =
    item.originalSizeBytes > 0
      ? Math.round((sizeDiffBytes / item.originalSizeBytes) * 100)
      : 0;

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    filename: outFilename,
    mimeType: outputMime,
    isLarger,
    sizeDiffBytes,
    sizePercentDiff,
  };
}

/**
 * Trigger immediate browser download of a blob
 */
export function downloadConvertedBlob(blob: Blob, filename: string): void {
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
 * Package multiple converted items into a ZIP archive using lazy-loaded JSZip
 */
export async function createConvertedZip(items: ImageConverterItem[]): Promise<Blob> {
  const successfulItems = items.filter((item) => item.status === 'completed' && item.resultBlob);
  if (successfulItems.length === 0) {
    throw new Error('No successfully converted images to package.');
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
