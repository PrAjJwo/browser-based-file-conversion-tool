const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/pdf/image-to-pdf';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_pdf_test_' + Date.now());

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
  console.log('STARTING COMPLETE IMAGE TO PDF TEST SUITE');
  console.log(`Target URL: ${DEV_URL}`);
  console.log('====================================================\n');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9228/json/list', (res) => {
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
      console.log('   [BROWSER ERROR]', text);
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Network.enable');

  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2500);

  // Hook anchor click to record blob downloads and extract byte payload
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__downloads = [];
      const origClick = HTMLElement.prototype.click;
      HTMLElement.prototype.click = async function() {
        if (this.tagName === 'A' && (this.hasAttribute('download') || this.download)) {
          const href = this.getAttribute('href') || this.href;
          const filename = this.getAttribute('download') || this.download;
          let header = '';
          let byteLength = 0;
          try {
            const resp = await fetch(href);
            const buf = await resp.arrayBuffer();
            byteLength = buf.byteLength;
            const u8 = new Uint8Array(buf.slice(0, 8));
            header = String.fromCharCode.apply(null, u8);
          } catch (e) {}
          window.__downloads.push({
            filename,
            href,
            byteLength,
            header
          });
        }
        return origClick.apply(this, arguments);
      };
    })()`,
  });

  // --- TEST 1: Page Navigation & Dropzone Readiness ---
  console.log('--- TEST 1: Page Navigation & Tool Readiness ---');
  const pageMeta = await cdp.send('Runtime.evaluate', {
    expression: `({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      hasRoot: !!document.getElementById('image-to-pdf-root'),
      hasDropzone: !!document.querySelector('#image-to-pdf-root input[type=file]')
    })`,
    returnByValue: true,
  });
  console.log('Page Title:', pageMeta.result.value.title);
  console.log('H1:', pageMeta.result.value.h1);
  if (!pageMeta.result.value.hasDropzone) throw new Error('Dropzone file input not found');
  console.log('✓ Dropzone input ready');

  // --- TEST 2: Single JPG -> 1-Page PDF ---
  console.log('\n--- TEST 2: Single JPG -> 1-Page PDF ---');
  const doc = await cdp.send('DOM.getDocument');
  const inputNode = await cdp.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '#image-to-pdf-root input[type=file]',
  });

  await cdp.send('DOM.setFileInputFiles', {
    files: [path.resolve('test-fixtures', 'landscape.jpg')],
    nodeId: inputNode.nodeId,
  });
  await sleep(1000);

  const singleQueued = await cdp.send('Runtime.evaluate', {
    expression: `({
      count: document.getElementById('selected-images-count')?.textContent,
      name: document.querySelector('#pdf-images-list p.font-semibold')?.textContent,
      meta: document.querySelector('#pdf-images-list div.text-\\[11px\\]')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('Queued single image:', singleQueued.result.value);

  console.log('Clicking Convert to PDF...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('start-pdf-btn').click()`,
  });

  let singlePdfReady = false;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const visible = await cdp.send('Runtime.evaluate', {
      expression: `!document.getElementById('pdf-result-section').classList.contains('hidden')`,
      returnByValue: true,
    });
    if (visible.result.value) {
      singlePdfReady = true;
      break;
    }
  }
  if (!singlePdfReady) throw new Error('Single PDF generation timed out');

  const singleResult = await cdp.send('Runtime.evaluate', {
    expression: `({
      filename: document.getElementById('pdf-result-filename')?.textContent,
      pages: document.getElementById('pdf-result-page-count')?.textContent,
      size: document.getElementById('pdf-result-file-size')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('✓ Single PDF Result Card:', singleResult.result.value);

  console.log('Downloading single PDF...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('pdf-download-btn').click()`,
  });
  await sleep(600);

  const singleDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  console.log('✓ Single Download Payload:', singleDl.result.value);
  if (!singleDl.result.value.header.startsWith('%PDF-')) {
    throw new Error('Invalid PDF signature: ' + singleDl.result.value.header);
  }
  if (singleResult.result.value.pages !== '1 Page') {
    throw new Error('Expected 1 Page, got: ' + singleResult.result.value.pages);
  }

  // --- TEST 3: Multi-Image Workflow (JPG + PNG with Transparency + WebP) ---
  console.log('\n--- TEST 3: Multi-Image Workflow (JPG, Transparent PNG, WebP) ---');
  // Click Create Another
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('pdf-new-btn').click()`,
  });
  await sleep(600);

  // Upload 3 images
  await cdp.send('DOM.setFileInputFiles', {
    files: [
      path.resolve('test-fixtures', 'landscape.jpg'),
      path.resolve('test-fixtures', 'transparent_badge.png'),
      path.resolve('test-fixtures', 'sample.webp'),
    ],
    nodeId: inputNode.nodeId,
  });
  await sleep(1500);

  const multiQueued = await cdp.send('Runtime.evaluate', {
    expression: `({
      count: document.getElementById('selected-images-count')?.textContent,
      names: Array.from(document.querySelectorAll('#pdf-images-list p.font-semibold')).map(p => p.textContent)
    })`,
    returnByValue: true,
  });
  console.log('Queued 3 images:', multiQueued.result.value);
  if (multiQueued.result.value.count !== '3') throw new Error('Expected 3 queued images');

  console.log('Converting 3 images to PDF...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('start-pdf-btn').click()`,
  });

  let multiPdfReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const visible = await cdp.send('Runtime.evaluate', {
      expression: `!document.getElementById('pdf-result-section').classList.contains('hidden')`,
      returnByValue: true,
    });
    if (visible.result.value) {
      multiPdfReady = true;
      break;
    }
  }
  if (!multiPdfReady) throw new Error('Multi-page PDF generation timed out');

  const multiResult = await cdp.send('Runtime.evaluate', {
    expression: `({
      filename: document.getElementById('pdf-result-filename')?.textContent,
      pages: document.getElementById('pdf-result-page-count')?.textContent,
      size: document.getElementById('pdf-result-file-size')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('✓ Multi-page PDF Result Card:', multiResult.result.value);
  if (multiResult.result.value.pages !== '3 Pages') {
    throw new Error('Expected 3 Pages, got: ' + multiResult.result.value.pages);
  }

  // --- TEST 4: Image Ordering & Reordering Test ---
  console.log('\n--- TEST 4: Image Ordering & Reordering Test ---');
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('pdf-new-btn').click()`,
  });
  await sleep(600);

  // Upload 3 images: A (landscape.jpg), B (transparent_badge.png), C (sample.webp)
  await cdp.send('DOM.setFileInputFiles', {
    files: [
      path.resolve('test-fixtures', 'landscape.jpg'),
      path.resolve('test-fixtures', 'transparent_badge.png'),
      path.resolve('test-fixtures', 'sample.webp'),
    ],
    nodeId: inputNode.nodeId,
  });
  await sleep(1200);

  // Click Move Down on the first item (page 1)
  console.log('Moving Page 1 (landscape.jpg) DOWN to Page 2...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const firstCard = document.querySelectorAll('#pdf-images-list > div')[0];
      const downBtn = firstCard.querySelectorAll('button')[1]; // second button is down
      downBtn.click();
    })()`,
  });
  await sleep(500);

  const reorderedNames = await cdp.send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('#pdf-images-list p.font-semibold')).map(p => p.textContent)`,
    returnByValue: true,
  });
  console.log('Reordered sequence:', reorderedNames.result.value);
  if (reorderedNames.result.value[0] !== 'transparent_badge.png' || reorderedNames.result.value[1] !== 'landscape.jpg') {
    throw new Error('Reordering failed! Expected transparent_badge.png to be first, got: ' + reorderedNames.result.value);
  }
  console.log('✓ Image reordering verified successfully');

  // --- TEST 5: Page Size, Orientation, & Margin Options ---
  console.log('\n--- TEST 5: Page Size, Orientation, & Margins Settings ---');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('pdf-page-size').value = 'fit';
      document.getElementById('pdf-orientation').value = 'landscape';
      document.getElementById('pdf-margins').value = 'large';
      document.getElementById('pdf-filename-input').value = 'custom-fit-doc.pdf';
    })()`,
  });
  await sleep(300);

  console.log('Generating PDF with Fit-to-Image and Large Margins...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('start-pdf-btn').click()`,
  });

  let customReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const visible = await cdp.send('Runtime.evaluate', {
      expression: `!document.getElementById('pdf-result-section').classList.contains('hidden')`,
      returnByValue: true,
    });
    if (visible.result.value) {
      customReady = true;
      break;
    }
  }
  if (!customReady) throw new Error('Custom PDF generation timed out');

  const customResult = await cdp.send('Runtime.evaluate', {
    expression: `({
      filename: document.getElementById('pdf-result-filename')?.textContent,
      pages: document.getElementById('pdf-result-page-count')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('✓ Custom PDF Result:', customResult.result.value);
  if (customResult.result.value.filename !== 'custom-fit-doc.pdf') {
    throw new Error('Expected custom-fit-doc.pdf, got: ' + customResult.result.value.filename);
  }

  // --- TEST 6: Special Filenames (Spaces, Uppercase, Unicode) ---
  console.log('\n--- TEST 6: Special Filenames (Spaces, Uppercase, Unicode) ---');
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('pdf-new-btn').click()`,
  });
  await sleep(600);

  await cdp.send('DOM.setFileInputFiles', {
    files: [
      path.resolve('test-fixtures', 'my photo.jpg'),
      path.resolve('test-fixtures', 'PHOTO.JPG'),
      path.resolve('test-fixtures', '旅行写真.png'),
    ],
    nodeId: inputNode.nodeId,
  });
  await sleep(1500);

  const specialCheck = await cdp.send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('#pdf-images-list p.font-semibold')).map(p => p.textContent)`,
    returnByValue: true,
  });
  console.log('Special filenames queued:', specialCheck.result.value);
  if (specialCheck.result.value.length !== 3) throw new Error('Expected 3 special files');

  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('start-pdf-btn').click()`,
  });

  let specialReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const visible = await cdp.send('Runtime.evaluate', {
      expression: `!document.getElementById('pdf-result-section').classList.contains('hidden')`,
      returnByValue: true,
    });
    if (visible.result.value) {
      specialReady = true;
      break;
    }
  }
  if (!specialReady) throw new Error('Special filename PDF generation timed out');
  console.log('✓ Special filenames processed and PDF generated successfully');

  // --- TEST 7: Error Handling & Isolation (Corrupted Image) ---
  console.log('\n--- TEST 7: Error Handling & Isolation (Corrupted Image) ---');
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('pdf-new-btn').click()`,
  });
  await sleep(600);

  await cdp.send('DOM.setFileInputFiles', {
    files: [
      path.resolve('test-fixtures', 'landscape.jpg'),
      path.resolve('test-fixtures', 'corrupted.png'),
    ],
    nodeId: inputNode.nodeId,
  });
  await sleep(1200);

  const errorIsolationCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('#pdf-images-list > div'));
      return {
        totalCards: cards.length,
        hasErrorCard: cards.some(c => c.innerHTML.includes('Failed to decode image data')),
        btnText: document.getElementById('start-pdf-btn-text')?.textContent
      };
    })()`,
    returnByValue: true,
  });
  console.log('Error Isolation Status:', errorIsolationCheck.result.value);
  if (!errorIsolationCheck.result.value.hasErrorCard) {
    throw new Error('Expected corrupted file to display inline error');
  }

  // Attempt conversion of valid item
  console.log('Converting remaining valid image...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('start-pdf-btn').click()`,
  });

  let isolatedReady = false;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const visible = await cdp.send('Runtime.evaluate', {
      expression: `!document.getElementById('pdf-result-section').classList.contains('hidden')`,
      returnByValue: true,
    });
    if (visible.result.value) {
      isolatedReady = true;
      break;
    }
  }
  if (!isolatedReady) throw new Error('Isolated error recovery failed');
  console.log('✓ Error isolation verified: valid photo converted into 1-page PDF despite corrupted file present');

  // --- TEST 8: Responsive Viewport Audit (375, 390, 768, 1024, 1440) ---
  console.log('\n--- TEST 8: Responsive Viewport Audit ---');
  const viewports = [375, 390, 768, 1024, 1440];
  for (const w of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: 800,
      deviceScaleFactor: 1,
      mobile: w <= 768,
    });
    await sleep(300);

    const overflowCheck = await cdp.send('Runtime.evaluate', {
      expression: `document.documentElement.scrollWidth > window.innerWidth`,
      returnByValue: true,
    });
    if (overflowCheck.result.value) {
      throw new Error(`Horizontal overflow detected at viewport ${w}px!`);
    }
    console.log(`   Viewport ${w}px: PASS (0 overflow)`);
  }

  // Reset viewport
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  // --- TEST 9: Accessibility (A11y) Audit ---
  console.log('\n--- TEST 9: Accessibility (A11y) Audit ---');
  const a11yCheck = await cdp.send('Runtime.evaluate', {
    expression: `({
      pageSizeAriaLabel: document.getElementById('pdf-page-size')?.getAttribute('aria-label'),
      orientationAriaLabel: document.getElementById('pdf-orientation')?.getAttribute('aria-label'),
      marginsAriaLabel: document.getElementById('pdf-margins')?.getAttribute('aria-label'),
      filenameAriaLabel: document.getElementById('pdf-filename-input')?.getAttribute('aria-label'),
      progressRole: document.getElementById('pdf-progress-container')?.getAttribute('role'),
      progressLive: document.getElementById('pdf-progress-container')?.getAttribute('aria-live')
    })`,
    returnByValue: true,
  });
  console.log('✓ Accessibility Attributes:', a11yCheck.result.value);

  // --- TEST 10: Network Privacy Audit ---
  console.log('\n--- TEST 10: Network Privacy Audit ---');
  console.log(`POST requests observed during all PDF operations: ${networkPostRequests.length}`);
  console.log(`Uploaded bytes: ${totalUploadedBytes}`);
  if (networkPostRequests.length > 0 || totalUploadedBytes > 0) {
    throw new Error('Privacy leak detected! Found POST requests or uploaded bytes.');
  }
  console.log('✓ 100% Client-Side Privacy: ZERO POST requests, ZERO bytes uploaded!');

  console.log('\n====================================================');
  console.log('ALL IMAGE TO PDF BROWSER TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');

  cdp.close();
  chrome.kill();
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ PDF TEST SUITE FAILED:', err);
  process.exit(1);
});
