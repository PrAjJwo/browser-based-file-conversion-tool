import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseSrt,
  parseVtt,
  parseTxt,
  parseSubtitles,
  serializeToSrt,
  serializeToVtt,
  serializeToTxt,
  generateSubtitleFilename,
  stripBom,
  msToSrtTime,
  msToVttTime,
  parseTimestampToMs,
} from '../src/scripts/subtitle-converter.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== RUNNING SUBTITLE ENGINE UNIT TESTS ===');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  FAIL: ${message}`);
    failCount++;
  }
}

// 1. SRT Parser
console.log('\n--- 1. Testing SRT Parser ---');
const sampleSrt = fs.readFileSync(path.join(__dirname, 'sample.srt'), 'utf8');
const srtRes = parseSrt(sampleSrt);
assert(srtRes.format === 'srt', 'Parsed format is srt');
assert(srtRes.cues.length === 3, 'Found 3 cues in sample.srt');
assert(srtRes.cues[0].startMs === 1000 && srtRes.cues[0].endMs === 4500, 'Cue 1 timing: 1000ms to 4500ms');
assert(srtRes.cues[0].text === 'Welcome to Browser File Tools.', 'Cue 1 text parsed accurately');
assert(srtRes.totalDurationMs === 12850, `Total duration calculated: ${srtRes.totalDurationMs}ms`);

// 2. VTT Parser
console.log('\n--- 2. Testing VTT Parser ---');
const sampleVtt = fs.readFileSync(path.join(__dirname, 'sample.vtt'), 'utf8');
const vttRes = parseVtt(sampleVtt);
assert(vttRes.format === 'vtt', 'Parsed format is vtt');
assert(vttRes.cues.length === 3, 'Found 3 cues in sample.vtt');
assert(vttRes.cues[0].startMs === 1000 && vttRes.cues[0].endMs === 4500, 'Cue 1 timing matches: 1000ms to 4500ms');
assert(vttRes.cues[0].settings === 'position:10% align:left', `Cue 1 settings extracted: ${vttRes.cues[0].settings}`);
assert(vttRes.cues[1].settings === 'line:80%', `Cue 2 settings extracted: ${vttRes.cues[1].settings}`);

// 3. TXT Parser
console.log('\n--- 3. Testing TXT Parser ---');
const sampleTxt = fs.readFileSync(path.join(__dirname, 'sample.txt'), 'utf8');
const txtRes = parseTxt(sampleTxt);
assert(txtRes.format === 'txt', 'Parsed format is txt');
assert(txtRes.cues.length === 0, 'Plain text returns 0 timed cues');
assert(!txtRes.hasTimestamps, 'hasTimestamps is false');
assert(txtRes.warnings.length > 0 && txtRes.warnings[0].includes('Plain TXT files do not contain subtitle timing'), 'Plain TXT warning reported');

// 4. SRT -> VTT Serialization
console.log('\n--- 4. Testing SRT -> VTT Serialization ---');
const srtToVtt = serializeToVtt(srtRes.cues);
assert(srtToVtt.startsWith('WEBVTT\n\n'), 'Output starts with standard WEBVTT header');
assert(srtToVtt.includes('00:00:01.000 --> 00:00:04.500'), 'Uses dot separator for milliseconds (00:00:01.000)');
assert(srtToVtt.includes('Welcome to Browser File Tools.'), 'Cue text preserved in VTT output');

// 5. VTT -> SRT Serialization
console.log('\n--- 5. Testing VTT -> SRT Serialization ---');
const vttToSrt = serializeToSrt(vttRes.cues);
assert(!vttToSrt.includes('WEBVTT'), 'No WEBVTT header in SRT output');
assert(vttToSrt.includes('00:00:01,000 --> 00:00:04,500'), 'Uses comma separator for milliseconds (00:00:01,000)');
assert(vttToSrt.startsWith('1\n00:00:01,000 --> 00:00:04,500'), 'Sequential cue numbering starting at 1');

// 6. Subtitles -> TXT Serialization
console.log('\n--- 6. Testing Subtitles -> TXT Serialization ---');
const txtExport = serializeToTxt(srtRes.cues, 'paragraphs');
assert(!txtExport.includes('-->'), 'TXT export strips all timestamp arrows');
assert(!txtExport.includes('00:00:01'), 'TXT export strips all timecodes');
assert(txtExport.includes('Welcome to Browser File Tools.'), 'First line of dialogue preserved');
assert(txtExport.includes('Fast, private, and 100% client-side.'), 'Last line of dialogue preserved');

// 7. Bidirectional Roundtrip: SRT -> VTT -> SRT
console.log('\n--- 7. Testing Bidirectional Roundtrip (SRT -> VTT -> SRT) ---');
const vttInter = serializeToVtt(srtRes.cues);
const parsedVtt = parseVtt(vttInter);
const srtFinal = serializeToSrt(parsedVtt.cues);
const parsedFinal = parseSrt(srtFinal);
assert(parsedFinal.cues.length === srtRes.cues.length, `Cue count matches after roundtrip (${parsedFinal.cues.length} vs ${srtRes.cues.length})`);
assert(parsedFinal.cues[0].startMs === srtRes.cues[0].startMs && parsedFinal.cues[0].endMs === srtRes.cues[0].endMs, 'Cue 1 timing identical');
assert(parsedFinal.cues[1].startMs === srtRes.cues[1].startMs && parsedFinal.cues[1].endMs === srtRes.cues[1].endMs, 'Cue 2 timing identical');
assert(parsedFinal.cues[2].startMs === srtRes.cues[2].startMs && parsedFinal.cues[2].endMs === srtRes.cues[2].endMs, 'Cue 3 timing identical');
assert(parsedFinal.cues[0].text === srtRes.cues[0].text, 'Cue 1 text preserved identically');

// 8. Unicode & UTF-8 BOM Handling
console.log('\n--- 8. Testing Unicode & BOM Handling ---');
const bomSrt = fs.readFileSync(path.join(__dirname, 'bom_unicode.srt'), 'utf8');
const unicodeRes = parseSrt(bomSrt);
assert(unicodeRes.cues.length === 5, 'Parsed 5 cues from BOM-prefixed Unicode SRT');
assert(unicodeRes.cues[0].text.includes('Bonjour à tous! Café, crème brûlée'), 'French accents preserved');
assert(unicodeRes.cues[1].text.includes('日本語の字幕テスト：こんにちは世界！'), 'Japanese CJK preserved');
assert(unicodeRes.cues[2].text.includes('한국어 자막 테스트: 안녕하세요!'), 'Korean Hangul preserved');
assert(unicodeRes.cues[3].text.includes('مرحبا بكم في عالم الترجمة الحديثة'), 'Arabic RTL preserved');
assert(unicodeRes.cues[4].text.includes('🚀🎉 Subtitles are rock solid!'), 'Emoji preserved');

// 9. Malformed File Resilience
console.log('\n--- 9. Testing Malformed Subtitle Resilience ---');
const malformedSrt = fs.readFileSync(path.join(__dirname, 'malformed.srt'), 'utf8');
const malformedRes = parseSrt(malformedSrt);
assert(malformedRes.cues.length >= 2, `Parsed ${malformedRes.cues.length} valid cues despite corrupted blocks`);
assert(malformedRes.warnings.length >= 2, `Logged ${malformedRes.warnings.length} actionable warnings`);
assert(malformedRes.warnings.some(w => w.includes('is after end time') || w.includes('start time')), 'Detected end < start inverted timestamp');
assert(malformedRes.warnings.some(w => w.includes('missing valid timestamp line') || w.includes('unparseable')), 'Detected non-timestamp line');

// 10. Large File Performance Test (250 cues)
console.log('\n--- 10. Testing Large File Performance (250 cues) ---');
const largeSrt = fs.readFileSync(path.join(__dirname, 'large.srt'), 'utf8');
const t0 = performance.now();
const largeRes = parseSrt(largeSrt);
const largeVtt = serializeToVtt(largeRes.cues);
const t1 = performance.now();
const elapsed = (t1 - t0).toFixed(2);
assert(largeRes.cues.length === 250, `Successfully parsed 250 cues`);
assert(largeVtt.length > 5000, `Successfully serialized 250 VTT cues (${largeVtt.length} characters)`);
console.log(`  Performance: 250 cues parsed and converted in ${elapsed}ms`);
assert(t1 - t0 < 500, 'Completed in under 500ms');

// 11. Filename Generation
console.log('\n--- 11. Testing Filename Generation ---');
assert(generateSubtitleFilename('movie.srt', 'vtt') === 'movie.vtt', 'movie.srt -> movie.vtt');
assert(generateSubtitleFilename('movie.vtt', 'srt') === 'movie.srt', 'movie.vtt -> movie.srt');
assert(generateSubtitleFilename('movie.SRT', 'txt') === 'movie.txt', 'movie.SRT -> movie.txt (case-insensitive)');
assert(generateSubtitleFilename('my film.en.srt', 'vtt') === 'my film.en.vtt', 'my film.en.srt -> my film.en.vtt (no double ext)');
assert(generateSubtitleFilename('字幕_日本語.vtt', 'srt') === '字幕_日本語.srt', 'Unicode filename preserved');

console.log(`\n=== UNIT TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
if (failCount > 0) {
  process.exit(1);
}
