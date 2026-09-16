/**
 * Unit test for Social Image Resizer math and logic
 * Tests:
 * 1. calculateCropRect with all 9 focal positions
 * 2. calculateFitRect (letterboxing / pillarboxing)
 * 3. generateSocialFilename (presets, custom, collision avoidance)
 * 4. SOCIAL_PRESETS integrity and platform grouping
 * 5. Formatting utilities
 */

import assert from 'node:assert/strict';
import {
  calculateCropRect,
  calculateFitRect,
  generateSocialFilename,
  formatBytes,
  getMimeType,
  getExtensionForMime,
  getFormatLabel
} from '../src/scripts/social-image-resizer.ts';

import {
  SOCIAL_PRESETS,
  getPresetsByPlatform,
  getPresetById
} from '../src/data/social-image-presets.ts';

console.log('--- RUNNING SOCIAL RESIZER UNIT TESTS ---');

// 1. Test Presets data integrity
console.log('1. Testing SOCIAL_PRESETS integrity...');
assert(Array.isArray(SOCIAL_PRESETS), 'SOCIAL_PRESETS must be an array');
assert(SOCIAL_PRESETS.length >= 20, `Expected at least 20 presets, found ${SOCIAL_PRESETS.length}`);

for (const p of SOCIAL_PRESETS) {
  assert(p.id, 'Preset must have an id');
  assert(p.platform, `Preset ${p.id} must have a platform`);
  assert(p.label, `Preset ${p.id} must have a label`);
  assert(p.width > 0, `Preset ${p.id} width must be > 0`);
  assert(p.height > 0, `Preset ${p.id} height must be > 0`);
  assert(p.ratio, `Preset ${p.id} must have a ratio`);
  assert(p.source, `Preset ${p.id} must have a source`);
  assert(p.verifiedDate === '2026', `Preset ${p.id} must have verifiedDate 2026`);
}

const grouped = getPresetsByPlatform();
assert(grouped['Instagram'], 'Must contain Instagram presets');
assert(grouped['Facebook'], 'Must contain Facebook presets');
assert(grouped['X / Twitter'], 'Must contain X / Twitter presets');
assert(grouped['LinkedIn'], 'Must contain LinkedIn presets');
assert(grouped['YouTube'], 'Must contain YouTube presets');
assert(grouped['Pinterest'], 'Must contain Pinterest presets');
assert(grouped['TikTok'], 'Must contain TikTok presets');

const igSquare = getPresetById('instagram-square');
assert(igSquare, 'instagram-square must exist');
assert.equal(igSquare.width, 1080);
assert.equal(igSquare.height, 1080);
console.log('   ✓ Presets verified (2026 specifications across 7 platforms)');

// 2. Test calculateCropRect with all 9 focal points
console.log('2. Testing calculateCropRect with all 9 focal points...');
// Source: 1200 x 800 (landscape, aspect 1.5). Target: 1080 x 1080 (square, aspect 1.0).
// scale = max(1080/1200, 1080/800) = max(0.9, 1.35) = 1.35.
// sWidth = 1080 / 1.35 = 800.
// sHeight = 1080 / 1.35 = 800.
// excessX = 1200 - 800 = 400.
// excessY = 800 - 800 = 0.
{
  const sourceW = 1200;
  const sourceH = 800;
  const targetW = 1080;
  const targetH = 1080;

  // Center
  const center = calculateCropRect(sourceW, sourceH, targetW, targetH, 'center');
  assert.equal(center.sWidth, 800);
  assert.equal(center.sHeight, 800);
  assert.equal(center.sx, 200); // 400 / 2
  assert.equal(center.sy, 0);

  // Left
  const left = calculateCropRect(sourceW, sourceH, targetW, targetH, 'left');
  assert.equal(left.sx, 0);
  assert.equal(left.sy, 0);

  // Right
  const right = calculateCropRect(sourceW, sourceH, targetW, targetH, 'right');
  assert.equal(right.sx, 400);
  assert.equal(right.sy, 0);

  // Top-Left
  const topLeft = calculateCropRect(sourceW, sourceH, targetW, targetH, 'top-left');
  assert.equal(topLeft.sx, 0);
  assert.equal(topLeft.sy, 0);

  // Top-Right
  const topRight = calculateCropRect(sourceW, sourceH, targetW, targetH, 'top-right');
  assert.equal(topRight.sx, 400);
  assert.equal(topRight.sy, 0);

  // Bottom-Left
  const bottomLeft = calculateCropRect(sourceW, sourceH, targetW, targetH, 'bottom-left');
  assert.equal(bottomLeft.sx, 0);
  assert.equal(bottomLeft.sy, 0);

  // Bottom-Right
  const bottomRight = calculateCropRect(sourceW, sourceH, targetW, targetH, 'bottom-right');
  assert.equal(bottomRight.sx, 400);
  assert.equal(bottomRight.sy, 0);
}

// Now test vertical crop: Source 800 x 1200 (portrait). Target 1200 x 675 (landscape).
// scale = max(1200/800, 675/1200) = max(1.5, 0.5625) = 1.5.
// sWidth = 1200 / 1.5 = 800.
// sHeight = 675 / 1.5 = 450.
// excessX = 800 - 800 = 0.
// excessY = 1200 - 450 = 750.
{
  const sourceW = 800;
  const sourceH = 1200;
  const targetW = 1200;
  const targetH = 675;

  // Center
  const center = calculateCropRect(sourceW, sourceH, targetW, targetH, 'center');
  assert.equal(center.sWidth, 800);
  assert.equal(center.sHeight, 450);
  assert.equal(center.sx, 0);
  assert.equal(center.sy, 375); // 750 / 2

  // Top
  const top = calculateCropRect(sourceW, sourceH, targetW, targetH, 'top');
  assert.equal(top.sx, 0);
  assert.equal(top.sy, 0);

  // Bottom
  const bottom = calculateCropRect(sourceW, sourceH, targetW, targetH, 'bottom');
  assert.equal(bottom.sx, 0);
  assert.equal(bottom.sy, 750);

  // Top-Left
  const topLeft = calculateCropRect(sourceW, sourceH, targetW, targetH, 'top-left');
  assert.equal(topLeft.sx, 0);
  assert.equal(topLeft.sy, 0);

  // Bottom-Right
  const bottomRight = calculateCropRect(sourceW, sourceH, targetW, targetH, 'bottom-right');
  assert.equal(bottomRight.sx, 0);
  assert.equal(bottomRight.sy, 750);
}
console.log('   ✓ calculateCropRect math matches all 9 focal points perfectly');

// 3. Test calculateFitRect
console.log('3. Testing calculateFitRect (letterbox & pillarbox)...');
{
  // Landscape source (1200 x 600, 2:1) into square target (1000 x 1000)
  // scale = min(1000/1200, 1000/600) = 1000/1200 = 0.83333
  // dWidth = 1000, dHeight = 500
  // dx = 0, dy = (1000 - 500)/2 = 250 (letterbox top and bottom)
  const fit = calculateFitRect(1200, 600, 1000, 1000);
  assert.equal(fit.dWidth, 1000);
  assert.equal(fit.dHeight, 500);
  assert.equal(fit.dx, 0);
  assert.equal(fit.dy, 250);

  // Portrait source (600 x 1200, 1:2) into square target (1000 x 1000)
  // scale = min(1000/600, 1000/1200) = 1000/1200 = 0.83333
  // dWidth = 500, dHeight = 1000
  // dx = 250, dy = 0 (pillarbox left and right)
  const fit2 = calculateFitRect(600, 1200, 1000, 1000);
  assert.equal(fit2.dWidth, 500);
  assert.equal(fit2.dHeight, 1000);
  assert.equal(fit2.dx, 250);
  assert.equal(fit2.dy, 0);
}
console.log('   ✓ calculateFitRect letterbox and pillarbox math verified');

// 4. Test generateSocialFilename
console.log('4. Testing generateSocialFilename...');
{
  const existing = new Set();
  const name1 = generateSocialFilename('vacation.jpg', { id: 'instagram-square', label: 'Square', width: 1080, height: 1080, ratio: '1:1' }, 'image/jpeg', existing);
  assert.equal(name1, 'vacation-instagram-square.jpg');

  // Duplicate candidate collision handling
  const name2 = generateSocialFilename('vacation.jpg', { id: 'instagram-square', label: 'Square', width: 1080, height: 1080, ratio: '1:1' }, 'image/jpeg', existing);
  assert.equal(name2, 'vacation-instagram-square-2.jpg');

  // Format change
  const name3 = generateSocialFilename('photo.png', { id: 'x-post', label: 'X Post', width: 1200, height: 675, ratio: '16:9' }, 'image/webp', existing);
  assert.equal(name3, 'photo-x-post.webp');

  // Custom dimensions
  const nameCustom = generateSocialFilename('banner.jpg', { id: 'custom', isCustom: true, label: 'Custom', width: 800, height: 400, ratio: '2:1' }, 'image/png', existing);
  assert.equal(nameCustom, 'banner-800x400.png');
}
console.log('   ✓ generateSocialFilename collision and format mapping verified');

// 5. Test format utilities
console.log('5. Testing format utilities...');
assert.equal(formatBytes(0), '0 Bytes');
assert.equal(formatBytes(1024), '1 KB');
assert.equal(getMimeType({ name: 'test.jpg' }), 'image/jpeg');
assert.equal(getMimeType({ name: 'test.png' }), 'image/png');
assert.equal(getMimeType({ name: 'test.webp' }), 'image/webp');
assert.equal(getExtensionForMime('image/jpeg'), 'jpg');
assert.equal(getExtensionForMime('image/png'), 'png');
assert.equal(getExtensionForMime('image/webp'), 'webp');
assert.equal(getFormatLabel('image/jpeg'), 'JPG');
assert.equal(getFormatLabel('image/png'), 'PNG');
assert.equal(getFormatLabel('image/webp'), 'WebP');
console.log('   ✓ Utilities verified');

console.log('--- ALL SOCIAL RESIZER UNIT TESTS PASSED ---');
