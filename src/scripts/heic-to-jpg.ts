/**
 * Client-Side HEIC to JPG Conversion Engine
 *
 * 100% in-browser processing via heic2any.
 * No data is ever transmitted to any remote server or API.
 */

export interface ConvertedResult {
  id: string;
  blob: Blob;
  objectUrl: string;
  filename: string;
  originalSize: number;
  convertedSize: number;
}

export interface QueueItem {
  id: string;
  file: File;
  status: 'ready' | 'converting' | 'completed' | 'failed';
  error?: string;
  results: ConvertedResult[];
}

export interface BatchProgress {
  currentIndex: number;
  totalCount: number;
  currentFilename: string;
  isSingle: boolean;
  percentage: number;
}

/**
 * Format bytes into human readable string (KB, MB, etc.)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format file size comparison accurately without misleading "saved" labels
 */
export function formatSizeDifference(original: number, converted: number): string {
  const origStr = formatBytes(original);
  const convStr = formatBytes(converted);
  if (original === 0) return `${origStr} → ${convStr}`;

  const diffPercent = Math.round(((converted - original) / original) * 100);
  if (diffPercent > 0) {
    return `${origStr} → ${convStr} (+${diffPercent}% size)`;
  } else if (diffPercent < 0) {
    return `${origStr} → ${convStr} (${diffPercent}% size)`;
  }
  return `${origStr} → ${convStr} (same size)`;
}

/**
 * Generate clean JPG output filenames from source HEIC filename.
 * Handles casing (.HEIC, .heif) safely and guarantees .jpg extension.
 */
export function generateJpgFilename(originalName: string, subIndex: number = 0, totalBlobs: number = 1): string {
  // Strip trailing .heic or .heif (case-insensitive)
  let base = originalName.replace(/\.(heic|heif)$/i, '');
  if (!base) base = 'image';

  if (totalBlobs > 1) {
    return `${base}-${subIndex + 1}.jpg`;
  }
  return `${base}.jpg`;
}

/**
 * Check if a file is a HEIC/HEIF image by extension or MIME type
 */
export function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  return (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    type === 'image/heic' ||
    type === 'image/heif'
  );
}

/**
 * Convert a single HEIC File into one or more JPG Blobs using lazy-loaded heic2any.
 */
export async function convertHeicFile(
  file: File,
  quality: number = 0.9
): Promise<{ blobs: Blob[]; filenames: string[] }> {
  // Lazily import heic2any only when conversion is executed
  const heic2anyModule = await import('heic2any');
  const heic2any = (heic2anyModule.default || heic2anyModule) as (options: {
    blob: Blob;
    toType: string;
    quality: number;
  }) => Promise<Blob | Blob[]>;

  const conversionResult = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: Math.min(Math.max(quality, 0.5), 1.0),
  });

  const blobs = Array.isArray(conversionResult) ? conversionResult : [conversionResult];
  const filenames = blobs.map((_, idx) => generateJpgFilename(file.name, idx, blobs.length));

  return { blobs, filenames };
}

/**
 * Trigger browser download for a Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
 * Package multiple Blobs into a ZIP file using lazy-loaded JSZip and trigger download
 */
export async function downloadAllAsZip(
  results: { filename: string; blob: Blob }[],
  zipFilename: string = 'converted-jpg-images.zip'
): Promise<void> {
  const jszipModule = await import('jszip');
  const JSZip = (jszipModule.default || jszipModule) as any;
  const zip = new JSZip();

  const usedNames = new Set<string>();

  for (const item of results) {
    let name = item.filename;
    let counter = 2;
    while (usedNames.has(name)) {
      const parts = item.filename.split('.');
      const ext = parts.pop() || 'jpg';
      const base = parts.join('.');
      name = `${base}-${counter}.${ext}`;
      counter++;
    }
    usedNames.add(name);
    zip.file(name, item.blob);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  downloadBlob(zipBlob, zipFilename);
}
