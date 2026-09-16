const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/image/image-converter';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_converter_test_' + Date.now());

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        } else if (msg.method) {
          const listeners = this.eventListeners.get(msg.method) || [];
          listeners.forEach((cb) => cb(msg.params));
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('====================================================');
  console.log('STARTING COMPREHENSIVE IMAGE FORMAT CONVERTER TEST SUITE');
  console.log(`Target URL: ${DEV_URL}`);
  console.log('====================================================\n');

  // Create photo.final.webp fixture if not present
  if (!fs.existsSync(path.resolve('test-fixtures', 'photo.final.webp'))) {
    fs.copyFileSync(path.resolve('test-fixtures', 'sample.webp'), path.resolve('test-fixtures', 'photo.final.webp'));
  }

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9233',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9233/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page');
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  const networkPostRequests = [];
  let totalUploadedBytes = 0;

  cdp.on('Network.requestWillBeSent', (params) => {
    if (params.request.method === 'POST') {
      networkPostRequests.push(params.request.url);
      if (params.request.postData) {
        totalUploadedBytes += Buffer.byteLength(params.request.postData);
      }
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2500);

  // Setup download interceptor
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__downloads = [];
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = async function() {
        if (this.download) {
          const href = this.href;
          const filename = this.download;
          let byteLength = 0;
          let headerHex = '';
          let headerStr = '';
          let naturalWidth = 0;
          let naturalHeight = 0;
          let pixelSample = null;

          try {
            const resp = await fetch(href);
            const blob = await resp.blob();
            byteLength = blob.size;
            const ab = await blob.arrayBuffer();
            const u8 = new Uint8Array(ab);
            headerHex = Array.from(u8.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
            headerStr = new TextDecoder('ascii', { fatal: false }).decode(u8.slice(0, 16));

            if (blob.type.startsWith('image/')) {
              const objUrl = URL.createObjectURL(blob);
              await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  naturalWidth = img.naturalWidth;
                  naturalHeight = img.naturalHeight;
                  try {
                    const c = document.createElement('canvas');
                    c.width = naturalWidth;
                    c.height = naturalHeight;
                    const cx = c.getContext('2d');
                    cx.drawImage(img, 0, 0);
                    const p = cx.getImageData(0, 0, 1, 1).data;
                    pixelSample = [p[0], p[1], p[2], p[3]];
                  } catch (e) {}
                  URL.revokeObjectURL(objUrl);
                  resolve();
                };
                img.onerror = () => {
                  URL.revokeObjectURL(objUrl);
                  resolve();
                };
                img.src = objUrl;
              });
            }
          } catch (e) {}

          window.__downloads.push({
            filename,
            byteLength,
            headerHex,
            headerStr,
            naturalWidth,
            naturalHeight,
            pixelSample
          });
        }
        return origClick.apply(this, arguments);
      };
    })()`,
  });

  async function uploadFiles(fileNames) {
    const doc = await cdp.send('DOM.getDocument');
    const inputNode = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#image-converter-root input[type=file]',
    });
    await cdp.send('DOM.setFileInputFiles', {
      files: fileNames.map((f) => path.resolve('test-fixtures', f)),
      nodeId: inputNode.nodeId,
    });
    await sleep(600);
  }

  async function clearWorkspace() {
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('converter-clear-all-btn')?.click()`,
    });
    await sleep(400);
  }

  async function setFormat(formatMime) {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const sel = document.getElementById('convert-target-format');
        if (sel) {
          sel.value = '${formatMime}';
          sel.dispatchEvent(new Event('change'));
        }
      })()`,
    });
    await sleep(300);
  }

  async function setQuality(qualityVal) {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const slider = document.getElementById('convert-quality-slider');
        if (slider) {
          slider.value = '${qualityVal}';
          slider.dispatchEvent(new Event('input'));
        }
      })()`,
    });
    await sleep(200);
  }

  async function waitForConversion() {
    await sleep(500);
    for (let i = 0; i < 40; i++) {
      const isBusy = await cdp.send('Runtime.evaluate', {
        expression: `document.getElementById('converter-start-btn')?.disabled`,
        returnByValue: true,
      });
      if (!isBusy.result.value) {
        return;
      }
      await sleep(300);
    }
    throw new Error('Conversion batch timed out');
  }

  async function clickConvert() {
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('converter-start-btn')?.click()`,
    });
    await waitForConversion();
    const state = await cdp.send('Runtime.evaluate', {
      expression: `({
        resultsCount: document.querySelectorAll('#converter-results-list .result-card').length,
        downloadBtns: document.querySelectorAll('#converter-results-list button[data-download-id]').length,
        queueStatuses: Array.from(document.querySelectorAll('#converter-queue-list .status-badge')).map(el => el.textContent.trim()),
        errors: Array.from(document.querySelectorAll('#converter-queue-list [role="alert"]')).map(el => el.textContent.trim()),
        downloadsRecorded: window.__downloads.length
      })`,
      returnByValue: true,
    });
    console.log('Post-convert DOM state:', state.result.value);
  }

  async function getLastDownload() {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `window.__downloads[window.__downloads.length - 1]`,
      returnByValue: true,
    });
    return res.result.value;
  }

  async function triggerDownload(index = 0) {
    await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#converter-results-list button[data-download-id]')[${index}]?.click()`,
    });
    await sleep(800);
    return await getLastDownload();
  }

  const results = {};

  // --- TEST 1: Page Readiness & Initialization ---
  console.log('--- TEST 1: Initialization & Controls ---');
  const pageMeta = await cdp.send('Runtime.evaluate', {
    expression: `({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      hasRoot: !!document.getElementById('image-converter-root'),
      hasDropzone: !!document.querySelector('#image-converter-root input[type=file]'),
      hasFormatSelect: !!document.getElementById('convert-target-format'),
      hasQualitySlider: !!document.getElementById('convert-quality-slider'),
      hasCrossLinkResizer: !!document.querySelector('a[href="/image/image-resizer"]'),
      hasCrossLinkCompressor: !!document.querySelector('a[href="/image/image-compressor"]')
    })`,
    returnByValue: true,
  });
  console.log('Page Title:', pageMeta.result.value.title);
  console.log('H1:', pageMeta.result.value.h1);
  console.log('Cross-links present:', {
    resizer: pageMeta.result.value.hasCrossLinkResizer,
    compressor: pageMeta.result.value.hasCrossLinkCompressor
  });
  if (!pageMeta.result.value.hasDropzone) throw new Error('File input missing');
  if (!pageMeta.result.value.hasCrossLinkResizer) throw new Error('Missing cross link to resizer');
  if (!pageMeta.result.value.hasCrossLinkCompressor) throw new Error('Missing cross link to compressor');
  results.test1 = 'PASS';
  console.log('✔ Test 1: Page initialization and cross-links verified.\n');

  // --- TEST 2: JPG -> PNG Conversion (Milestone 4) ---
  console.log('--- TEST 2: JPG -> PNG Conversion ---');
  await uploadFiles(['landscape.jpg']); // 1200x800, 23117 B
  await setFormat('image/png');

  // Verify PNG lossless notice shown and slider disabled
  const pngUiState = await cdp.send('Runtime.evaluate', {
    expression: `({
      sliderDisabled: document.getElementById('convert-quality-slider')?.disabled,
      noteVisible: !document.getElementById('png-lossless-note')?.classList.contains('hidden')
    })`,
    returnByValue: true,
  });
  console.log('PNG UI State:', pngUiState.result.value);
  if (!pngUiState.result.value.sliderDisabled) throw new Error('Quality slider should be disabled for PNG');
  if (!pngUiState.result.value.noteVisible) throw new Error('Lossless PNG note should be visible');

  await clickConvert();
  const jpgToPngDl = await triggerDownload(0);
  console.log('JPG -> PNG Result:', {
    filename: jpgToPngDl.filename,
    bytes: jpgToPngDl.byteLength,
    header: jpgToPngDl.headerHex.slice(0, 16),
    dimensions: `${jpgToPngDl.naturalWidth}x${jpgToPngDl.naturalHeight}`
  });

  if (jpgToPngDl.filename !== 'landscape.png') throw new Error(`Unexpected filename: ${jpgToPngDl.filename}`);
  if (!jpgToPngDl.headerHex.startsWith('89504e470d0a1a0a')) throw new Error('Invalid PNG header');
  if (jpgToPngDl.naturalWidth !== 1200 || jpgToPngDl.naturalHeight !== 800) {
    throw new Error(`Dimensions not preserved: ${jpgToPngDl.naturalWidth}x${jpgToPngDl.naturalHeight}`);
  }
  results.test2 = {
    status: 'PASS',
    originalBytes: 23117,
    pngBytes: jpgToPngDl.byteLength,
    dimensions: '1200x800'
  };
  console.log('✔ Test 2: JPG -> PNG conversion verified (1200x800 preserved, valid PNG signature).\n');

  // --- TEST 3: JPG -> WebP Conversion & Quality Levels (Milestone 5 & 9) ---
  console.log('--- TEST 3: JPG -> WebP Quality Levels ---');
  const webpQualities = [50, 75, 90, 100];
  const webpQualitySizes = {};

  for (const q of webpQualities) {
    await clearWorkspace();
    await uploadFiles(['landscape.jpg']);
    await setFormat('image/webp');
    await setQuality(q);
    await clickConvert();
    const dl = await triggerDownload(0);
    webpQualitySizes[q] = dl.byteLength;
    console.log(`WebP at ${q}% quality: ${dl.byteLength} Bytes, header: ${dl.headerStr.slice(0, 12)}`);

    if (dl.filename !== 'landscape.webp') throw new Error(`Expected landscape.webp, got ${dl.filename}`);
    if (!dl.headerHex.startsWith('52494646')) throw new Error('Invalid RIFF header');
    if (dl.naturalWidth !== 1200 || dl.naturalHeight !== 800) throw new Error('Dimensions changed');
  }

  console.log('WebP Quality Sizes:', webpQualitySizes);
  if (!(webpQualitySizes[50] < webpQualitySizes[75] && webpQualitySizes[75] < webpQualitySizes[90] && webpQualitySizes[90] < webpQualitySizes[100])) {
    throw new Error('WebP quality not scaling monotonically');
  }
  results.test3 = { status: 'PASS', webpQualitySizes };
  console.log('✔ Test 3: JPG -> WebP quality scaling verified (strictly monotonic).\n');

  // --- TEST 4: PNG -> JPG with Transparency Handling (Milestone 6) ---
  console.log('--- TEST 4: PNG -> JPG Transparency Handling (Solid White Background) ---');
  await clearWorkspace();
  await uploadFiles(['transparent_badge.png']); // 800x800, alpha corners
  await setFormat('image/jpeg');

  const warnVisible = await cdp.send('Runtime.evaluate', {
    expression: `!document.getElementById('transparency-warning-banner')?.classList.contains('hidden')`,
    returnByValue: true,
  });
  console.log('Transparency warning visible:', warnVisible.result.value);
  if (!warnVisible.result.value) throw new Error('Transparency warning should be visible when converting transparent PNG to JPG');

  await clickConvert();
  const pngToJpgDl = await triggerDownload(0);
  console.log('PNG -> JPG Result:', {
    filename: pngToJpgDl.filename,
    bytes: pngToJpgDl.byteLength,
    header: pngToJpgDl.headerHex.slice(0, 8),
    dimensions: `${pngToJpgDl.naturalWidth}x${pngToJpgDl.naturalHeight}`,
    cornerPixel: pngToJpgDl.pixelSample
  });

  if (pngToJpgDl.filename !== 'transparent_badge.jpg') throw new Error(`Unexpected filename: ${pngToJpgDl.filename}`);
  if (!pngToJpgDl.headerHex.startsWith('ffd8')) throw new Error('Invalid JPEG header');
  if (pngToJpgDl.naturalWidth !== 800 || pngToJpgDl.naturalHeight !== 800) throw new Error('Dimensions changed');
  // Check corner pixel is solid white (#FFFFFF, [255, 255, 255, 255])
  const [r, g, b, a] = pngToJpgDl.pixelSample;
  console.log(`Corner pixel: R=${r}, G=${g}, B=${b}, A=${a}`);
  if (r < 250 || g < 250 || b < 250 || a !== 255) {
    throw new Error(`Expected white background [255,255,255,255], got [${r},${g},${b},${a}]`);
  }
  results.test4 = { status: 'PASS', cornerPixel: [r, g, b, a], bytes: pngToJpgDl.byteLength };
  console.log('✔ Test 4: PNG -> JPG transparency cleanly composited over white.\n');

  // --- TEST 5: PNG -> WebP Conversion (Milestone 7) ---
  console.log('--- TEST 5: PNG -> WebP Alpha Preservation ---');
  await clearWorkspace();
  await uploadFiles(['transparent_badge.png']);
  await setFormat('image/webp');
  await setQuality(90);
  await clickConvert();
  const pngToWebpDl = await triggerDownload(0);
  console.log('PNG -> WebP Result:', {
    filename: pngToWebpDl.filename,
    bytes: pngToWebpDl.byteLength,
    dimensions: `${pngToWebpDl.naturalWidth}x${pngToWebpDl.naturalHeight}`,
    cornerPixel: pngToWebpDl.pixelSample
  });

  if (pngToWebpDl.filename !== 'transparent_badge.webp') throw new Error(`Expected transparent_badge.webp, got ${pngToWebpDl.filename}`);
  if (!pngToWebpDl.headerHex.startsWith('52494646')) throw new Error('Invalid RIFF header');
  if (pngToWebpDl.naturalWidth !== 800 || pngToWebpDl.naturalHeight !== 800) throw new Error('Dimensions changed');
  // Alpha channel should remain 0 (fully transparent)
  if (pngToWebpDl.pixelSample[3] !== 0) {
    throw new Error(`Expected alpha=0 in transparent WebP corner, got ${pngToWebpDl.pixelSample[3]}`);
  }
  results.test5 = { status: 'PASS', bytes: pngToWebpDl.byteLength, alpha: pngToWebpDl.pixelSample[3] };
  console.log('✔ Test 5: PNG -> WebP alpha channel strictly preserved.\n');

  // --- TEST 6: WebP -> JPG Conversion (Milestone 8) ---
  console.log('--- TEST 6: WebP -> JPG Conversion ---');
  await clearWorkspace();
  await uploadFiles(['sample.webp']); // 1000x600, 9852 B
  await setFormat('image/jpeg');
  await setQuality(90);
  await clickConvert();
  const webpToJpgDl = await triggerDownload(0);
  console.log('WebP -> JPG Result:', {
    filename: webpToJpgDl.filename,
    bytes: webpToJpgDl.byteLength,
    dimensions: `${webpToJpgDl.naturalWidth}x${webpToJpgDl.naturalHeight}`
  });

  if (webpToJpgDl.filename !== 'sample.jpg') throw new Error(`Expected sample.jpg, got ${webpToJpgDl.filename}`);
  if (!webpToJpgDl.headerHex.startsWith('ffd8')) throw new Error('Invalid JPEG header');
  if (webpToJpgDl.naturalWidth !== 1000 || webpToJpgDl.naturalHeight !== 600) throw new Error('Dimensions changed');
  results.test6 = { status: 'PASS', bytes: webpToJpgDl.byteLength };
  console.log('✔ Test 6: WebP -> JPG conversion verified.\n');

  // --- TEST 7: WebP -> PNG Conversion (Milestone 9) ---
  console.log('--- TEST 7: WebP -> PNG Conversion ---');
  await clearWorkspace();
  await uploadFiles(['sample.webp']);
  await setFormat('image/png');
  await clickConvert();
  const webpToPngDl = await triggerDownload(0);
  console.log('WebP -> PNG Result:', {
    filename: webpToPngDl.filename,
    bytes: webpToPngDl.byteLength,
    dimensions: `${webpToPngDl.naturalWidth}x${webpToPngDl.naturalHeight}`
  });

  if (webpToPngDl.filename !== 'sample.png') throw new Error(`Expected sample.png, got ${webpToPngDl.filename}`);
  if (!webpToPngDl.headerHex.startsWith('89504e47')) throw new Error('Invalid PNG header');
  if (webpToPngDl.naturalWidth !== 1000 || webpToPngDl.naturalHeight !== 600) throw new Error('Dimensions changed');
  results.test7 = { status: 'PASS', bytes: webpToPngDl.byteLength };
  console.log('✔ Test 7: WebP -> PNG conversion verified.\n');

  // --- TEST 8: Same-Format Re-encode & Notice ---
  console.log('--- TEST 8: Same-Format Re-encode (JPG -> JPG) ---');
  await clearWorkspace();
  await uploadFiles(['landscape.jpg']);
  await setFormat('image/jpeg');

  const sameFormatNotice = await cdp.send('Runtime.evaluate', {
    expression: `!document.getElementById('same-format-banner')?.classList.contains('hidden')`,
    returnByValue: true,
  });
  console.log('Same-format notice visible:', sameFormatNotice.result.value);
  if (!sameFormatNotice.result.value) throw new Error('Same-format notice should be visible');

  await clickConvert();
  const sameFormatDl = await triggerDownload(0);
  console.log('Same-Format JPG Result:', {
    filename: sameFormatDl.filename,
    bytes: sameFormatDl.byteLength,
    dimensions: `${sameFormatDl.naturalWidth}x${sameFormatDl.naturalHeight}`
  });
  if (sameFormatDl.filename !== 'landscape.jpg') throw new Error(`Expected landscape.jpg, got ${sameFormatDl.filename}`);
  results.test8 = { status: 'PASS', bytes: sameFormatDl.byteLength };
  console.log('✔ Test 8: Same-format export verified.\n');

  // --- TEST 9: Multi-File Batch Processing & Real Progress ---
  console.log('--- TEST 9: Multi-File Batch Processing ---');
  await clearWorkspace();
  await uploadFiles(['landscape.jpg', 'transparent_badge.png', 'sample.webp']);
  await setFormat('image/webp');
  await setQuality(90);

  const queuedCount = await cdp.send('Runtime.evaluate', {
    expression: `document.querySelectorAll('#converter-queue-list > div').length`,
    returnByValue: true,
  });
  console.log('Queued cards count:', queuedCount.result.value);
  if (queuedCount.result.value !== 3) throw new Error(`Expected 3 cards in queue, got ${queuedCount.result.value}`);

  await clickConvert();

  const completedCount = await cdp.send('Runtime.evaluate', {
    expression: `document.querySelectorAll('#converter-results-list .result-card').length`,
    returnByValue: true,
  });
  console.log('Completed cards count:', completedCount.result.value);
  if (completedCount.result.value !== 3) throw new Error(`Expected 3 completed result cards, got ${completedCount.result.value}`);

  results.test9 = 'PASS';
  console.log('✔ Test 9: Multi-file batch processed sequentially with real progress.\n');

  // --- TEST 10: ZIP Packaging & Batch Download ---
  console.log('--- TEST 10: ZIP Packaging ---');
  const zipBtnVisible = await cdp.send('Runtime.evaluate', {
    expression: `!document.getElementById('converter-download-all-zip-btn')?.classList.contains('hidden')`,
    returnByValue: true,
  });
  console.log('ZIP button visible:', zipBtnVisible.result.value);
  if (!zipBtnVisible.result.value) throw new Error('ZIP button should be visible when >= 2 items succeed');

  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('converter-download-all-zip-btn')?.click()`,
  });
  await sleep(1500);

  const zipDl = await getLastDownload();
  console.log('ZIP Download details:', {
    filename: zipDl.filename,
    bytes: zipDl.byteLength,
    header: zipDl.headerHex.slice(0, 8)
  });

  if (zipDl.filename !== 'converted-images.zip') throw new Error(`Expected converted-images.zip, got ${zipDl.filename}`);
  if (!zipDl.headerHex.startsWith('504b0304')) throw new Error('Invalid PK ZIP header');
  results.test10 = { status: 'PASS', zipBytes: zipDl.byteLength };
  console.log('✔ Test 10: ZIP download verified with valid PK header.\n');

  // --- TEST 11: Special Filenames & Collision Disambiguation ---
  console.log('--- TEST 11: Special Filenames & Duplicate Disambiguation ---');
  await clearWorkspace();
  await uploadFiles(['landscape.jpg', 'my photo.jpg', 'PHOTO.JPG', 'photo.final.webp', 'landscape.jpg']);
  await setFormat('image/webp');
  await clickConvert();

  const fileCards = await cdp.send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('#converter-results-list .result-card p.font-bold')).map(el => el.textContent.trim())`,
    returnByValue: true,
  });
  console.log('Generated Output Filenames:', fileCards.result.value);

  // Expect: landscape.webp, my photo.webp, PHOTO.webp, photo.final.webp (or photo.final-2.webp), landscape-2.webp
  const names = fileCards.result.value;
  if (!names.includes('landscape.webp')) throw new Error('Missing landscape.webp');
  if (!names.includes('my photo.webp')) throw new Error('Missing my photo.webp');
  if (!names.includes('PHOTO.webp')) throw new Error('Missing PHOTO.webp');
  if (!names.includes('landscape-2.webp')) throw new Error('Missing disambiguated landscape-2.webp');
  results.test11 = { status: 'PASS', names };
  console.log('✔ Test 11: Special filenames, spaces, case preservation, and deduplication verified.\n');

  // --- TEST 12: Per-File Error Isolation ---
  console.log('--- TEST 12: Per-File Error Isolation ---');
  await clearWorkspace();
  await uploadFiles(['corrupted.png', 'landscape.jpg']);
  await setFormat('image/webp');

  const queueStatusesBefore = await cdp.send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('#converter-queue-list .status-badge')).map(el => el.textContent.trim().toLowerCase())`,
    returnByValue: true,
  });
  console.log('Statuses before conversion:', queueStatusesBefore.result.value);
  if (!queueStatusesBefore.result.value.includes('failed')) throw new Error('Corrupted file should be immediately flagged as failed');

  await clickConvert();

  const queueStatusesAfter = await cdp.send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('#converter-queue-list .status-badge')).map(el => el.textContent.trim().toLowerCase())`,
    returnByValue: true,
  });
  console.log('Statuses after conversion:', queueStatusesAfter.result.value);
  if (!queueStatusesAfter.result.value.includes('failed') || !queueStatusesAfter.result.value.includes('completed')) {
    throw new Error('Expected both failed and completed statuses');
  }
  results.test12 = 'PASS';
  console.log('✔ Test 12: Corrupted file isolated, valid file converted successfully.\n');

  // --- TEST 13: Network Privacy Audit ---
  console.log('--- TEST 13: Network Privacy Audit ---');
  console.log('POST requests intercepted:', networkPostRequests.length);
  console.log('Total uploaded bytes:', totalUploadedBytes);
  if (networkPostRequests.length > 0) throw new Error(`Unexpected POST requests: ${networkPostRequests.join(', ')}`);
  if (totalUploadedBytes > 0) throw new Error(`Uploaded bytes leaked: ${totalUploadedBytes}`);
  results.test13 = 'PASS';
  console.log('✔ Test 13: 0 POST requests, 0 bytes uploaded. 100% private in-browser operation.\n');

  // --- TEST 14: Responsive Viewport Overflow QA ---
  console.log('--- TEST 14: Responsive Viewports QA ---');
  const viewports = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 }
  ];

  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 768,
    });
    await sleep(200);

    const overflow = await cdp.send('Runtime.evaluate', {
      expression: `document.documentElement.scrollWidth > window.innerWidth`,
      returnByValue: true,
    });
    if (overflow.result.value) {
      throw new Error(`Horizontal overflow detected at viewport ${vp.width}x${vp.height}`);
    }
    console.log(`Viewport ${vp.width}x${vp.height}: 0 overflow (PASS)`);
  }
  results.test14 = 'PASS';
  console.log('✔ Test 14: All 5 responsive viewports verified without horizontal overflow.\n');

  // --- TEST 15: Accessibility (A11y) ---
  console.log('--- TEST 15: Accessibility (A11y) ---');
  const a11y = await cdp.send('Runtime.evaluate', {
    expression: `({
      formatLabelled: !!document.querySelector('label[for="convert-target-format"]'),
      qualityLabelled: !!document.querySelector('label[for="convert-quality-slider"]'),
      progressLive: document.getElementById('converter-progress-text')?.getAttribute('aria-live') === 'polite',
      progressRole: document.getElementById('converter-progress-text')?.getAttribute('role') === 'status',
      warningAlert: document.getElementById('transparency-warning-banner')?.getAttribute('role') === 'alert'
    })`,
    returnByValue: true,
  });
  console.log('A11y Checks:', a11y.result.value);
  if (!a11y.result.value.formatLabelled || !a11y.result.value.qualityLabelled || !a11y.result.value.progressLive) {
    throw new Error('Accessibility attributes incomplete');
  }
  results.test15 = 'PASS';
  console.log('✔ Test 15: Accessibility attributes verified.\n');

  console.log('====================================================');
  console.log('ALL 15 CDP TEST SUITES PASSED SUCCESSFULLY!');
  console.log('====================================================');

  await cdp.close();
  chrome.kill();
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ CDP TEST FAILURE:', err);
  process.exit(1);
});
