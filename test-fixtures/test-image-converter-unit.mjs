import assert from 'node:assert';
import {
  formatBytes,
  getMimeType,
  getExtensionForMime,
  getFormatLabel,
  generateConvertedFilename,
} from '../src/scripts/image-converter.ts';

console.log('Running Image Converter Unit Tests...');

// 1. formatBytes
assert.strictEqual(formatBytes(0), '0 Bytes');
assert.strictEqual(formatBytes(1024), '1 KB');
assert.strictEqual(formatBytes(1048576), '1 MB');
console.log('✔ formatBytes passed');

// 2. getMimeType
assert.strictEqual(getMimeType({ name: 'image.jpg' }), 'image/jpeg');
assert.strictEqual(getMimeType({ name: 'PHOTO.JPEG' }), 'image/jpeg');
assert.strictEqual(getMimeType({ name: 'icon.png' }), 'image/png');
assert.strictEqual(getMimeType({ name: 'banner.webp' }), 'image/webp');
assert.strictEqual(getMimeType({ name: 'custom.bin', type: 'image/webp' }), 'image/webp');
console.log('✔ getMimeType passed');

// 3. getExtensionForMime
assert.strictEqual(getExtensionForMime('image/jpeg'), 'jpg');
assert.strictEqual(getExtensionForMime('image/png'), 'png');
assert.strictEqual(getExtensionForMime('image/webp'), 'webp');
console.log('✔ getExtensionForMime passed');

// 4. getFormatLabel
assert.strictEqual(getFormatLabel('image/jpeg'), 'JPG');
assert.strictEqual(getFormatLabel('image/png'), 'PNG');
assert.strictEqual(getFormatLabel('image/webp'), 'WebP');
console.log('✔ getFormatLabel passed');

// 5. generateConvertedFilename
const names = new Set();
const out1 = generateConvertedFilename('photo.jpg', 'image/png', names);
assert.strictEqual(out1, 'photo.png');

const out2 = generateConvertedFilename('photo.png', 'image/webp', names);
assert.strictEqual(out2, 'photo.webp');

const out3 = generateConvertedFilename('photo.webp', 'image/jpeg', names);
assert.strictEqual(out3, 'photo.jpg');

const out4 = generateConvertedFilename('my holiday photo.JPG', 'image/png', names);
assert.strictEqual(out4, 'my holiday photo.png');

const out5 = generateConvertedFilename('旅行写真.png', 'image/webp', names);
assert.strictEqual(out5, '旅行写真.webp');

const out6 = generateConvertedFilename('photo.final.webp', 'image/jpeg', names);
assert.strictEqual(out6, 'photo.final.jpg');

// Collision test
const duplicateNames = new Set(['photo.png']);
const dup1 = generateConvertedFilename('photo.jpg', 'image/png', duplicateNames);
assert.strictEqual(dup1, 'photo-2.png');

const dup2 = generateConvertedFilename('photo.jpg', 'image/png', duplicateNames);
assert.strictEqual(dup2, 'photo-3.png');

console.log('✔ generateConvertedFilename passed');
console.log('\nAll 18 unit test assertions passed successfully!');
