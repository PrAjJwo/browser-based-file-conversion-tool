import type { FFmpeg } from '@ffmpeg/ffmpeg';

export interface VideoMetadata {
  duration: number; // in seconds
  width: number;
  height: number;
  hasAudio: boolean;
  formatName: string;
}

export interface CompressionBudget {
  targetBytes: number;
  totalBitrateBps: number;
  audioBitrateKbps: number;
  videoBitrateKbps: number;
  targetWidth: number;
  targetHeight: number;
  isTinyBudget: boolean;
  isLargerThanSource: boolean;
  warning?: string;
}

export interface CompressionProgress {
  phase: 'preparing' | 'loading-engine' | 'reading-video' | 'compressing' | 'correcting' | 'finalizing';
  percentage: number; // 0 to 100
  message: string;
}

export interface CompressionResult {
  blob: Blob;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  targetSize: number;
  duration: number;
  width: number;
  height: number;
  ratio: number; // percentage reduction (e.g. 65 means 65% smaller)
  passes: number;
}

// Singleton instance for browser session reuse
let ffmpegInstance: FFmpeg | null = null;
let isEngineLoading = false;

/**
 * Lazy loads and initializes the single-threaded FFmpeg WebAssembly engine.
 * Reuses the existing instance once loaded.
 */
export async function getFFmpeg(
  onLog?: (msg: string) => void,
  onProgress?: (ratio: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (isEngineLoading) {
    // Wait until existing loading completes
    while (isEngineLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (ffmpegInstance && ffmpegInstance.loaded) {
      return ffmpegInstance;
    }
  }

  isEngineLoading = true;
  try {
    const { FFmpeg: FFmpegConstructor } = await import('@ffmpeg/ffmpeg');

    const ffmpeg = new FFmpegConstructor();

    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message));
    }
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => onProgress(progress));
    }

    // Load from self-hosted local public assets to guarantee 100% offline network privacy
    const baseURL = `${window.location.origin}/ffmpeg`;
    const coreURL = `${baseURL}/ffmpeg-core.js`;
    const wasmURL = `${baseURL}/ffmpeg-core.wasm`;

    console.log('[video-compressor] Initializing FFmpeg with:', { coreURL, wasmURL });
    await ffmpeg.load({
      coreURL,
      wasmURL,
    });
    console.log('[video-compressor] FFmpeg engine loaded successfully!');

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  } catch (err) {
    console.error('[video-compressor] FFmpeg load failed:', err);
    throw err;
  } finally {
    isEngineLoading = false;
  }
}

/**
 * Extracts video dimensions and duration using native HTML5 Video element.
 * Falls back to sensible defaults if native playback is restricted by browser codec demuxers.
 */
export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const metadataPromise = new Promise<VideoMetadata>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        // Fallback for MOV files that Chrome cannot demux in <video> element
        resolve({
          duration: 0,
          width: 0,
          height: 0,
          hasAudio: true,
          formatName: file.name.split('.').pop()?.toUpperCase() || 'VIDEO',
        });
      }, 3500);

      const cleanup = () => {
        clearTimeout(timeout);
        video.onloadedmetadata = null;
        video.onerror = null;
      };

      video.onloadedmetadata = () => {
        cleanup();
        const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;
        resolve({
          duration,
          width,
          height,
          hasAudio: true,
          formatName: file.name.split('.').pop()?.toUpperCase() || 'VIDEO',
        });
      };

      video.onerror = () => {
        cleanup();
        // Browser could not demux file (common with certain MOV profiles).
        // Return fallback so FFmpeg can handle it directly.
        resolve({
          duration: 0,
          width: 0,
          height: 0,
          hasAudio: true,
          formatName: file.name.split('.').pop()?.toUpperCase() || 'VIDEO',
        });
      };
    });

    video.src = objectUrl;
    return await metadataPromise;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Calculates target output dimensions given source resolution and user preference.
 * Ensures:
 * 1. No upscaling.
 * 2. Aspect ratio is preserved.
 * 3. Dimensions are even integers required by H.264/AAC encoders.
 */
export function calculateTargetDimensions(
  sourceWidth: number,
  sourceHeight: number,
  resolutionPref: 'original' | '1080p' | '720p' | '480p'
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0 || resolutionPref === 'original') {
    const w = sourceWidth > 0 ? Math.floor(sourceWidth / 2) * 2 : 1280;
    const h = sourceHeight > 0 ? Math.floor(sourceHeight / 2) * 2 : 720;
    return { width: w, height: h };
  }

  let maxWidth = 1920;
  let maxHeight = 1080;
  if (resolutionPref === '720p') {
    maxWidth = 1280;
    maxHeight = 720;
  } else if (resolutionPref === '480p') {
    maxWidth = 854;
    maxHeight = 480;
  }

  // Never upscale
  if (sourceWidth <= maxWidth && sourceHeight <= maxHeight) {
    return {
      width: Math.floor(sourceWidth / 2) * 2,
      height: Math.floor(sourceHeight / 2) * 2,
    };
  }

  const aspect = sourceWidth / sourceHeight;
  let targetWidth = maxWidth;
  let targetHeight = Math.round(maxWidth / aspect);

  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = Math.round(maxHeight * aspect);
  }

  // Ensure even dimensions
  targetWidth = Math.floor(targetWidth / 2) * 2;
  targetHeight = Math.floor(targetHeight / 2) * 2;

  return { width: Math.max(2, targetWidth), height: Math.max(2, targetHeight) };
}

/**
 * Calculates target bitrate budget from requested target size (MB) and video duration (s).
 *
 * Formula:
 * 1. Available total bits: targetMB * 1024 * 1024 * 8
 * 2. Available total bps: totalBits / durationSec
 * 3. Container & metadata safety reserve: 4% (0.96)
 * 4. Audio budget:
 *    - 128 kbps if total bps >= 800 kbps
 *    - 96 kbps if total bps >= 400 kbps
 *    - 64 kbps if total bps < 400 kbps
 * 5. Remaining budget allocated to video (min 45 kbps)
 */
export function calculateBudget(
  durationSec: number,
  targetMB: number,
  sourceWidth: number,
  sourceHeight: number,
  sourceBytes: number,
  resolutionPref: 'original' | '1080p' | '720p' | '480p'
): CompressionBudget {
  const targetBytes = targetMB * 1024 * 1024;
  const isLargerThanSource = targetBytes >= sourceBytes;

  // If duration is unknown, assume an initial 30s benchmark
  const effectiveDuration = durationSec > 0 ? durationSec : 30;

  const totalBits = targetBytes * 8;
  const totalBitrateBps = Math.round(totalBits / effectiveDuration);

  // Reserve 4% for MP4 container overhead (moov atom, stbl tables)
  const netBitrateBps = totalBitrateBps * 0.96;

  let audioBitrateKbps = 128;
  if (totalBitrateBps < 400000) {
    audioBitrateKbps = 64;
  } else if (totalBitrateBps < 800000) {
    audioBitrateKbps = 96;
  }

  const audioBitrateBps = audioBitrateKbps * 1000;
  const rawVideoBitrateBps = netBitrateBps - audioBitrateBps;
  const videoBitrateKbps = Math.max(45, Math.round(rawVideoBitrateBps / 1000));

  const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
    sourceWidth,
    sourceHeight,
    resolutionPref
  );

  const isTinyBudget = videoBitrateKbps < 180;
  let warning: string | undefined;

  if (isLargerThanSource) {
    warning = 'Target size is larger than the original video. Compression may not reduce file size.';
  } else if (isTinyBudget) {
    warning = 'Target size is very small for this video duration. Visual quality will be significantly reduced.';
  }

  return {
    targetBytes,
    totalBitrateBps,
    audioBitrateKbps,
    videoBitrateKbps,
    targetWidth,
    targetHeight,
    isTinyBudget,
    isLargerThanSource,
    warning,
  };
}

/**
 * Compresses a single video file to an approximate target size in MP4 format.
 * Implements a single corrective retry pass if output exceeds the requested target by > 7%.
 */
export async function compressVideo(
  file: File,
  targetMB: number,
  resolutionPref: 'original' | '1080p' | '720p' | '480p',
  onProgress: (progress: CompressionProgress) => void,
  abortSignal?: AbortSignal
): Promise<CompressionResult> {
  if (abortSignal?.aborted) {
    throw new DOMException('Compression cancelled by user', 'AbortError');
  }

  onProgress({
    phase: 'preparing',
    percentage: 5,
    message: 'Analyzing video metadata…',
  });

  // 1. Extract metadata
  const metadata = await extractVideoMetadata(file);

  onProgress({
    phase: 'loading-engine',
    percentage: 15,
    message: 'Loading in-browser FFmpeg video engine…',
  });

  // 2. Initialize FFmpeg instance
  let ffmpegLog = '';
  const ffmpeg = await getFFmpeg(
    (msg) => {
      ffmpegLog += msg + '\n';
      // Attempt to extract duration from FFmpeg log if HTML5 video duration was 0
      if (metadata.duration === 0) {
        const durMatch = msg.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (durMatch) {
          const hrs = parseFloat(durMatch[1]);
          const mins = parseFloat(durMatch[2]);
          const secs = parseFloat(durMatch[3]);
          metadata.duration = hrs * 3600 + mins * 60 + secs;
        }
      }
    },
    (ratio) => {
      // Progress from 0 to 1
      const pct = Math.min(95, Math.max(25, Math.round(25 + ratio * 65)));
      onProgress({
        phase: 'compressing',
        percentage: pct,
        message: `Compressing video frames (${Math.round(ratio * 100)}%)…`,
      });
    }
  );

  if (abortSignal?.aborted) {
    throw new DOMException('Compression cancelled by user', 'AbortError');
  }

  // 3. Write input file into WebAssembly MEMFS
  onProgress({
    phase: 'reading-video',
    percentage: 20,
    message: 'Reading source file into memory…',
  });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputFileName = `input.${ext}`;
  const outputFileName = 'output.mp4';

  const fileData = new Uint8Array(await file.arrayBuffer());
  await ffmpeg.writeFile(inputFileName, fileData);

  // 4. Calculate compression budget
  const budget = calculateBudget(
    metadata.duration,
    targetMB,
    metadata.width,
    metadata.height,
    file.size,
    resolutionPref
  );

  // Helper to build encoding arguments
  const buildArgs = (vBitrateK: number, aBitrateK: number, w: number, h: number): string[] => {
    const args = [
      '-i',
      inputFileName,
      '-c:v',
      'libx264',
      '-b:v',
      `${vBitrateK}k`,
      '-maxrate',
      `${Math.round(vBitrateK * 1.3)}k`,
      '-bufsize',
      `${Math.round(vBitrateK * 2)}k`,
      '-preset',
      'faster',
    ];

    if (w > 0 && h > 0) {
      args.push('-vf', `scale=${w}:${h}`);
    }

    args.push(
      '-c:a',
      'aac',
      '-b:a',
      `${aBitrateK}k`,
      '-movflags',
      '+faststart',
      '-y',
      outputFileName
    );
    return args;
  };

  // 5. Pass 1: Primary compression
  onProgress({
    phase: 'compressing',
    percentage: 25,
    message: 'Compressing video…',
  });

  let currentVBitrate = budget.videoBitrateKbps;
  let args = buildArgs(currentVBitrate, budget.audioBitrateKbps, budget.targetWidth, budget.targetHeight);

  let exitCode = await ffmpeg.exec(args);
  if (exitCode !== 0) {
    await safeDelete(ffmpeg, inputFileName);
    await safeDelete(ffmpeg, outputFileName);
    throw new Error(`FFmpeg compression failed (exit code ${exitCode}). ${ffmpegLog.slice(-300)}`);
  }

  let outputData = (await ffmpeg.readFile(outputFileName)) as Uint8Array;
  let outputBytes = outputData.byteLength;
  let passes = 1;

  // 6. Tolerance Check: If output exceeds requested target by > 7%, run ONE corrective pass
  const targetBytes = budget.targetBytes;
  if (outputBytes > targetBytes * 1.07 && metadata.duration > 0) {
    onProgress({
      phase: 'correcting',
      percentage: 88,
      message: 'Fine-tuning bitrate for target size…',
    });

    const overshootRatio = outputBytes / targetBytes;
    // Scale down video bitrate proportionally with safety factor
    currentVBitrate = Math.max(40, Math.round((currentVBitrate / overshootRatio) * 0.93));

    args = buildArgs(currentVBitrate, budget.audioBitrateKbps, budget.targetWidth, budget.targetHeight);
    exitCode = await ffmpeg.exec(args);

    if (exitCode === 0) {
      outputData = (await ffmpeg.readFile(outputFileName)) as Uint8Array;
      outputBytes = outputData.byteLength;
      passes = 2;
    }
  }

  onProgress({
    phase: 'finalizing',
    percentage: 98,
    message: 'Finalizing compressed MP4…',
  });

  // 7. Clean up virtual filesystem
  await safeDelete(ffmpeg, inputFileName);
  await safeDelete(ffmpeg, outputFileName);

  // 8. Construct final Blob and response
  const outputBlob = new Blob([outputData.buffer as ArrayBuffer], { type: 'video/mp4' });
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const finalOutputName = `${baseName}-compressed.mp4`;

  const reduction = file.size > outputBytes ? Math.round(((file.size - outputBytes) / file.size) * 100) : 0;

  return {
    blob: outputBlob,
    outputName: finalOutputName,
    originalSize: file.size,
    compressedSize: outputBytes,
    targetSize: targetBytes,
    duration: metadata.duration,
    width: budget.targetWidth,
    height: budget.targetHeight,
    ratio: reduction,
    passes,
  };
}

async function safeDelete(ffmpeg: FFmpeg, fileName: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(fileName);
  } catch {
    // Ignore cleanup errors for non-existent files
  }
}
