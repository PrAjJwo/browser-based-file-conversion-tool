const { execSync } = require('child_process');
const path = require('path');
const http = require('http');

const { getAllAppRoutes } = require('./helpers/routes.cjs');
const { crawlInternalLinks } = require('./helpers/link-crawler.cjs');
const { QAReporter, colors } = require('./helpers/reporter.cjs');
const { BrowserSession, sleep } = require('./helpers/cdp.cjs');
const { FIXTURES } = require('../test-fixtures/index.cjs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');

async function checkRouteHttp(urlPath) {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}${urlPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          html: data,
          headers: res.headers,
          ok: res.statusCode === 200,
        });
      });
    });
    req.on('error', (err) => resolve({ statusCode: 0, html: '', ok: false, error: err }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ statusCode: 408, html: '', ok: false, error: new Error('Timeout') });
    });
  });
}

(async () => {
  console.log('\n======================================================================');
  console.log('  PUREFILE MASTER QA SYSTEM — FULL AUTOMATED VERIFICATION SUITE');
  console.log('======================================================================\n');

  const reporter = new QAReporter('PureFile Master QA');
  const allRoutes = getAllAppRoutes();

  // -------------------------------------------------------------------------
  // 1. ROUTE & SEO INTEGRITY AUDIT
  // -------------------------------------------------------------------------
  console.log(`\n${colors.bold}[PHASE 1/7] Auditing Routes & SEO Metadata (${allRoutes.length} pages)...${colors.reset}`);

  for (const route of allRoutes) {
    const res = await checkRouteHttp(route);
    const hasTitle = /<title>[^<]+<\/title>/i.test(res.html);
    const hasDesc = /<meta\s+name=["']description["']/i.test(res.html);

    if (res.ok && hasTitle && hasDesc) {
      reporter.addResult(`Route & SEO: ${route}`, 'PASS', { info: '200 OK • Title & Meta present' });
    } else {
      reporter.addResult(`Route & SEO: ${route}`, 'FAIL', {
        tool: `Route ${route}`,
        test: 'HTTP 200 and SEO Metadata',
        expected: 'Status 200, <title> tag, and <meta description>',
        actual: `Status: ${res.statusCode}, Title: ${hasTitle}, Meta: ${hasDesc}`,
        suggestedFile: route === '/' ? 'src/pages/index.astro' : 'src/pages/[category]/[tool].astro',
      });
    }
  }

  // -------------------------------------------------------------------------
  // 1.5. INTERNAL LINK INTEGRITY CRAWLER
  // -------------------------------------------------------------------------
  console.log(`\n${colors.bold}[PHASE 2/7] Crawling Internal Links (0 Broken Links Requirement)...${colors.reset}`);
  const crawlResult = await crawlInternalLinks(BASE_URL, ['/']);
  reporter.addResult('Internal Link Crawler (0 Broken Links)', crawlResult.ok ? 'PASS' : 'FAIL', {
    tool: 'Site Crawler',
    test: 'Internal Link Verification',
    info: crawlResult.ok ? `${crawlResult.totalChecked} pages crawled • 0 broken links` : `${crawlResult.brokenLinks.length} broken links found`,
    expected: '0 broken internal links (all HTTP 200)',
    actual: crawlResult.ok ? '0 broken links' : JSON.stringify(crawlResult.brokenLinks),
    suggestedFile: 'src/components/Footer.astro',
  });

  // -------------------------------------------------------------------------
  // 2. REAL-BROWSER ACTIVE CONVERTER WORKFLOW AUDIT (9/9 TOOLS)
  // -------------------------------------------------------------------------
  console.log(`\n${colors.bold}[PHASE 3/7] Real-Browser End-to-End Converter Workflows (9 Tools)...${colors.reset}`);

  const browser = new BrowserSession(9249);
  await browser.start();

  try {
    // 2.1 HEIC to JPG
    console.log('  Testing HEIC to JPG Converter...');
    await browser.navigate(`${BASE_URL}/image/heic-to-jpg`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.heic.autumnHeic]);
    await sleep(600);
    await browser.evaluate(`document.getElementById('start-convert-btn').click()`);
    let t1Done = false;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const hasResults = await browser.evaluate(`(() => {
        const res = document.querySelector('#results-list');
        return res && res.children.length > 0;
      })()`);
      if (hasResults) {
        t1Done = true;
        break;
      }
    }
    if (t1Done) {
      await browser.evaluate(`document.querySelector('#results-list button').click()`);
      await sleep(500);
    }
    const t1Header = await browser.getLastDownloadHeader();
    const t1Pass = t1Done && t1Header && t1Header.hex.startsWith('ff d8 ff');
    reporter.addResult('HEIC to JPG Converter', t1Pass ? 'PASS' : 'FAIL', {
      tool: 'HEIC to JPG Converter',
      test: 'Conversion, Preview & JPEG Signature',
      info: t1Pass ? `Signature: ${t1Header.hex.slice(0, 11)} (Valid JPEG)` : null,
      expected: 'JPEG binary signature (FF D8 FF)',
      actual: t1Header ? t1Header.hex : 'No download captured',
      suggestedFile: 'src/components/tools/HeicToJpgTool.astro',
    });

    // 2.2 JPG to HEIC
    console.log('  Testing JPG to HEIC Converter...');
    await browser.navigate(`${BASE_URL}/image/jpg-to-heic`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.images.landscapeJpg]);
    await sleep(600);
    await browser.evaluate(`document.getElementById('start-convert-btn').click()`);
    let t2Done = false;
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const hasResults = await browser.evaluate(`(() => {
        const res = document.querySelector('#results-list');
        return res && res.children.length > 0;
      })()`);
      if (hasResults) {
        t2Done = true;
        break;
      }
    }
    if (t2Done) {
      await browser.evaluate(`document.querySelector('#results-list button').click()`);
      await sleep(500);
    }
    const t2Header = await browser.getLastDownloadHeader();
    const t2Pass = t2Done && t2Header && (t2Header.ascii.includes('ftyp') || t2Header.ascii.includes('heic'));
    reporter.addResult('JPG to HEIC Converter', t2Pass ? 'PASS' : 'FAIL', {
      tool: 'JPG to HEIC Converter',
      test: 'HEIC Encoding & ISO Container Signature',
      info: t2Pass ? `Container Header: ${t2Header.ascii.slice(4, 12)} (Valid HEIC)` : null,
      expected: 'HEIC container header (ftypheic)',
      actual: t2Header ? t2Header.ascii : 'No download captured',
      suggestedFile: 'src/components/tools/JpgToHeicTool.astro',
    });

    // 2.3 WebP, PNG & JPG Converter
    console.log('  Testing Image Format Converter...');
    await browser.navigate(`${BASE_URL}/image/image-converter`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.images.transparentBadgePng]);
    await sleep(600);
    await browser.evaluate(`(() => {
      const fmt = document.getElementById('convert-target-format');
      fmt.value = 'image/webp';
      fmt.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('converter-start-btn').click();
    })()`);
    await sleep(2500);
    await browser.evaluate(`document.querySelector('#converter-results-list button[data-download-id]').click()`);
    await sleep(300);
    const t3Header = await browser.getLastDownloadHeader();
    const t3Pass = t3Header && t3Header.ascii.includes('WEBP');
    reporter.addResult('Image Format Converter', t3Pass ? 'PASS' : 'FAIL', {
      tool: 'Image Format Converter',
      test: 'Format Conversion & WebP Header',
      info: t3Pass ? `Header: ${t3Header.ascii.slice(0, 16)} (Valid WebP)` : null,
      expected: 'WebP binary header (RIFF...WEBP)',
      actual: t3Header ? t3Header.ascii : 'No download captured',
      suggestedFile: 'src/components/tools/ImageConverterTool.astro',
    });

    // 2.4 Image Resizer
    console.log('  Testing Image Resizer...');
    await browser.navigate(`${BASE_URL}/image/image-resizer`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.images.landscapeJpg]);
    await sleep(600);
    await browser.evaluate(`(() => {
      const w = document.getElementById('resize-width-input');
      w.value = '500';
      w.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('resize-all-btn').click();
    })()`);
    await sleep(2500);
    const t4Dims = await browser.evaluate(`(() => {
      const img = document.querySelector('#resizer-results-list img');
      return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    })()`);
    await browser.evaluate(`document.querySelector('#resizer-results-list .download-single-btn').click()`);
    await sleep(300);
    const t4Header = await browser.getLastDownloadHeader();
    const t4Pass = t4Dims && t4Dims.w === 500 && t4Header && t4Header.hex.startsWith('ff d8 ff');
    reporter.addResult('Image Resizer', t4Pass ? 'PASS' : 'FAIL', {
      tool: 'Image Resizer',
      test: 'Exact Dimension Scaling & Output Download',
      info: t4Pass ? `Output Dimensions: ${t4Dims.w}×${t4Dims.h} px (Exact)` : null,
      expected: 'Scaled dimensions 500×333 px and valid JPEG',
      actual: t4Dims ? `${t4Dims.w}×${t4Dims.h} px` : 'Dimension reading failed',
      suggestedFile: 'src/components/tools/ImageResizerTool.astro',
    });

    // 2.5 Image Compressor
    console.log('  Testing Image Compressor...');
    await browser.navigate(`${BASE_URL}/image/image-compressor`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.images.largePhotoJpg]);
    await sleep(600);
    await browser.evaluate(`document.getElementById('compress-all-btn').click()`);
    await sleep(2500);
    const t5Savings = await browser.evaluate(`(() => {
      const badge = document.querySelector('#compressor-results-list .bg-emerald-50, #compressor-results-list [class*="emerald"]');
      return badge ? badge.innerText.trim() : '';
    })()`);
    await browser.evaluate(`document.querySelector('#compressor-results-list .download-single-btn').click()`);
    await sleep(300);
    const t5Header = await browser.getLastDownloadHeader();
    const t5Pass = t5Savings && t5Savings.includes('smaller') && t5Header && t5Header.hex.startsWith('ff d8 ff');
    reporter.addResult('Image Compressor', t5Pass ? 'PASS' : 'FAIL', {
      tool: 'Image Compressor',
      test: 'Compression Reduction & Savings Badge',
      info: t5Pass ? `Savings: ${t5Savings}` : null,
      expected: 'Verified size reduction and valid JPEG',
      actual: t5Savings || 'No savings reported',
      suggestedFile: 'src/components/tools/ImageCompressorTool.astro',
    });

    // 2.6 Social Media Image Resizer
    console.log('  Testing Social Media Image Resizer & Multi-Preset ZIP...');
    await browser.navigate(`${BASE_URL}/image/social-resizer`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.images.landscapeJpg]);
    await sleep(600);
    await browser.evaluate(`document.getElementById('export-selected-btn').click()`);
    await sleep(3000);
    // Click ZIP download button
    await browser.evaluate(`document.getElementById('social-download-zip-btn').click()`);
    await sleep(500);
    const t6ZipHeader = await browser.getLastDownloadHeader();
    const t6Pass = t6ZipHeader && t6ZipHeader.hex.startsWith('50 4b 03 04');
    reporter.addResult('Social Media Resizer & ZIP Export', t6Pass ? 'PASS' : 'FAIL', {
      tool: 'Social Media Image Resizer',
      test: 'Multi-Preset Rendering & PK ZIP Packaging',
      info: t6Pass ? `ZIP Signature: ${t6ZipHeader.hex.slice(0, 11)} (PK Archive)` : null,
      expected: 'Valid ZIP magic header (50 4B 03 04)',
      actual: t6ZipHeader ? t6ZipHeader.hex : 'No download captured',
      suggestedFile: 'src/components/tools/SocialImageResizerTool.astro',
    });

    // 2.7 Video Compressor
    console.log('  Testing Video Compressor...');
    await browser.navigate(`${BASE_URL}/video/video-compressor`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.video.sampleMp4]);
    await sleep(800);
    await browser.evaluate(`(() => {
      const inp = document.getElementById('target-size-input');
      inp.value = '0.2';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('start-compress-btn').click();
    })()`);
    let t7Done = false;
    for (let i = 0; i < 40; i++) {
      await sleep(1000);
      const isComplete = await browser.evaluate(`(() => {
        const card = document.getElementById('video-result-card');
        return card && !card.classList.contains('hidden');
      })()`);
      if (isComplete) {
        t7Done = true;
        break;
      }
    }
    await browser.evaluate(`document.getElementById('download-video-btn').click()`);
    await sleep(300);
    const t7Header = await browser.getLastDownloadHeader();
    const t7Pass = t7Done && t7Header && (t7Header.ascii.includes('ftyp') || t7Header.ascii.includes('isom'));
    reporter.addResult('Video Compressor', t7Pass ? 'PASS' : 'FAIL', {
      tool: 'Video Compressor',
      test: 'WASM Transcoding & MP4 Header',
      info: t7Pass ? `MP4 Header: ${t7Header.ascii.slice(4, 12)} (Valid MP4)` : null,
      expected: 'MP4 ISO container header (ftypisom)',
      actual: t7Header ? t7Header.ascii : 'Timeout or transcode failure',
      suggestedFile: 'src/components/tools/VideoCompressorTool.astro',
    });

    // 2.8 Image to PDF
    console.log('  Testing Image to PDF Converter...');
    await browser.navigate(`${BASE_URL}/pdf/image-to-pdf`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.pdf.landscapeJpg, FIXTURES.pdf.portraitJpg]);
    await sleep(600);
    await browser.evaluate(`document.getElementById('start-pdf-btn').click()`);
    await sleep(2500);
    await browser.evaluate(`document.getElementById('pdf-download-btn').click()`);
    await sleep(300);
    const t8Header = await browser.getLastDownloadHeader();
    const t8Pass = t8Header && t8Header.ascii.startsWith('%PDF');
    reporter.addResult('Image to PDF Converter', t8Pass ? 'PASS' : 'FAIL', {
      tool: 'Image to PDF Converter',
      test: 'Multi-Page PDF Compilation & %PDF Header',
      info: t8Pass ? `PDF Version Header: ${t8Header.ascii.slice(0, 8)}` : null,
      expected: '%PDF header (%PDF-1.3)',
      actual: t8Header ? t8Header.ascii : 'No download captured',
      suggestedFile: 'src/components/tools/ImageToPdfTool.astro',
    });

    // 2.9 Subtitle Converter
    console.log('  Testing Subtitle Converter...');
    await browser.navigate(`${BASE_URL}/pdf/subtitle-converter`, 1500);
    await browser.setupDownloadHook();
    await browser.setFileInput('input[type="file"]', [FIXTURES.subtitles.sampleSrt]);
    await sleep(600);
    await browser.evaluate(`(() => {
      const fmt = document.getElementById('sub-target-format');
      fmt.value = 'vtt';
      fmt.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('sub-convert-btn').click();
    })()`);
    await sleep(1500);
    await browser.evaluate(`document.getElementById('sub-download-btn').click()`);
    await sleep(300);
    const t9Header = await browser.getLastDownloadHeader();
    const t9Pass = t9Header && t9Header.ascii.startsWith('WEBVTT');
    reporter.addResult('Subtitle Converter', t9Pass ? 'PASS' : 'FAIL', {
      tool: 'Subtitle Converter',
      test: 'SRT to WebVTT Conversion & WEBVTT Header',
      info: t9Pass ? `Magic Header: ${t9Header.ascii.slice(0, 6)} (Valid WebVTT)` : null,
      expected: 'WEBVTT header',
      actual: t9Header ? t9Header.ascii : 'No download captured',
      suggestedFile: 'src/components/tools/SubtitleConverterTool.astro',
    });
  } catch (err) {
    reporter.addResult('Browser Automation Flow', 'FAIL', {
      tool: 'Converter Suite',
      test: 'Real-Browser Execution',
      expected: 'All tools complete without exceptions',
      actual: err.message,
      suggestedFile: 'qa/qa-all.cjs',
      error: err,
    });
  }

  // -------------------------------------------------------------------------
  // 4. RESPONSIVE VIEWPORT & OVERFLOW AUDIT
  // -------------------------------------------------------------------------
  console.log(`\n${colors.bold}[PHASE 4/7] Auditing Responsive Viewports & Layout Integrity...${colors.reset}`);
  const viewports = [
    { name: 'Desktop Large', width: 1440, height: 900 },
    { name: 'Tablet iPad', width: 768, height: 1024 },
    { name: 'Mobile iPhone 15', width: 390, height: 844 },
    { name: 'Small Mobile', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    await browser.setViewport(vp.width, vp.height);
    await browser.navigate(`${BASE_URL}/`, 800);
    const hasOverflow = await browser.evaluate(`(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    })()`);

    reporter.addResult(`Viewport Layout: ${vp.name} (${vp.width}px)`, !hasOverflow ? 'PASS' : 'FAIL', {
      tool: 'Layout Engine',
      test: `Horizontal Overflow at ${vp.width}px`,
      info: !hasOverflow ? '0px horizontal overflow' : 'Horizontal overflow detected',
      expected: 'scrollWidth <= clientWidth',
      actual: hasOverflow ? 'Horizontal scrollbar created' : 'Clean layout',
      suggestedFile: 'src/layouts/BaseLayout.astro',
    });
  }

  // -------------------------------------------------------------------------
  // 5. VISUAL REGRESSION BASELINE CAPTURE
  // -------------------------------------------------------------------------
  console.log(`\n${colors.bold}[PHASE 5/7] Capturing Baseline QA Screenshots...${colors.reset}`);
  try {
    // Desktop Home
    await browser.setViewport(1440, 900);
    await browser.navigate(`${BASE_URL}/`, 1000);
    await browser.captureScreenshot(path.join(SCREENSHOTS_DIR, 'desktop', 'homepage.png'));

    // Mobile Home
    await browser.setViewport(390, 844);
    await browser.navigate(`${BASE_URL}/`, 1000);
    await browser.captureScreenshot(path.join(SCREENSHOTS_DIR, 'mobile', 'homepage.png'));

    // Category Hubs
    await browser.setViewport(1440, 900);
    await browser.navigate(`${BASE_URL}/image`, 1000);
    await browser.captureScreenshot(path.join(SCREENSHOTS_DIR, 'desktop', 'category-image.png'));

    await browser.navigate(`${BASE_URL}/video`, 1000);
    await browser.captureScreenshot(path.join(SCREENSHOTS_DIR, 'desktop', 'category-video.png'));

    await browser.navigate(`${BASE_URL}/pdf`, 1000);
    await browser.captureScreenshot(path.join(SCREENSHOTS_DIR, 'desktop', 'category-pdf.png'));

    reporter.addResult('Visual QA Baseline Screenshots', 'PASS', {
      info: '5 screenshots written to qa/screenshots/',
    });
  } catch (err) {
    reporter.addResult('Visual QA Baseline Screenshots', 'FAIL', {
      tool: 'Visual QA',
      test: 'Screenshot Capture',
      expected: 'PNG images saved to qa/screenshots/',
      actual: err.message,
      suggestedFile: 'qa/qa-all.cjs',
    });
  }

  await browser.close();

  // -------------------------------------------------------------------------
  // 6. ASTRO CHECK (TYPESCRIPT & TEMPLATE INTEGRITY)
  // -------------------------------------------------------------------------
  console.log(`\n${colors.bold}[PHASE 6/7] Running Astro Check (TypeScript + Template Lint)...${colors.reset}`);
  try {
    execSync('npx.cmd astro check', { stdio: 'pipe' });
    reporter.addResult('Astro Check (Type Integrity)', 'PASS', { info: '0 diagnostics / 0 errors' });
  } catch (err) {
    reporter.addResult('Astro Check (Type Integrity)', 'FAIL', {
      tool: 'TypeScript Compiler',
      test: 'Astro Check Diagnostics',
      expected: '0 diagnostic errors',
      actual: err.stdout ? err.stdout.toString() : err.message,
      suggestedFile: 'src/data/tools.ts',
    });
  }

  // -------------------------------------------------------------------------
  // 7. PRODUCTION BUILD VALIDATION
  // -------------------------------------------------------------------------
  console.log(`\n${colors.bold}[PHASE 7/7] Validating Astro Production Build (npm run build)...${colors.reset}`);
  try {
    const buildOutput = execSync('npm.cmd run build', { stdio: 'pipe' }).toString();
    const hasPages = buildOutput.includes('page(s) built') || buildOutput.includes('Complete!');
    if (!hasPages) throw new Error('Build output did not report completed pages');
    reporter.addResult('Production Build (npm run build)', 'PASS', {
      info: 'Clean static bundle generated in dist/',
    });
  } catch (err) {
    reporter.addResult('Production Build (npm run build)', 'FAIL', {
      tool: 'Astro Build Pipeline',
      test: 'Static Production Build',
      expected: 'Complete build with exit code 0',
      actual: err.stderr ? err.stderr.toString() : err.message,
      suggestedFile: 'astro.config.mjs',
    });
  }

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  const success = reporter.printSummary();
  process.exit(success ? 0 : 1);
})();
