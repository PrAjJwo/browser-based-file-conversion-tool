/**
 * Social Image Resizer Engine
 * 100% Client-side image cropping and resizing using Canvas API & createImageBitmap.
 */

export type ResizeMode = 'crop' | 'fit';

export type FocalPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type SocialExportFormat = 'original' | 'image/jpeg' | 'image/png' | 'image/webp';

export interface SocialTarget {
  id: string;
  label: string;
  width: number;
  height: number;
  ratio: string;
  platform?: string;
  isCustom?: boolean;
}

export interface SocialResizerConfig {
  mode: ResizeMode;
  focalPosition: FocalPosition;
  outputFormat: SocialExportFormat;
  quality: number; // 0.50 to 1.00 (default 0.90)
  backgroundColor?: string; // default '#FFFFFF' or 'transparent'
}

export interface SocialJobResult {
  id: string;
  presetId: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  ratio: string;
  filename: string;
  blob: Blob;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface SourceImageInfo {
  file: File;
  filename: string;
  width: number;
  height: number;
  sizeBytes: number;
  mime: string;
  thumbnailUrl: string;
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
  return 'soc_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
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
 * Inspect source image file to extract dimensions and thumbnail
 */
export async function inspectSocialSourceFile(file: File): Promise<SourceImageInfo> {
  const lowerName = file.name.toLowerCase();
  const isImage =
    file.type.startsWith('image/') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp');

  if (!isImage || file.size === 0) {
    throw new Error(`Unsupported or empty image file: "${file.name}". Expected JPG, PNG, or WebP.`);
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
        reject(new Error(`Invalid image dimensions for "${file.name}".`));
        return;
      }
      resolve({
        file,
        filename: file.name,
        width,
        height,
        sizeBytes: file.size,
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
 * Calculate Crop to Fill source rectangle coordinates based on focal position
 */
export function calculateCropRect(
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number,
  focalPosition: FocalPosition = 'center'
): { sx: number; sy: number; sWidth: number; sHeight: number } {
  const scale = Math.max(targetW / sourceW, targetH / sourceH);
  const sWidth = targetW / scale;
  const sHeight = targetH / scale;

  const excessX = Math.max(0, sourceW - sWidth);
  const excessY = Math.max(0, sourceH - sHeight);

  let sx = 0;
  let sy = 0;

  // Horizontal alignment
  if (
    focalPosition === 'left' ||
    focalPosition === 'top-left' ||
    focalPosition === 'bottom-left'
  ) {
    sx = 0;
  } else if (
    focalPosition === 'right' ||
    focalPosition === 'top-right' ||
    focalPosition === 'bottom-right'
  ) {
    sx = excessX;
  } else {
    // center
    sx = excessX / 2;
  }

  // Vertical alignment
  if (
    focalPosition === 'top' ||
    focalPosition === 'top-left' ||
    focalPosition === 'top-right'
  ) {
    sy = 0;
  } else if (
    focalPosition === 'bottom' ||
    focalPosition === 'bottom-left' ||
    focalPosition === 'bottom-right'
  ) {
    sy = excessY;
  } else {
    // center
    sy = excessY / 2;
  }

  return { sx, sy, sWidth, sHeight };
}

/**
 * Calculate Fit Entire Image destination rectangle (letterboxing / pillarboxing)
 */
export function calculateFitRect(
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number
): { dx: number; dy: number; dWidth: number; dHeight: number } {
  const scale = Math.min(targetW / sourceW, targetH / sourceH);
  const dWidth = Math.round(sourceW * scale);
  const dHeight = Math.round(sourceH * scale);
  const dx = Math.round((targetW - dWidth) / 2);
  const dy = Math.round((targetH - dHeight) / 2);

  return { dx, dy, dWidth, dHeight };
}

/**
 * Generate meaningful output filename
 * Examples:
 * photo.jpg + instagram-square -> photo-instagram-square.jpg
 * photo.jpg + custom 1080x1350 -> photo-1080x1350.jpg
 */
export function generateSocialFilename(
  originalFilename: string,
  target: SocialTarget,
  outputMime: string,
  existingNames: Set<string> = new Set()
): string {
  const ext = getExtensionForMime(outputMime);
  const base = originalFilename.replace(/\.(jpg|jpeg|png|webp)$/i, '') || 'image';

  let suffix = '';
  if (target.isCustom) {
    suffix = `${target.width}x${target.height}`;
  } else if (target.id) {
    suffix = target.id;
  } else {
    suffix = `${target.width}x${target.height}`;
  }

  let candidate = `${base}-${suffix}.${ext}`;
  let count = 2;

  while (existingNames.has(candidate.toLowerCase())) {
    candidate = `${base}-${suffix}-${count}.${ext}`;
    count++;
  }

  existingNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Render social resize job to canvas and export Blob
 */
export async function renderSocialImage(
  source: SourceImageInfo,
  target: SocialTarget,
  config: SocialResizerConfig,
  existingNames: Set<string> = new Set()
): Promise<SocialJobResult> {
  const targetW = Math.max(1, Math.round(target.width));
  const targetH = Math.max(1, Math.round(target.height));

  let outputMime = config.outputFormat;
  if (outputMime === 'original') {
    outputMime = source.mime as SocialExportFormat;
  }

  // Decode bitmap
  let sourceBitmap: ImageBitmap | HTMLImageElement;
  if (typeof createImageBitmap === 'function') {
    try {
      sourceBitmap = await createImageBitmap(source.file);
    } catch {
      sourceBitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Bitmap decoding failed.'));
        img.src = source.thumbnailUrl;
      });
    }
  } else {
    sourceBitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bitmap decoding failed.'));
      img.src = source.thumbnailUrl;
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    if ('close' in sourceBitmap) (sourceBitmap as ImageBitmap).close();
    throw new Error('Could not create 2D canvas context.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background
  const isJpg = outputMime === 'image/jpeg';
  const bgColor = config.backgroundColor || '#FFFFFF';

  if (isJpg || (config.mode === 'fit' && bgColor !== 'transparent')) {
    ctx.fillStyle = isJpg ? '#FFFFFF' : bgColor;
    ctx.fillRect(0, 0, targetW, targetH);
  }

  // Draw image
  if (config.mode === 'crop') {
    const { sx, sy, sWidth, sHeight } = calculateCropRect(
      source.width,
      source.height,
      targetW,
      targetH,
      config.focalPosition
    );

    // If output is JPEG and source has alpha, fill white first
    if (isJpg) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.drawImage(sourceBitmap, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);
  } else {
    // Fit Entire Image (Letterbox / Pillarbox)
    const { dx, dy, dWidth, dHeight } = calculateFitRect(
      source.width,
      source.height,
      targetW,
      targetH
    );

    ctx.drawImage(sourceBitmap, 0, 0, source.width, source.height, dx, dy, dWidth, dHeight);
  }

  if ('close' in sourceBitmap) {
    (sourceBitmap as ImageBitmap).close();
  }

  // Encode to Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    if (outputMime === 'image/png') {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas PNG export failed.'));
      }, 'image/png');
    } else {
      const q = Math.max(0.5, Math.min(1.0, config.quality || 0.9));
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Canvas ${outputMime} export failed.`));
        },
        outputMime,
        q
      );
    }
  });

  // Free canvas buffers
  canvas.width = 0;
  canvas.height = 0;

  const filename = generateSocialFilename(source.filename, target, outputMime, existingNames);
  const url = URL.createObjectURL(blob);

  return {
    id: generateItemId(),
    presetId: target.id,
    label: target.label,
    platform: target.platform || 'Custom',
    width: targetW,
    height: targetH,
    ratio: target.ratio,
    filename,
    blob,
    url,
    sizeBytes: blob.size,
    mimeType: outputMime,
  };
}

/**
 * Trigger immediate browser download of a blob
 */
export function downloadSocialBlob(blob: Blob, filename: string): void {
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
 * Package multiple social variant results into a ZIP archive using lazy-loaded JSZip
 */
export async function createSocialZip(results: SocialJobResult[]): Promise<Blob> {
  if (results.length === 0) {
    throw new Error('No images to package into ZIP.');
  }

  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;
  const zip = new JSZip();

  const usedNames = new Set<string>();

  for (const item of results) {
    let name = item.filename;
    let count = 2;
    const ext = name.split('.').pop() || 'jpg';
    const base = name.replace(/\.[^.]+$/, '');

    while (usedNames.has(name.toLowerCase())) {
      name = `${base}-${count}.${ext}`;
      count++;
    }
    usedNames.add(name.toLowerCase());
    zip.file(name, item.blob);
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
