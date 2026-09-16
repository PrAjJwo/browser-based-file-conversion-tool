import assert from 'node:assert';
import {
  formatBytes,
  getMimeType,
  getExtensionForMime,
  generateCompressedFilename,
  calculateDimensions,
  generateItemId,
} from '../src/scripts/image-compressor.ts';

console.log('--- RUNNING IMAGE COMPRESSOR UNIT TESTS ---');

// 1. formatBytes
assert.strictEqual(formatBytes(0), '0 Bytes');
assert.strictEqual(formatBytes(1024), '1 KB');
assert.strictEqual(formatBytes(1048576), '1 MB');
assert.strictEqual(formatBytes(2500000), '2.38 MB');
console.log('✓ formatBytes passed');

// 2. getMimeType
assert.strictEqual(getMimeType({ name: 'test.jpg' }), 'image/jpeg');
assert.strictEqual(getMimeType({ name: 'test.JPEG' }), 'image/jpeg');
assert.strictEqual(getMimeType({ name: 'badge.png' }), 'image/png');
assert.strictEqual(getMimeType({ name: 'hero.webp' }), 'image/webp');
assert.strictEqual(getMimeType({ name: 'file.unknown', type: 'image/webp' }), 'image/webp');
console.log('✓ getMimeType passed');

// 3. getExtensionForMime
assert.strictEqual(getExtensionForMime('image/jpeg'), 'jpg');
assert.strictEqual(getExtensionForMime('image/png'), 'png');
assert.strictEqual(getExtensionForMime('image/webp'), 'webp');
console.log('✓ getExtensionForMime passed');

// 4. generateCompressedFilename
const used = new Set();
const f1 = generateCompressedFilename('photo.jpg', 'image/jpeg', used);
assert.strictEqual(f1, 'photo-compressed.jpg');

const f2 = generateCompressedFilename('photo.jpg', 'image/jpeg', used);
assert.strictEqual(f2, 'photo-compressed-2.jpg');

const f3 = generateCompressedFilename('PHOTO.JPG', 'image/jpeg', used);
assert.strictEqual(f3, 'PHOTO-compressed-3.jpg');

const f4 = generateCompressedFilename('graphic.png', 'image/webp', used);
assert.strictEqual(f4, 'graphic-compressed.webp');

const f5 = generateCompressedFilename('my holiday photo.jpg', 'image/jpeg', used);
assert.strictEqual(f5, 'my holiday photo-compressed.jpg');

const f6 = generateCompressedFilename('東京_旅行_2026.png', 'image/jpeg', used);
assert.strictEqual(f6, '東京_旅行_2026-compressed.jpg');
console.log('✓ generateCompressedFilename passed');

// 5. calculateDimensions (Preserve original dimensions by default)
const d1 = calculateDimensions(1200, 800, 0);
assert.strictEqual(d1.width, 1200);
assert.strictEqual(d1.height, 800);

const d2 = calculateDimensions(1200, 800, undefined);
assert.strictEqual(d2.width, 1200);
assert.strictEqual(d2.height, 800);

// Dimension cap downscale
const d3 = calculateDimensions(2400, 1600, 1200);
assert.strictEqual(d3.width, 1200);
assert.strictEqual(d3.height, 800);

const d4 = calculateDimensions(800, 1600, 800); // portrait
assert.strictEqual(d4.width, 400);
assert.strictEqual(d4.height, 800);
console.log('✓ calculateDimensions passed');

// 6. generateItemId
const id1 = generateItemId();
const id2 = generateItemId();
assert.ok(id1.startsWith('comp_'));
assert.notStrictEqual(id1, id2);
console.log('✓ generateItemId passed');

console.log('\n--- ALL IMAGE COMPRESSOR UNIT TESTS PASSED (18/18) ---');
