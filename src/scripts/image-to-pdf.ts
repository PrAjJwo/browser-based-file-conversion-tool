/**
 * Client-Side Image to PDF Conversion Engine
 *
 * 100% in-browser processing via jsPDF and HTML5 Canvas.
 * No data is ever transmitted to any remote server or API.
 */

export type PageSizeOption = 'a4' | 'letter' | 'legal' | 'fit';
export type OrientationOption = 'auto' | 'portrait' | 'landscape';
export type MarginOption = 'none' | 'small' | 'medium' | 'large';

export interface ImageToPdfItem {
  id: string;
  file: File;
  name: string;
  size: number;
  width: number;
  height: number;
  thumbnailUrl: string;
  error?: string;
}

export interface PdfConfig {
  pageSize: PageSizeOption;
  orientation: OrientationOption;
  margin: MarginOption;
  customFilename?: string;
}

export interface PdfGenerationResult {
  blob: Blob;
  objectUrl: string;
  filename: string;
  pageCount: number;
  fileSizeBytes: number;
}

/**
 * Standard paper dimensions in Points (pt, 72 pt per inch)
 */
const PAGE_DIMENSIONS_PT: Record<'a4' | 'letter' | 'legal', { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612.0, height: 792.0 },
  legal: { width: 612.0, height: 1008.0 },
};

/**
 * Margin values in Points (pt)
 */
const MARGIN_VALUES_PT: Record<MarginOption, number> = {
  none: 0,
  small: 20, // ~7.0 mm
  medium: 40, // ~14.1 mm
  large: 60, // ~21.2 mm
};

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
 * Sanitize and enforce safe PDF output filename
 */
export function sanitizePdfFilename(input?: string): string {
  if (!input || !input.trim()) {
    return 'images-to-pdf.pdf';
  }
  let clean = input.trim().replace(/[/\\?%*:|"<>]/g, '_');
  if (!clean.toLowerCase().endsWith('.pdf')) {
    clean += '.pdf';
  }
  return clean;
}

/**
 * Check if a file is an accepted image format (JPG, PNG, WebP)
 */
export function isValidImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
  const hasValidExt = validExts.some((ext) => name.endsWith(ext));

  const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
  const hasValidMime = validMimes.includes(type);

  return hasValidExt || hasValidMime;
}

/**
 * Inspect image file, validate dimensions, and generate lightweight thumbnail
 */
export async function inspectImageFile(file: File): Promise<{ width: number; height: number; thumbnailUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (!width || !height) {
        URL.revokeObjectURL(url);
        return reject(new Error('Invalid image dimensions.'));
      }

      // Generate lightweight thumbnail (max 140px on longest side)
      const maxThumb = 140;
      const scale = Math.min(maxThumb / width, maxThumb / height, 1);
      const thumbW = Math.max(1, Math.round(width * scale));
      const thumbH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = thumbW;
      canvas.height = thumbH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Canvas context not available.'));
      }

      // Draw white background for transparent PNG/WebP safety
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, thumbW, thumbH);
      ctx.drawImage(img, 0, 0, thumbW, thumbH);

      const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(url);

      resolve({ width, height, thumbnailUrl });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image data. File may be corrupted or unsupported.'));
    };

    img.src = url;
  });
}

/**
 * Prepare image data for jsPDF: render onto canvas with white background to handle transparency safely
 */
async function prepareImageBitmap(
  file: File
): Promise<{ dataUrl: string; width: number; height: number; format: 'JPEG' }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Canvas context unavailable.'));
      }

      // Fill background pure white to prevent dark transparent edges on PNG/WebP
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(url);

      // Use JPEG data URL with quality 0.92 for sharp detail and compact PDF size
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve({ dataUrl, width, height, format: 'JPEG' });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to decode image: ${file.name}`));
    };

    img.src = url;
  });
}

/**
 * Calculate page dimensions, orientation, and image placement coordinates
 */
function calculatePageLayout(
  imgW: number,
  imgH: number,
  config: PdfConfig
): {
  pageW: number;
  pageH: number;
  orientation: 'p' | 'l';
  imgX: number;
  imgY: number;
  drawW: number;
  drawH: number;
} {
  const margin = MARGIN_VALUES_PT[config.margin];
  const imgAspect = imgW / imgH;

  if (config.pageSize === 'fit') {
    // Fit to Image mode: page dimensions match image aspect ratio at 72 DPI
    // Standardize baseline point size
    const baseW = (imgW * 72) / 96;
    const baseH = (imgH * 72) / 96;

    const pageW = baseW + margin * 2;
    const pageH = baseH + margin * 2;
    const orientation = pageW >= pageH ? 'l' : 'p';

    return {
      pageW,
      pageH,
      orientation,
      imgX: margin,
      imgY: margin,
      drawW: baseW,
      drawH: baseH,
    };
  }

  // Standard Paper Sizes (A4, Letter, Legal)
  const baseDim = PAGE_DIMENSIONS_PT[config.pageSize];
  let orientation: 'p' | 'l';

  if (config.orientation === 'auto') {
    orientation = imgAspect >= 1 ? 'l' : 'p';
  } else if (config.orientation === 'landscape') {
    orientation = 'l';
  } else {
    orientation = 'p';
  }

  const pageW = orientation === 'p' ? baseDim.width : baseDim.height;
  const pageH = orientation === 'p' ? baseDim.height : baseDim.width;

  const usableW = Math.max(10, pageW - margin * 2);
  const usableH = Math.max(10, pageH - margin * 2);
  const usableAspect = usableW / usableH;

  let drawW: number;
  let drawH: number;

  if (imgAspect >= usableAspect) {
    // Width constrained
    drawW = usableW;
    drawH = usableW / imgAspect;
  } else {
    // Height constrained
    drawH = usableH;
    drawW = usableH * imgAspect;
  }

  // Centering inside margins
  const imgX = margin + (usableW - drawW) / 2;
  const imgY = margin + (usableH - drawH) / 2;

  return {
    pageW,
    pageH,
    orientation,
    imgX,
    imgY,
    drawW,
    drawH,
  };
}

/**
 * Sequential generation of a multi-page PDF document using jsPDF
 */
export async function generatePdfFromImages(
  items: ImageToPdfItem[],
  config: PdfConfig,
  onProgress?: (statusText: string, current: number, total: number) => void
): Promise<PdfGenerationResult> {
  if (items.length === 0) {
    throw new Error('No images selected for PDF generation.');
  }

  // Lazily load jsPDF only when user initiates generation
  const jspdfModule = await import('jspdf');
  const jsPDF = (jspdfModule.jsPDF || jspdfModule.default) as any;

  let doc: any = null;
  const total = items.length;

  for (let i = 0; i < total; i++) {
    const item = items[i];

    if (onProgress) {
      onProgress(`Processing image ${i + 1} of ${total}: ${item.name}...`, i + 1, total);
    }

    // Step 1: Render onto canvas & get JPEG payload
    const { dataUrl, width, height, format } = await prepareImageBitmap(item.file);

    // Step 2: Compute exact layout coordinates
    const layout = calculatePageLayout(width, height, config);

    // Step 3: Initialize document or add new page
    if (i === 0) {
      doc = new jsPDF({
        orientation: layout.orientation,
        unit: 'pt',
        format: [layout.pageW, layout.pageH],
        compress: true,
      });
    } else {
      doc.addPage([layout.pageW, layout.pageH], layout.orientation);
    }

    // Step 4: Add image to the page
    doc.addImage(dataUrl, format, layout.imgX, layout.imgY, layout.drawW, layout.drawH, undefined, 'FAST');
  }

  if (onProgress) {
    onProgress('Finalizing PDF document...', total, total);
  }

  const outputFilename = sanitizePdfFilename(config.customFilename);
  const blob: Blob = doc.output('blob');
  const objectUrl = URL.createObjectURL(blob);

  return {
    blob,
    objectUrl,
    filename: outputFilename,
    pageCount: total,
    fileSizeBytes: blob.size,
  };
}

/**
 * Trigger immediate browser download of the PDF Blob
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
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
