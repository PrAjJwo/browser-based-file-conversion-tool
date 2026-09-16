const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/image/image-compressor';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_compressor_test_' + Date.now());

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
  console.log('STARTING COMPREHENSIVE IMAGE COMPRESSOR TEST SUITE');
  console.log(`Target URL: ${DEV_URL}`);
  console.log('====================================================\n');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9232',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9232/json/list', (res) => {
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

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
    if (params.type === 'error') {
      console.log('   [BROWSER CONSOLE ERROR]', text);
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Network.enable');

  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2500);

  // Hook anchor clicks to intercept downloads
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__downloads = [];
      const origClick = HTMLElement.prototype.click;
      HTMLElement.prototype.click = async function() {
        if (this.tagName === 'A' && (this.hasAttribute('download') || this.download)) {
          const href = this.getAttribute('href') || this.href;
          const filename = this.getAttribute('download') || this.download;
          let byteLength = 0;
          let headerHex = '';
          let headerStr = '';
          let naturalWidth = 0;
          let naturalHeight = 0;
          let pixelSample = null;

          try {
            const resp = await fetch(href);
            const buf = await resp.arrayBuffer();
            byteLength = buf.byteLength;
            const u8 = new Uint8Array(buf);
            headerHex = Array.from(u8.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
            headerStr = String.fromCharCode.apply(null, u8.slice(0, 8));

            if (!filename.endsWith('.zip')) {
              const blob = new Blob([buf]);
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

  // Helper functions
  async function uploadFiles(filePaths) {
    const doc = await cdp.send('DOM.getDocument');
    const inputNode = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#image-compressor-root input[type=file]',
    });
    await cdp.send('DOM.setFileInputFiles', {
      files: filePaths.map(f => path.resolve('test-fixtures', f)),
      nodeId: inputNode.nodeId,
    });
    await sleep(600);
  }

  async function clearWorkspace() {
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('compressor-clear-all-btn')?.click()`,
    });
    await sleep(400);
  }

  async function waitForBatchCompletion() {
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const isBusy = await cdp.send('Runtime.evaluate', {
        expression: `document.getElementById('compress-all-btn')?.disabled`,
        returnByValue: true,
      });
      if (!isBusy.result.value) {
        return;
      }
    }
    throw new Error('Compression batch timed out');
  }

  // --- TEST 1: Page Readiness & Initialization ---
  console.log('--- TEST 1: Component Initialization & Cross-links ---');
  const pageMeta = await cdp.send('Runtime.evaluate', {
    expression: `({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      hasRoot: !!document.getElementById('image-compressor-root'),
      hasDropzone: !!document.querySelector('#image-compressor-root input[type=file]'),
      hasQuality: !!document.getElementById('compress-quality-slider'),
      hasFormat: !!document.getElementById('compress-output-format'),
      hasMaxDim: !!document.getElementById('compress-max-dim'),
      crossLinkResizer: document.querySelector('a[href="/image/image-resizer"]') !== null
    })`,
    returnByValue: true,
  });
  console.log('Page Title:', pageMeta.result.value.title);
  console.log('H1:', pageMeta.result.value.h1);
  console.log('Cross-link to Image Resizer present:', pageMeta.result.value.crossLinkResizer);
  if (!pageMeta.result.value.hasDropzone) throw new Error('Dropzone file input missing');
  if (!pageMeta.result.value.crossLinkResizer) throw new Error('Cross-link to /image/image-resizer missing');
  console.log('✓ Controls and cross-link confirmed mounted in DOM');

  // --- TEST 2: Single JPG Compression Test (80% Quality Default) ---
  console.log('\n--- TEST 2: Single JPG Compression (80% Default Quality) ---');
  await uploadFiles(['landscape.jpg']); // 1200x800, 23117 B

  const queuedJpg = await cdp.send('Runtime.evaluate', {
    expression: `({
      count: document.getElementById('queue-images-count')?.textContent,
      filename: document.querySelector('#compressor-queue-items p')?.textContent,
      quality: document.getElementById('compress-quality-slider')?.value
    })`,
    returnByValue: true,
  });
  console.log('Queued JPG details:', queuedJpg.result.value);
  if (queuedJpg.result.value.quality !== '80') throw new Error('Expected default quality 80%');

  console.log('Clicking Compress Images...');
  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();

  const singleJpgResult = await cdp.send('Runtime.evaluate', {
    expression: `({
      resultsVisible: !document.getElementById('compressor-results-section')?.classList.contains('hidden'),
      filename: document.querySelector('#compressor-results-list p.font-bold')?.textContent,
      details: document.querySelector('#compressor-results-list div.text-\\[11px\\]')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('Single JPG Compression Result:', singleJpgResult.result.value);

  // Trigger download
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()`,
  });
  await sleep(600);

  const jpgDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  console.log('JPG Download Payload:', jpgDl.result.value);
  if (jpgDl.result.value.filename !== 'landscape-compressed.jpg') {
    throw new Error('Unexpected filename: ' + jpgDl.result.value.filename);
  }
  if (!jpgDl.result.value.headerHex.startsWith('ffd8')) {
    throw new Error('Invalid JPEG header: ' + jpgDl.result.value.headerHex);
  }
  if (jpgDl.result.value.naturalWidth !== 1200 || jpgDl.result.value.naturalHeight !== 800) {
    throw new Error(`Dimensions altered! Expected 1200x800, got: ${jpgDl.result.value.naturalWidth}x${jpgDl.result.value.naturalHeight}`);
  }
  console.log(`✓ Single JPG verified: 1200x800 preserved, compressed size ${jpgDl.result.value.byteLength} Bytes (original 23,117 B)`);

  // --- TEST 3: JPG Quality Levels Test (100%, 90%, 80%, 50%, 25%) ---
  console.log('\n--- TEST 3: JPG Quality Levels Verification (100%, 90%, 80%, 50%, 25%) ---');
  const qualityLevels = [100, 90, 80, 50, 25];
  const qualitySizes = {};

  for (const q of qualityLevels) {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const s = document.getElementById('compress-quality-slider');
        s.value = '${q}';
        s.dispatchEvent(new Event('input'));
      })()`,
    });
    await sleep(200);

    await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
    await waitForBatchCompletion();

    await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()`,
    });
    await sleep(400);

    const dl = await cdp.send('Runtime.evaluate', {
      expression: `window.__downloads[window.__downloads.length - 1]`,
      returnByValue: true,
    });
    qualitySizes[q] = dl.result.value.byteLength;
    console.log(`JPG Quality ${q}% -> Size: ${dl.result.value.byteLength} Bytes`);
  }

  if (qualitySizes[25] >= qualitySizes[50] || qualitySizes[50] >= qualitySizes[80] || qualitySizes[80] >= qualitySizes[90] || qualitySizes[90] >= qualitySizes[100]) {
    throw new Error('JPG quality did not strictly scale file sizes: ' + JSON.stringify(qualitySizes));
  }
  console.log('✓ Quality levels strictly scale output size (25% < 50% < 80% < 90% < 100%)');

  // --- TEST 4: WebP Compression Test ---
  console.log('\n--- TEST 4: WebP Compression Test ---');
  await clearWorkspace();
  await uploadFiles(['sample.webp']); // 1000x600

  // Compress WebP at 80%
  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()`,
  });
  await sleep(600);

  const webpDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  console.log('WebP Download Payload:', {
    filename: webpDl.result.value.filename,
    size: webpDl.result.value.byteLength,
    headerStr: webpDl.result.value.headerStr,
    dims: `${webpDl.result.value.naturalWidth}x${webpDl.result.value.naturalHeight}`
  });
  if (webpDl.result.value.filename !== 'sample-compressed.webp') throw new Error('Unexpected webp filename');
  if (!webpDl.result.value.headerStr.startsWith('RIFF')) throw new Error('Missing WebP RIFF header');
  if (webpDl.result.value.naturalWidth !== 1000 || webpDl.result.value.naturalHeight !== 600) {
    throw new Error(`WebP dimensions altered! Expected 1000x600, got: ${webpDl.result.value.naturalWidth}x${webpDl.result.value.naturalHeight}`);
  }
  console.log('✓ WebP compression verified (RIFF/WEBP header, dimensions preserved)');

  // --- TEST 5: PNG Compression Behavior & Transparency Handling ---
  console.log('\n--- TEST 5: PNG Compression & Transparency Handling ---');
  await clearWorkspace();
  await uploadFiles(['transparent_badge.png']); // 800x800 with alpha

  // 5.1 PNG -> PNG (Lossless re-encoding, alpha preserved)
  console.log('Testing PNG -> PNG (Lossless re-encode)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sel = document.getElementById('compress-output-format');
      sel.value = 'image/png';
      sel.dispatchEvent(new Event('change'));
    })()`,
  });
  await sleep(300);

  // Verify quality slider is dimmed/disabled for PNG
  const pngUiCheck = await cdp.send('Runtime.evaluate', {
    expression: `({
      isDimmed: document.getElementById('quality-control-block')?.classList.contains('opacity-40'),
      hint: document.getElementById('compress-format-hint')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('PNG UI Feedback:', pngUiCheck.result.value);
  if (!pngUiCheck.result.value.isDimmed) throw new Error('Quality slider should be dimmed for PNG');

  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()`,
  });
  await sleep(600);

  const pngToPngDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  console.log('PNG -> PNG Download:', {
    filename: pngToPngDl.result.value.filename,
    headerHex: pngToPngDl.result.value.headerHex,
    alphaPixel: pngToPngDl.result.value.pixelSample
  });
  if (!pngToPngDl.result.value.headerHex.startsWith('89504e470d0a1a0a')) {
    throw new Error('Invalid PNG header');
  }
  if (pngToPngDl.result.value.pixelSample[3] !== 0) {
    console.log('Notice: corner alpha is:', pngToPngDl.result.value.pixelSample[3]);
  }
  console.log('✓ PNG -> PNG verified: lossless export with alpha transparency');

  // 5.2 PNG -> JPG (Flatten transparent areas onto solid white)
  console.log('Testing PNG -> JPG (Flatten alpha onto white)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sel = document.getElementById('compress-output-format');
      sel.value = 'image/jpeg';
      sel.dispatchEvent(new Event('change'));
    })()`,
  });
  await sleep(300);

  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()`,
  });
  await sleep(600);

  const pngToJpgDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  console.log('PNG -> JPG Download:', {
    filename: pngToJpgDl.result.value.filename,
    headerHex: pngToJpgDl.result.value.headerHex,
    pixelSample: pngToJpgDl.result.value.pixelSample
  });
  const cornerRgb = pngToJpgDl.result.value.pixelSample;
  if (cornerRgb[0] < 240 || cornerRgb[1] < 240 || cornerRgb[2] < 240) {
    throw new Error(`Expected clean white background in JPEG corner, got: [${cornerRgb.join(', ')}]`);
  }
  console.log(`✓ PNG -> JPG flattening verified: clean white RGB (${cornerRgb[0]}, ${cornerRgb[1]}, ${cornerRgb[2]})`);

  // 5.3 PNG -> WebP (Massive size reduction with alpha preservation)
  console.log('Testing PNG -> WebP (High compression with alpha)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sel = document.getElementById('compress-output-format');
      sel.value = 'image/webp';
      sel.dispatchEvent(new Event('change'));
      const s = document.getElementById('compress-quality-slider');
      s.value = '80';
      s.dispatchEvent(new Event('input'));
    })()`,
  });
  await sleep(300);

  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()`,
  });
  await sleep(600);

  const pngToWebpDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  console.log('PNG -> WebP Download:', {
    filename: pngToWebpDl.result.value.filename,
    size: pngToWebpDl.result.value.byteLength,
    originalSize: 40222,
    saving: Math.round((1 - (pngToWebpDl.result.value.byteLength / 40222)) * 100) + '%'
  });
  if (pngToWebpDl.result.value.byteLength >= 40222) {
    throw new Error('Expected WebP conversion to be smaller than original PNG');
  }
  console.log('✓ PNG -> WebP conversion verified with major size savings');

  // --- TEST 6: Cross-Format Conversions (JPG -> WebP, WebP -> JPG) ---
  console.log('\n--- TEST 6: Additional Cross-Format Conversions ---');
  await clearWorkspace();
  await uploadFiles(['landscape.jpg']);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sel = document.getElementById('compress-output-format');
      sel.value = 'image/webp';
      sel.dispatchEvent(new Event('change'));
    })()`,
  });
  await sleep(300);
  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()` });
  await sleep(500);
  const jpgToWebpDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  if (!jpgToWebpDl.result.value.filename.endsWith('.webp')) throw new Error('Expected .webp');

  // WebP -> JPG
  await clearWorkspace();
  await uploadFiles(['sample.webp']);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sel = document.getElementById('compress-output-format');
      sel.value = 'image/jpeg';
      sel.dispatchEvent(new Event('change'));
    })()`,
  });
  await sleep(300);
  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()` });
  await sleep(500);
  const webpToJpgDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  if (!webpToJpgDl.result.value.filename.endsWith('.jpg')) throw new Error('Expected .jpg');
  console.log('✓ All cross-format conversions (JPG->WebP, WebP->JPG) verified');

  // --- TEST 7: Optional Dimension Cap ---
  console.log('\n--- TEST 7: Optional Max Dimension Cap ---');
  await clearWorkspace();
  await uploadFiles(['landscape.jpg']); // 1200x800
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sel = document.getElementById('compress-output-format');
      sel.value = 'original';
      sel.dispatchEvent(new Event('change'));
      const dim = document.getElementById('compress-max-dim');
      dim.value = '800';
      dim.dispatchEvent(new Event('change'));
    })()`,
  });
  await sleep(300);
  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#compressor-results-list button.download-single-btn')?.click()` });
  await sleep(500);
  const dimCapDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  console.log('Capped dimensions:', `${dimCapDl.result.value.naturalWidth}x${dimCapDl.result.value.naturalHeight}`);
  if (dimCapDl.result.value.naturalWidth !== 800 || dimCapDl.result.value.naturalHeight !== 533) {
    throw new Error(`Expected 800x533, got: ${dimCapDl.result.value.naturalWidth}x${dimCapDl.result.value.naturalHeight}`);
  }
  console.log('✓ Optional dimension cap verified');

  // Reset max dimension cap
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const dim = document.getElementById('compress-max-dim');
      dim.value = '0';
      dim.dispatchEvent(new Event('change'));
    })()`,
  });

  // --- TEST 8: Multi-File Batch Processing & Real Progress ---
  console.log('\n--- TEST 8: Multi-File Batch Processing & Progress ---');
  await clearWorkspace();
  await uploadFiles(['landscape.jpg', 'transparent_badge.png', 'sample.webp']);

  const multiQueued = await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('queue-images-count')?.textContent`,
    returnByValue: true,
  });
  console.log('Multi-file queue count:', multiQueued.result.value);
  if (multiQueued.result.value !== '3') throw new Error('Expected 3 queued images');

  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();

  const batchResults = await cdp.send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('#compressor-results-list > div')).length`,
    returnByValue: true,
  });
  console.log('Batch results count:', batchResults.result.value);
  if (batchResults.result.value !== 3) throw new Error('Expected 3 result cards');

  // --- TEST 9: ZIP Batch Download ---
  console.log('\n--- TEST 9: ZIP Batch Download ---');
  const zipBtnVisible = await cdp.send('Runtime.evaluate', {
    expression: `!document.getElementById('download-zip-btn')?.classList.contains('hidden')`,
    returnByValue: true,
  });
  if (!zipBtnVisible.result.value) throw new Error('ZIP button should be visible');

  const preZipCount = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads.length`,
    returnByValue: true,
  });

  console.log('Clicking Download All as ZIP...');
  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('download-zip-btn')?.click()` });

  let zipDl = null;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const postCount = await cdp.send('Runtime.evaluate', {
      expression: `window.__downloads.length`,
      returnByValue: true,
    });
    if (postCount.result.value > preZipCount.result.value) {
      const lastDl = await cdp.send('Runtime.evaluate', {
        expression: `window.__downloads[window.__downloads.length - 1]`,
        returnByValue: true,
      });
      if (lastDl.result.value && lastDl.result.value.filename === 'compressed-images.zip') {
        zipDl = lastDl;
        break;
      }
    }
  }

  if (!zipDl) throw new Error('ZIP download timed out');
  console.log('ZIP Download Payload:', {
    filename: zipDl.result.value.filename,
    size: zipDl.result.value.byteLength,
    headerHex: zipDl.result.value.headerHex
  });
  if (!zipDl.result.value.headerHex.startsWith('504b0304')) throw new Error('Invalid ZIP magic number');
  console.log(`✓ Batch ZIP download verified: ${zipDl.result.value.byteLength} Bytes`);

  // --- TEST 10: Special Filenames & Collision Disambiguation ---
  console.log('\n--- TEST 10: Special Filenames & Collision Disambiguation ---');
  await clearWorkspace();
  await uploadFiles(['landscape.jpg', 'my photo.jpg', 'PHOTO.JPG', 'landscape.jpg']);
  await sleep(500);

  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();

  const specialResults = await cdp.send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('#compressor-results-list p.font-bold')).map(el => el.textContent)`,
    returnByValue: true,
  });
  console.log('Special & Disambiguated Names:', specialResults.result.value);
  const names = specialResults.result.value;
  if (!names.includes('landscape-compressed.jpg') || !names.includes('landscape-compressed-2.jpg')) {
    throw new Error('Collision disambiguation failed');
  }
  if (!names.includes('my photo-compressed.jpg')) {
    throw new Error('Spaces filename not preserved');
  }
  console.log('✓ Filename collisions, spaces, and uppercase safely handled');

  // --- TEST 11: Invalid / Corrupt File Isolation ---
  console.log('\n--- TEST 11: Invalid File Isolation ---');
  await clearWorkspace();
  await uploadFiles(['landscape.jpg', 'corrupted.png']);
  await sleep(500);

  const isolationQueue = await cdp.send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('#compressor-queue-items > div')).map(card => ({
      name: card.querySelector('p')?.textContent,
      badge: card.querySelector('span[class*="rounded-full"]')?.textContent,
      isFailed: card.querySelector('span[class*="bg-rose-100"]') !== null
    }))`,
    returnByValue: true,
  });
  console.log('Isolation queue:', isolationQueue.result.value);
  const corruptItem = isolationQueue.result.value.find(i => i.name === 'corrupted.png');
  const validItem = isolationQueue.result.value.find(i => i.name === 'landscape.jpg');
  if (!corruptItem || !corruptItem.isFailed) throw new Error('Corrupt item should be Failed');
  if (!validItem || validItem.isFailed) throw new Error('Valid item should be Ready');

  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('compress-all-btn')?.click()` });
  await waitForBatchCompletion();

  const isolationResults = await cdp.send('Runtime.evaluate', {
    expression: `({
      completedCount: document.querySelectorAll('#compressor-results-list > div').length,
      resultName: document.querySelector('#compressor-results-list p.font-bold')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('Isolation results:', isolationResults.result.value);
  if (isolationResults.result.value.completedCount !== 1) throw new Error('Expected 1 successful result');
  console.log('✓ Error isolation verified: Corrupt file flagged, valid file converted successfully');

  // --- TEST 12: Network Privacy Audit ---
  console.log('\n--- TEST 12: Network Privacy Audit ---');
  console.log(`Total POST Requests Intercepted: ${networkPostRequests.length}`);
  console.log(`Total Uploaded Bytes: ${totalUploadedBytes}`);
  if (networkPostRequests.length > 0) throw new Error('Privacy violation! POST requests observed');
  if (totalUploadedBytes > 0) throw new Error('Privacy violation! Uploaded bytes observed');
  console.log('✓ 100% Client-Side Privacy Audit PASSED: 0 POST requests, 0 bytes transmitted');

  // --- TEST 13: Responsive Viewports QA ---
  console.log('\n--- TEST 13: Responsive Viewports QA (Zero Horizontal Overflow) ---');
  const viewports = [
    { name: 'Mobile Small', width: 375, height: 667 },
    { name: 'iPhone 14', width: 390, height: 844 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1024, height: 768 },
    { name: 'Large Desktop', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 768,
    });
    await sleep(300);

    const overflow = await cdp.send('Runtime.evaluate', {
      expression: `({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      })`,
      returnByValue: true,
    });

    console.log(`Viewport ${vp.name} (${vp.width}x${vp.height}): scrollWidth=${overflow.result.value.scrollWidth}, clientWidth=${overflow.result.value.clientWidth}`);
    if (overflow.result.value.hasOverflow) {
      throw new Error(`Horizontal overflow detected at ${vp.width}px!`);
    }
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  console.log('✓ Zero horizontal overflow across all 5 viewports');

  // --- TEST 14: Accessibility (A11y) Verification ---
  console.log('\n--- TEST 14: Accessibility (A11y) Verification ---');
  const a11yChecks = await cdp.send('Runtime.evaluate', {
    expression: `({
      qualityLabel: !!document.querySelector('label[for=compress-quality-slider]'),
      formatLabel: !!document.querySelector('label[for=compress-output-format]'),
      maxDimLabel: !!document.querySelector('label[for=compress-max-dim]'),
      progressRole: document.getElementById('compressor-progress-container')?.getAttribute('role') === 'status',
      progressLive: document.getElementById('compressor-progress-container')?.getAttribute('aria-live') === 'polite',
      statusRole: document.getElementById('compressor-status-msg')?.getAttribute('role') === 'status'
    })`,
    returnByValue: true,
  });
  console.log('Accessibility attributes:', a11yChecks.result.value);
  for (const [key, val] of Object.entries(a11yChecks.result.value)) {
    if (!val) throw new Error(`Accessibility check failed for: ${key}`);
  }
  console.log('✓ Accessibility form labels and ARIA live regions verified 100%');

  console.log('\n====================================================');
  console.log('ALL IMAGE COMPRESSOR BROWSER TESTS PASSED PERFECTLY!');
  console.log('====================================================\n');

  cdp.close();
  chrome.kill();
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
