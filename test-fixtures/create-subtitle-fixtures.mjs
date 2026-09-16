import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. sample.srt
const sampleSrt = `1
00:00:01,000 --> 00:00:04,500
Welcome to Browser File Tools.

2
00:00:05,000 --> 00:00:08,200
Convert subtitles securely in your browser.
No files are ever uploaded.

3
00:00:09,100 --> 00:00:12,850
Fast, private, and 100% client-side.
`;
fs.writeFileSync(path.join(__dirname, 'sample.srt'), sampleSrt, 'utf8');

// 2. sample.vtt
const sampleVtt = `WEBVTT - Sample WebVTT File

1
00:00:01.000 --> 00:00:04.500 position:10% align:left
Welcome to WebVTT captions.

2
00:00:05.000 --> 00:00:08.200 line:80%
This format is designed for HTML5 video players.

3
00:00:09.100 --> 00:00:12.850
Seamless browser playback with custom cues.
`;
fs.writeFileSync(path.join(__dirname, 'sample.vtt'), sampleVtt, 'utf8');

// 3. sample.txt (plain text without timestamps)
const sampleTxt = `This is a plain dialogue transcript without any timestamps.
Speaker 1: Hello everyone, welcome to the presentation.
Speaker 2: Thanks for having me today.
Speaker 1: We will discuss browser file converters and privacy guarantees.
`;
fs.writeFileSync(path.join(__dirname, 'sample.txt'), sampleTxt, 'utf8');

// 4. unicode.srt (Accents, CJK, Arabic RTL, Emoji)
const unicodeSrt = `1
00:00:01,000 --> 00:00:03,500
Bonjour à tous! Café, crème brûlée et naïve élève.

2
00:00:04,000 --> 00:00:07,000
日本語の字幕テスト：こんにちは世界！映画のセリフです。

3
00:00:07,500 --> 00:00:10,000
한국어 자막 테스트: 안녕하세요! 자막 변환 도구입니다.

4
00:00:10,500 --> 00:00:13,000
مرحبا بكم في عالم الترجمة الحديثة 🎬✨

5
00:00:13,500 --> 00:00:16,000
Emoji test: 🚀🎉 Subtitles are rock solid!
`;
fs.writeFileSync(path.join(__dirname, 'unicode.srt'), unicodeSrt, 'utf8');

// 5. unicode with UTF-8 BOM
const bomSrt = '\uFEFF' + unicodeSrt;
fs.writeFileSync(path.join(__dirname, 'bom_unicode.srt'), bomSrt, 'utf8');

// 6. malformed.srt
const malformedSrt = `1
00:00:01,000 --> 00:00:04,000
Valid cue first.

2
00:00:06,000 --> 00:00:03,000
End timestamp is before start timestamp!

3
NOT A TIMESTAMP --> INVALID
Broken time format line.

4
00:00:10,000 --> 00:00:14,000
Last valid cue after invalid blocks.
`;
fs.writeFileSync(path.join(__dirname, 'malformed.srt'), malformedSrt, 'utf8');

// 7. large.srt (250 cues)
let largeSrt = '';
for (let i = 1; i <= 250; i++) {
  const startSec = (i - 1) * 4;
  const endSec = startSec + 3;
  const pad = (n, z = 2) => String(n).padStart(z, '0');
  const formatTime = (totalSec) => {
    const s = totalSec % 60;
    const m = Math.floor((totalSec / 60) % 60);
    const h = Math.floor(totalSec / 3600);
    return `${pad(h)}:${pad(m)}:${pad(s)},000`;
  };
  largeSrt += `${i}\n${formatTime(startSec)} --> ${formatTime(endSec)}\nThis is cue number ${i} of our 250-cue performance benchmark test.\n\n`;
}
fs.writeFileSync(path.join(__dirname, 'large.srt'), largeSrt.trim() + '\n', 'utf8');

console.log('Successfully generated all subtitle test fixtures.');
