import {
  calculateTargetDimensions,
  generateResizedFilename,
  getMimeType,
  getExtensionForMime,
  formatBytes,
} from '../src/scripts/image-resizer.ts';

console.log('=== RUNNING IMAGE RESIZER UNIT TESTS ===');

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

// 1. Percentage Mode Calculations
console.log('\n--- 1. Percentage Mode Calculations (1200x800) ---');
const origW = 1200;
const origH = 800;

const p50 = calculateTargetDimensions(origW, origH, {
  mode: 'percentage',
  percentage: 50,
  lockAspectRatio: true,
  outputFormat: 'original',
  quality: 0.9,
});
assert(p50.width === 600 && p50.height === 400, `50% scaling: ${p50.width}x${p50.height} (expected 600x400)`);

const p25 = calculateTargetDimensions(origW, origH, {
  mode: 'percentage',
  percentage: 25,
  lockAspectRatio: true,
  outputFormat: 'original',
  quality: 0.9,
});
assert(p25.width === 300 && p25.height === 200, `25% scaling: ${p25.width}x${p25.height} (expected 300x200)`);

const p200 = calculateTargetDimensions(origW, origH, {
  mode: 'percentage',
  percentage: 200,
  lockAspectRatio: true,
  outputFormat: 'original',
  quality: 0.9,
});
assert(p200.width === 2400 && p200.height === 1600, `200% scaling: ${p200.width}x${p200.height} (expected 2400x1600)`);

// 2. Dimensions Mode with Aspect-Ratio Lock
console.log('\n--- 2. Dimensions Mode with Aspect-Ratio Lock ---');
const dLockW = calculateTargetDimensions(origW, origH, {
  mode: 'dimensions',
  targetWidth: 900,
  lockAspectRatio: true,
  percentage: 100,
  outputFormat: 'original',
  quality: 0.9,
});
assert(dLockW.width === 900 && dLockW.height === 600, `Width=900 (locked): ${dLockW.width}x${dLockW.height} (expected 900x600)`);

const dLockH = calculateTargetDimensions(origW, origH, {
  mode: 'dimensions',
  targetHeight: 300,
  lockAspectRatio: true,
  percentage: 100,
  outputFormat: 'original',
  quality: 0.9,
});
assert(dLockH.width === 450 && dLockH.height === 300, `Height=300 (locked): ${dLockH.width}x${dLockH.height} (expected 450x300)`);

// 3. Dimensions Mode with Aspect-Ratio Unlocked
console.log('\n--- 3. Dimensions Mode with Aspect-Ratio Unlocked ---');
const dUnlock = calculateTargetDimensions(origW, origH, {
  mode: 'dimensions',
  targetWidth: 500,
  targetHeight: 500,
  lockAspectRatio: false,
  percentage: 100,
  outputFormat: 'original',
  quality: 0.9,
});
assert(dUnlock.width === 500 && dUnlock.height === 500, `Arbitrary 500x500 (unlocked): ${dUnlock.width}x${dUnlock.height}`);

// 4. Filename Generation & Deduplication
console.log('\n--- 4. Filename Generation & Deduplication ---');
const existing = new Set();
const name1 = generateResizedFilename('photo.jpg', 'image/jpeg', existing);
assert(name1 === 'photo-resized.jpg', `photo.jpg -> ${name1}`);

const name2 = generateResizedFilename('photo.jpg', 'image/jpeg', existing);
assert(name2 === 'photo-resized-2.jpg', `duplicate photo.jpg -> ${name2}`);

// Case-insensitive collision prevention (PHOTO.jpg collides with photo.jpg on Windows)
const name3 = generateResizedFilename('PHOTO.JPG', 'image/jpeg', existing);
assert(name3 === 'PHOTO-resized-3.jpg', `Case-insensitive collision prevention: PHOTO.JPG -> ${name3}`);

// Standalone uppercase filename
const standaloneExisting = new Set();
const nameUpper = generateResizedFilename('PHOTO.JPG', 'image/jpeg', standaloneExisting);
assert(nameUpper === 'PHOTO-resized.jpg', `Standalone PHOTO.JPG -> ${nameUpper}`);

const name4 = generateResizedFilename('image.png', 'image/webp', existing);
assert(name4 === 'image-resized.webp', `image.png to webp -> ${name4}`);

const name5 = generateResizedFilename('my holiday photo.png', 'image/png', existing);
assert(name5 === 'my holiday photo-resized.png', `my holiday photo.png -> ${name5}`);

const name6 = generateResizedFilename('旅行写真.webp', 'image/webp', existing);
assert(name6 === '旅行写真-resized.webp', `Unicode 旅行写真.webp -> ${name6}`);

// 5. MIME Types & Formatting
console.log('\n--- 5. MIME Types & Formatting ---');
assert(getExtensionForMime('image/jpeg') === 'jpg', 'image/jpeg -> jpg');
assert(getExtensionForMime('image/png') === 'png', 'image/png -> png');
assert(getExtensionForMime('image/webp') === 'webp', 'image/webp -> webp');
assert(formatBytes(1048576) === '1 MB', '1048576 -> 1 MB');
assert(formatBytes(51200) === '50 KB', '51200 -> 50 KB');

console.log(`\n=== UNIT TESTS FINISHED: ${passCount} PASSED, ${failCount} FAILED ===`);
if (failCount > 0) process.exit(1);
