const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  const fixturesDir = path.resolve(__dirname);

  // 1. Transparent PNG (800x800 with circular alpha badge)
  const transparentSvg = `
    <svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
      <circle cx="400" cy="400" r="300" fill="#2563eb" fill-opacity="0.85"/>
      <rect x="250" y="320" width="300" height="160" rx="20" fill="#ffffff" fill-opacity="0.95"/>
      <text x="400" y="415" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#1e3a8a" text-anchor="middle">OFFICIAL</text>
      <circle cx="400" cy="400" r="280" fill="none" stroke="#60a5fa" stroke-width="8" stroke-dasharray="16 12"/>
    </svg>
  `;
  await sharp(Buffer.from(transparentSvg))
    .png()
    .toFile(path.join(fixturesDir, 'transparent_badge.png'));
  console.log('Created transparent_badge.png (800x800)');

  // 2. WebP image (1000x600 landscape)
  const webpSvg = `
    <svg width="1000" height="600" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="60%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#f0f9ff"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="600" fill="url(#sky)"/>
      <circle cx="200" cy="150" r="70" fill="#fbbf24"/>
      <path d="M0 600 L250 350 L450 480 L700 280 L1000 600 Z" fill="#059669"/>
      <path d="M200 600 L500 400 L750 500 L1000 380 L1000 600 Z" fill="#047857" opacity="0.8"/>
    </svg>
  `;
  await sharp(Buffer.from(webpSvg))
    .webp({ quality: 90 })
    .toFile(path.join(fixturesDir, 'sample.webp'));
  console.log('Created sample.webp (1000x600)');

  // 3. Special Filename: "my photo.jpg"
  fs.copyFileSync(path.join(fixturesDir, 'landscape.jpg'), path.join(fixturesDir, 'my photo.jpg'));
  console.log('Created "my photo.jpg"');

  // 4. Special Filename: "PHOTO.JPG"
  fs.copyFileSync(path.join(fixturesDir, 'portrait.jpg'), path.join(fixturesDir, 'PHOTO.JPG'));
  console.log('Created "PHOTO.JPG"');

  // 5. Special Filename: "旅行写真.png"
  await sharp(Buffer.from(transparentSvg))
    .png()
    .toFile(path.join(fixturesDir, '旅行写真.png'));
  console.log('Created "旅行写真.png"');

  // 6. Corrupted PNG
  fs.writeFileSync(path.join(fixturesDir, 'corrupted.png'), Buffer.from('NOT A REAL PNG FILE DATA AT ALL'));
  console.log('Created corrupted.png');

  console.log('All PDF test fixtures created successfully!');
})();
