export interface QueueItem {
  id: string;
  file: File;
  status: 'ready' | 'converting' | 'completed' | 'failed';
  width?: number;
  height?: number;
  errorMessage?: string;
}

export interface ConvertedResult {
  id: string;
  sourceFileName: string;
  sourceSize: number;
  heicFileName: string;
  heicSize: number;
  width: number;
  height: number;
  blob: Blob;
  objectUrl: string;
}

let heicModule: any = null;
let encoderInitPromise: Promise<void> | null = null;

/**
 * Lazy loads the in-browser HEIC WebAssembly encoder and self-hosted wasm binary.
 * The instance is cached in memory for all subsequent conversions in the session.
 */
export async function getHeicEncoder(): Promise<any> {
  if (heicModule) {
    return heicModule;
  }

  if (encoderInitPromise) {
    await encoderInitPromise;
    return heicModule;
  }

  encoderInitPromise = (async () => {
    const icodec = await import('@pbk20191/icodec');
    const heic = icodec.heic;
    await heic.loadEncoder('/heic/heic-enc.wasm');
    heicModule = heic;
  })();

  await encoderInitPromise;
  return heicModule;
}

/**
 * Extracts RGBA pixel buffer and dimensions from a JPG/JPEG file using the native browser engine.
 */
export async function extractImageData(file: File): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  bitmap.close();
  return { data: imageData.data, width, height };
}

/**
 * Converts a single JPG File to a genuine HEIC Blob using client-side WebAssembly.
 */
export async function convertJpgFile(
  file: File,
  quality: number = 85,
  onProgress?: (status: string) => void
): Promise<{ blob: Blob; width: number; height: number }> {
  onProgress?.('Initializing HEIC WebAssembly encoder…');
  const encoder = await getHeicEncoder();

  onProgress?.('Decoding image pixels…');
  const { data, width, height } = await extractImageData(file);

  onProgress?.('Encoding to high-efficiency HEIC…');
  const clampedQuality = Math.max(10, Math.min(100, Math.round(quality)));
  const encodedBytes = encoder.encode(
    { data, width, height },
    {
      quality: clampedQuality,
      preset: 'fast',
      tune: 'ssim',
    }
  );

  onProgress?.('Finalizing HEIC output…');
  const blob = new Blob([encodedBytes], { type: 'image/heic' });
  return { blob, width, height };
}

/**
 * Formats byte counts into human-readable strings (KB, MB).
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Computes difference and percentage between original and converted file sizes.
 */
export function formatSizeDifference(
  original: number,
  converted: number
): { text: string; isSmaller: boolean } {
  const diff = converted - original;
  const pct = Math.abs(Math.round((diff / original) * 100));

  if (diff < 0) {
    return { text: `${pct}% smaller`, isSmaller: true };
  } else if (diff > 0) {
    return { text: `+${pct}% size`, isSmaller: false };
  } else {
    return { text: 'same size', isSmaller: true };
  }
}

/**
 * Triggers a browser file download using a programmatic anchor.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Bundles multiple converted HEIC files into a single ZIP archive using JSZip (lazy loaded).
 */
export async function downloadAllAsZip(results: ConvertedResult[]): Promise<void> {
  if (results.length === 0) return;

  const JSZipModule = await import('jszip');
  const JSZip = (JSZipModule.default || JSZipModule) as any;
  const zip = new JSZip();

  const nameCounts: Record<string, number> = {};

  results.forEach((res) => {
    let filename = res.heicFileName;
    if (nameCounts[filename]) {
      nameCounts[filename]++;
      const dotIndex = filename.lastIndexOf('.');
      const base = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
      const ext = dotIndex !== -1 ? filename.slice(dotIndex) : '';
      filename = `${base}-${nameCounts[filename]}${ext}`;
    } else {
      nameCounts[filename] = 1;
    }

    zip.file(filename, res.blob);
  });

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  downloadBlob(zipBlob, 'converted-heic-images.zip');
}
