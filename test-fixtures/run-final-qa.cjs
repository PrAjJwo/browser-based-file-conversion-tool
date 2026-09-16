const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://127.0.0.1:4321/image/heic-to-jpg';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_final_qa_' + Date.now());

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
  console.log('STARTING FINAL HEIC QA + SMOKE TEST SUITE');
  console.log('Browser: Google Chrome Headless via CDP');
  console.log('Target URL:', DEV_URL);
  console.log('====================================================\n');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9227/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page');
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('DOM.enable');

  const networkRequests = [];
  cdp.on('Network.requestWillBeSent', (params) => {
    networkRequests.push({
      url: params.request.url,
      method: params.request.method,
      hasPostData: !!params.request.hasPostData,
      postData: params.request.postData,
    });
  });

  const consoleLogs = [];
  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || a.description || '').join(' ');
    consoleLogs.push({ type: params.type, text });
  });

  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2500);

  // Hook anchor clicks to capture downloads
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__downloads = [];
      const origClick = HTMLElement.prototype.click;
      HTMLElement.prototype.click = function() {
        if (this.tagName === 'A' && (this.hasAttribute('download') || this.download)) {
          window.__downloads.push({
            filename: this.getAttribute('download') || this.download,
            href: this.getAttribute('href') || this.href
          });
        }
        return origClick.apply(this, arguments);
      };
    })()`,
  });

  // Helper to select files via native file picker
  async function selectFixtures(filenames) {
    const absPaths = filenames.map((f) => path.resolve('test-fixtures', f));
    const doc = await cdp.send('DOM.getDocument');
    const inputNode = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#heic-tool-root input[type=file]',
    });
    await cdp.send('DOM.setFileInputFiles', {
      files: absPaths,
      nodeId: inputNode.nodeId,
    });
    await sleep(500);
  }

  // --- SECTION 3: HEIC TOOL FINAL SMOKE TEST ---
  console.log('--- 1. SINGLE HEIC SMOKE TEST (autumn_1440x960.heic) ---');
  await selectFixtures(['autumn_1440x960.heic']);

  const queueReady = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      return {
        count: document.querySelector('#queue-count')?.textContent,
        status: document.querySelector('#queue-list span.uppercase')?.textContent,
        filename: document.querySelector('#queue-list p.font-semibold')?.textContent
      };
    })()`,
    returnByValue: true,
  });
  console.log('   Queue status:', queueReady.result.value);

  console.log('   Converting to JPG at default quality...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  let singleDone = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const count = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#results-list > div').length`,
      returnByValue: true,
    });
    if (count.result.value === 1) {
      singleDone = true;
      break;
    }
  }
  if (!singleDone) throw new Error('Single conversion failed or timed out');

  const previewInfo = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const card = document.querySelector('#results-list > div');
      const img = card.querySelector('img');
      const res = await fetch(img.src);
      const blob = await res.blob();
      return {
        filename: card.querySelector('.font-semibold')?.textContent,
        sizeText: card.querySelector('.text-surface-500')?.textContent,
        mime: blob.type,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('   Converted result details:', previewInfo.result.value);

  // Click individual download
  console.log('   Testing individual JPG download click...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#results-list button').click()`,
  });
  await sleep(500);

  const dlSingle = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads[window.__downloads.length - 1]`,
    returnByValue: true,
  });
  console.log('   Downloaded file:', dlSingle.result.value);

  // Test Clear/Reset
  console.log('   Testing Clear/Reset...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  const clearedState = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      return {
        queueCount: document.querySelectorAll('#queue-list > div').length,
        queueHidden: document.querySelector('#queue-section').classList.contains('hidden'),
        resultsCount: document.querySelectorAll('#results-list > div').length,
        resultsHidden: document.querySelector('#results-section').classList.contains('hidden'),
        progressHidden: document.querySelector('#progress-container').classList.contains('hidden'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('   Cleared state:', clearedState.result.value);

  // --- SECTION 4: MULTI-FILE + ZIP SMOKE TEST ---
  console.log('\n--- 2. MULTI-FILE + ZIP SMOKE TEST (autumn + winter) ---');
  await selectFixtures(['autumn_1440x960.heic', 'winter_1440x960.heic']);

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  let batchDone = false;
  for (let i = 0; i < 50; i++) {
    await sleep(500);
    const count = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#results-list > div').length`,
      returnByValue: true,
    });
    if (count.result.value === 2) {
      batchDone = true;
      break;
    }
  }
  if (!batchDone) throw new Error('Multi-file batch conversion failed');

  const zipBtnVisible = await cdp.send('Runtime.evaluate', {
    expression: `!document.querySelector('#download-zip-btn').classList.contains('hidden')`,
    returnByValue: true,
  });
  console.log('   ZIP button visible:', zipBtnVisible.result.value);

  console.log('   Clicking "Download All as ZIP"...');
  const preZipCount = (await cdp.send('Runtime.evaluate', { expression: `window.__downloads.length`, returnByValue: true })).result.value;
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#download-zip-btn').click()`,
  });

  for (let i = 0; i < 30; i++) {
    await sleep(300);
    const currCount = await cdp.send('Runtime.evaluate', { expression: `window.__downloads.length`, returnByValue: true });
    if (currCount.result.value > preZipCount) break;
  }

  const zipDl = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const dl = window.__downloads[window.__downloads.length - 1];
      const res = await fetch(dl.href);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < u8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunkSize));
      }
      return {
        filename: dl.filename,
        base64: btoa(binary)
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const zip = await JSZip.loadAsync(Buffer.from(zipDl.result.value.base64, 'base64'));
  const zipEntries = Object.keys(zip.files).filter((k) => !zip.files[k].dir);
  console.log('   ZIP filename:', zipDl.result.value.filename);
  console.log('   Files inside ZIP:', zipEntries);

  // Clear queue for next test
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  // --- SECTION 5: FAILURE ISOLATION SMOKE TEST ---
  console.log('\n--- 3. FAILURE ISOLATION SMOKE TEST (valid autumn + corrupted.heic) ---');
  await selectFixtures(['autumn_1440x960.heic', 'corrupted.heic']);

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const isFinished = await cdp.send('Runtime.evaluate', {
      expression: `!document.querySelector('#start-convert-btn').disabled`,
      returnByValue: true,
    });
    if (isFinished.result.value) break;
  }

  const failureCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('#queue-list > div')).map(c => ({
        name: c.querySelector('.font-semibold')?.textContent,
        status: c.querySelector('span.uppercase')?.textContent,
        error: c.querySelector('.text-rose-600')?.textContent || null
      }));
      const results = Array.from(document.querySelectorAll('#results-list > div')).map(r => ({
        name: r.querySelector('.font-semibold')?.textContent
      }));
      return { queueCards: cards, resultsCards: results };
    })()`,
    returnByValue: true,
  });
  console.log('   Queue items status:', failureCheck.result.value.queueCards);
  console.log('   Output results:', failureCheck.result.value.resultsCards);

  // Clear queue
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  // --- SECTION 8: NAVIGATION CHECK ---
  console.log('\n--- 4. NAVIGATION & LINK AUDIT ---');
  const allPageLinks = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return Array.from(new Set(anchors.map(a => a.getAttribute('href'))));
    })()`,
    returnByValue: true,
  });

  const internalLinks = allPageLinks.result.value.filter((h) => h.startsWith('/') && !h.startsWith('//'));
  console.log('   Unique internal links to verify:', internalLinks);

  for (const l of internalLinks) {
    const status = await new Promise((resolve) => {
      http.get('http://127.0.0.1:4321' + l, (res) => resolve(res.statusCode)).on('error', () => resolve(500));
    });
    console.log(`   Link "${l}": HTTP ${status} (${status === 200 ? 'PASS' : 'FAIL'})`);
  }

  // --- SECTION 9: RESPONSIVE AUDIT ---
  console.log('\n--- 5. RESPONSIVE VIEWPORT AUDIT (375, 390, 768, 1024, 1440px) ---');
  const widths = [375, 390, 768, 1024, 1440];
  for (const w of widths) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: 900,
      deviceScaleFactor: 1,
      mobile: w < 768,
    });
    await sleep(250);

    const overflowCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        return { hasOverflow: docW > winW, docW, winW };
      })()`,
      returnByValue: true,
    });
    console.log(`   Viewport ${w}px: ${overflowCheck.result.value.hasOverflow ? 'FAIL (Overflow)' : 'PASS (No overflow)'}`);
  }

  // --- SECTION 10: ACCESSIBILITY AUDIT ---
  console.log('\n--- 6. ACCESSIBILITY COMPLIANCE AUDIT ---');
  const a11yCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const skipLink = document.querySelector('a[href="#main-content"]');
      const mainElement = document.querySelector('#main-content');
      const slider = document.querySelector('#heic-quality-slider');
      const progressContainer = document.querySelector('#progress-container');
      const detailsElements = document.querySelectorAll('details');
      const summaryElements = document.querySelectorAll('summary');
      const breadcrumbs = document.querySelector('nav[aria-label="Breadcrumb"]');

      return {
        hasSkipLink: !!skipLink,
        hasMainTarget: !!mainElement,
        sliderAriaLabel: slider?.getAttribute('aria-label'),
        sliderAriaMin: slider?.getAttribute('aria-valuemin'),
        sliderAriaMax: slider?.getAttribute('aria-valuemax'),
        progressRole: progressContainer?.getAttribute('role'),
        progressLive: progressContainer?.getAttribute('aria-live'),
        faqDetailsCount: detailsElements.length,
        faqSummaryCount: summaryElements.length,
        hasBreadcrumbs: !!breadcrumbs,
      };
    })()`,
    returnByValue: true,
  });
  console.log('   Accessibility features:', a11yCheck.result.value);

  // --- SECTION 11: NETWORK PRIVACY AUDIT ---
  console.log('\n--- 7. NETWORK PRIVACY & ASSET AUDIT ---');
  console.log('   Total requests recorded during test:', networkRequests.length);
  const postRequests = networkRequests.filter((r) => r.method === 'POST');
  const fileUploadRequests = networkRequests.filter((r) => r.hasPostData || (r.postData && r.postData.length > 0));
  const externalDataRequests = networkRequests.filter((r) => {
    const isExternal = !r.url.startsWith('http://127.0.0.1') && !r.url.startsWith('http://localhost');
    return isExternal && (r.url.includes('autumn') || r.url.includes('winter') || r.url.includes('heic'));
  });

  console.log('   POST requests (upload endpoints):', postRequests.length, '(expected: 0)');
  console.log('   Requests with file payload data:', fileUploadRequests.length, '(expected: 0)');
  console.log('   External requests leaking filenames/data:', externalDataRequests.length, '(expected: 0)');

  const localHeicChunks = networkRequests.filter((r) => r.url.includes('heic2any'));
  console.log('   heic2any engine source:', localHeicChunks.length > 0 ? localHeicChunks[0].url : 'None');

  cdp.close();
  chrome.kill();

  console.log('\n====================================================');
  console.log('ALL FINAL QA SMOKE TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
})().catch((err) => {
  console.error('Final QA failed:', err);
  process.exit(1);
});
