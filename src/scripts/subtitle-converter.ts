/**
 * Client-Side Subtitle Converter Engine
 *
 * Supports SRT, WebVTT (VTT), and Plain Text (TXT) parsing,
 * validation, normalization, and bidirectional conversion.
 *
 * 100% in-browser processing with zero remote network requests.
 */

export interface SubtitleCue {
  id?: string;
  startMs: number;
  endMs: number;
  text: string;
  settings?: string;
}

export type SubtitleFormat = 'srt' | 'vtt' | 'txt';

export interface SubtitleParseResult {
  format: SubtitleFormat;
  cues: SubtitleCue[];
  rawText: string;
  totalDurationMs: number;
  warnings: string[];
  hasTimestamps: boolean;
  error?: string;
}

/**
 * Remove UTF-8 Byte Order Mark (BOM) if present
 */
export function stripBom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

/**
 * Format milliseconds into HH:MM:SS,mmm (SRT standard)
 */
export function msToSrtTime(ms: number): string {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor(ms % 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

/**
 * Format milliseconds into HH:MM:SS.mmm (WebVTT standard)
 */
export function msToVttTime(ms: number): string {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor(ms % 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
}

/**
 * Parse timestamp string into milliseconds
 * Accepts: HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm
 */
export function parseTimestampToMs(timeStr: string): number | null {
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const secParts = parts[2].split('.');
    const seconds = parseInt(secParts[0], 10);
    const ms = parseInt((secParts[1] || '0').padEnd(3, '0').slice(0, 3), 10);

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(ms)) return null;
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const secParts = parts[1].split('.');
    const seconds = parseInt(secParts[0], 10);
    const ms = parseInt((secParts[1] || '0').padEnd(3, '0').slice(0, 3), 10);

    if (isNaN(minutes) || isNaN(seconds) || isNaN(ms)) return null;
    return (minutes * 60 + seconds) * 1000 + ms;
  }

  return null;
}

/**
 * Detect format from file extension and initial text content
 */
export function detectSubtitleFormat(content: string, filename?: string): 'srt' | 'vtt' | 'txt' {
  const clean = stripBom(content).trim();
  const lowerName = (filename || '').toLowerCase();

  if (clean.startsWith('WEBVTT') || lowerName.endsWith('.vtt')) {
    return 'vtt';
  }

  // Check for SRT pattern: index followed by timestamp arrow
  const srtPattern = /^\s*(\d+)?\s*\r?\n?\s*\d{1,2}:\d{2}:\d{2}[,.]\d{2,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{2,3}/m;
  if (lowerName.endsWith('.srt') || srtPattern.test(clean)) {
    return 'srt';
  }

  return 'txt';
}

/**
 * Parse SRT text into internal SubtitleCue array
 */
export function parseSrt(content: string): SubtitleParseResult {
  const clean = stripBom(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = clean.split(/\n\s*\n+/);
  const cues: SubtitleCue[] = [];
  const warnings: string[] = [];

  const timeRegex = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/;

  for (let bIndex = 0; bIndex < blocks.length; bIndex++) {
    const block = blocks[bIndex].trim();
    if (!block) continue;

    const lines = block.split('\n');
    let timeLineIdx = -1;
    let timeMatch: RegExpMatchArray | null = null;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(timeRegex);
      if (match) {
        timeLineIdx = i;
        timeMatch = match;
        break;
      }
    }

    if (!timeMatch || timeLineIdx === -1) {
      warnings.push(`Block ${bIndex + 1} ignored: missing valid timestamp line.`);
      continue;
    }

    const startMs = parseTimestampToMs(timeMatch[1]);
    const endMs = parseTimestampToMs(timeMatch[2]);

    if (startMs === null || endMs === null) {
      warnings.push(`Block ${bIndex + 1}: unparseable timestamp "${lines[timeLineIdx]}".`);
      continue;
    }

    if (startMs > endMs) {
      warnings.push(`Block ${bIndex + 1}: start time (${timeMatch[1]}) is after end time (${timeMatch[2]}).`);
    }

    // Cue ID (preceding line if numeric/identifier)
    let cueId: string | undefined;
    if (timeLineIdx > 0) {
      cueId = lines[0].trim();
    }

    // Text lines
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join('\n').trim();

    cues.push({
      id: cueId,
      startMs,
      endMs,
      text,
    });
  }

  const totalDurationMs = cues.length > 0 ? Math.max(...cues.map((c) => c.endMs)) : 0;

  return {
    format: 'srt',
    cues,
    rawText: clean,
    totalDurationMs,
    warnings,
    hasTimestamps: cues.length > 0,
    error: cues.length === 0 ? 'No valid subtitle cues found in SRT file.' : undefined,
  };
}

/**
 * Parse WebVTT text into internal SubtitleCue array
 */
export function parseVtt(content: string): SubtitleParseResult {
  const clean = stripBom(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const warnings: string[] = [];

  if (!clean.trim().startsWith('WEBVTT')) {
    warnings.push('Header does not begin with standard "WEBVTT" token.');
  }

  const blocks = clean.split(/\n\s*\n+/);
  const cues: SubtitleCue[] = [];

  const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3})(.*)/;

  for (let bIndex = 0; bIndex < blocks.length; bIndex++) {
    const block = blocks[bIndex].trim();
    if (!block) continue;
    if (block.startsWith('WEBVTT') || block.startsWith('NOTE') || block.startsWith('STYLE')) {
      continue; // Skip header and comment blocks
    }

    const lines = block.split('\n');
    let timeLineIdx = -1;
    let timeMatch: RegExpMatchArray | null = null;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(timeRegex);
      if (match) {
        timeLineIdx = i;
        timeMatch = match;
        break;
      }
    }

    if (!timeMatch || timeLineIdx === -1) {
      continue;
    }

    const startMs = parseTimestampToMs(timeMatch[1]);
    const endMs = parseTimestampToMs(timeMatch[2]);
    const settings = timeMatch[3]?.trim();

    if (startMs === null || endMs === null) {
      warnings.push(`VTT Block ${bIndex + 1}: unparseable timestamp "${lines[timeLineIdx]}".`);
      continue;
    }

    if (startMs > endMs) {
      warnings.push(`VTT Block ${bIndex + 1}: start time (${timeMatch[1]}) is after end time (${timeMatch[2]}).`);
    }

    let cueId: string | undefined;
    if (timeLineIdx > 0) {
      cueId = lines[0].trim();
    }

    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join('\n').trim();

    cues.push({
      id: cueId,
      startMs,
      endMs,
      text,
      settings: settings || undefined,
    });
  }

  const totalDurationMs = cues.length > 0 ? Math.max(...cues.map((c) => c.endMs)) : 0;

  return {
    format: 'vtt',
    cues,
    rawText: clean,
    totalDurationMs,
    warnings,
    hasTimestamps: cues.length > 0,
    error: cues.length === 0 ? 'No valid subtitle cues found in WebVTT file.' : undefined,
  };
}

/**
 * Inspect Plain Text file: check if it contains timestamp cues or is pure dialog
 */
export function parseTxt(content: string): SubtitleParseResult {
  const clean = stripBom(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check if user pasted SRT or VTT content into a .txt file
  const hasArrows = clean.includes('-->');
  if (hasArrows) {
    const srtTry = parseSrt(clean);
    if (srtTry.cues.length > 0) {
      return {
        ...srtTry,
        format: 'srt',
      };
    }
  }

  return {
    format: 'txt',
    cues: [],
    rawText: clean,
    totalDurationMs: 0,
    warnings: [
      'Plain TXT files do not contain subtitle timing metadata. Timed subtitles cannot be inferred automatically.',
    ],
    hasTimestamps: false,
  };
}

/**
 * Main parse entry point: parses SRT, VTT, or TXT
 */
export function parseSubtitles(content: string, filename?: string): SubtitleParseResult {
  const format = detectSubtitleFormat(content, filename);
  if (format === 'vtt') {
    return parseVtt(content);
  } else if (format === 'srt') {
    return parseSrt(content);
  }
  return parseTxt(content);
}

/**
 * Serialize SubtitleCue array to SRT format
 */
export function serializeToSrt(cues: SubtitleCue[]): string {
  if (cues.length === 0) return '';

  return cues
    .map((cue, index) => {
      const idx = index + 1;
      const start = msToSrtTime(cue.startMs);
      const end = msToSrtTime(cue.endMs);
      // Clean up any remaining HTML/VTT tags like <v Voice> or <b> for clean SRT output
      const cleanText = cue.text.replace(/<[^>]+>/g, '');
      return `${idx}\n${start} --> ${end}\n${cleanText}`;
    })
    .join('\n\n') + '\n';
}

/**
 * Serialize SubtitleCue array to WebVTT format
 */
export function serializeToVtt(cues: SubtitleCue[]): string {
  const header = 'WEBVTT\n\n';
  if (cues.length === 0) return header;

  const cueBlocks = cues.map((cue) => {
    const start = msToVttTime(cue.startMs);
    const end = msToVttTime(cue.endMs);
    const idLine = cue.id ? `${cue.id}\n` : '';
    const settings = cue.settings ? ` ${cue.settings}` : '';
    return `${idLine}${start} --> ${end}${settings}\n${cue.text}`;
  });

  return header + cueBlocks.join('\n\n') + '\n';
}

/**
 * Serialize SubtitleCue array to plain transcript text (TXT)
 */
export function serializeToTxt(cues: SubtitleCue[], mode: 'cues' | 'paragraphs' = 'cues'): string {
  if (cues.length === 0) return '';

  if (mode === 'paragraphs') {
    return cues
      .map((c) => c.text.replace(/\n/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n');
  }

  // One cue per line / preserved line breaks
  return cues
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Generate output filename based on target format
 */
export function generateSubtitleFilename(originalFilename: string, targetFormat: SubtitleFormat): string {
  // Strip trailing .srt, .vtt, .txt (case-insensitive)
  let base = originalFilename.replace(/\.(srt|vtt|txt)$/i, '');
  if (!base) base = 'subtitles';
  return `${base}.${targetFormat}`;
}

/**
 * Trigger browser download of text content with proper MIME type
 */
export function downloadSubtitleText(content: string, filename: string, format: SubtitleFormat): void {
  const mimeTypes: Record<SubtitleFormat, string> = {
    srt: 'application/x-subrip;charset=utf-8',
    vtt: 'text/vtt;charset=utf-8',
    txt: 'text/plain;charset=utf-8',
  };

  const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain;charset=utf-8' });
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
