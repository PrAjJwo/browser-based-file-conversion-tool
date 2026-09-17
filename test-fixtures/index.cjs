const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = __dirname;

const FIXTURES = {
  images: {
    landscapeJpg: path.join(FIXTURES_DIR, 'images', 'landscape.jpg'),
    portraitJpg: path.join(FIXTURES_DIR, 'images', 'portrait.jpg'),
    largePhotoJpg: path.join(FIXTURES_DIR, 'images', 'large_photo.jpg'),
    transparentBadgePng: path.join(FIXTURES_DIR, 'images', 'transparent_badge.png'),
    sampleWebp: path.join(FIXTURES_DIR, 'images', 'sample.webp'),
    corruptedJpg: path.join(FIXTURES_DIR, 'images', 'corrupted.jpg'),
  },
  heic: {
    autumnHeic: path.join(FIXTURES_DIR, 'heic', 'autumn_1440x960.heic'),
    springHeic: path.join(FIXTURES_DIR, 'heic', 'spring_1440x960.heic'),
    winterHeic: path.join(FIXTURES_DIR, 'heic', 'winter_1440x960.heic'),
    corruptedHeic: path.join(FIXTURES_DIR, 'heic', 'corrupted.heic'),
  },
  video: {
    sampleMp4: path.join(FIXTURES_DIR, 'video', 'sample.mp4'),
    sampleMov: path.join(FIXTURES_DIR, 'video', 'sample.mov'),
  },
  subtitles: {
    sampleSrt: path.join(FIXTURES_DIR, 'subtitles', 'sample.srt'),
    sampleVtt: path.join(FIXTURES_DIR, 'subtitles', 'sample.vtt'),
    sampleTxt: path.join(FIXTURES_DIR, 'subtitles', 'sample.txt'),
    malformedSrt: path.join(FIXTURES_DIR, 'subtitles', 'malformed.srt'),
    unicodeSrt: path.join(FIXTURES_DIR, 'subtitles', 'unicode.srt'),
  },
  pdf: {
    landscapeJpg: path.join(FIXTURES_DIR, 'pdf', 'landscape.jpg'),
    portraitJpg: path.join(FIXTURES_DIR, 'pdf', 'portrait.jpg'),
  },
};

// Verify all defined fixtures actually exist
function verifyFixtures() {
  const missing = [];
  for (const [category, items] of Object.entries(FIXTURES)) {
    for (const [key, filepath] of Object.entries(items)) {
      if (!fs.existsSync(filepath)) {
        missing.push(`${category}.${key} -> ${filepath}`);
      }
    }
  }
  return { valid: missing.length === 0, missing };
}

module.exports = {
  FIXTURES,
  FIXTURES_DIR,
  verifyFixtures,
};
