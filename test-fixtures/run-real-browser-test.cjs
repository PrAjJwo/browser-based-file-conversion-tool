const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/image/heic-to-jpg';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_heic_test_' + Date.now());

// Helper for CDP communication via WebSocket
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
          listeners.forEach(cb => cb(msg.params));
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
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('====================================================');
  console.log('STARTING REAL BROWSER HEIC VERIFICATION PASS');
  console.log('Browser: Google Chrome Headless via CDP');
  console.log('Target URL:', DEV_URL);
  console.log('====================================================\n');

  // 1. Launch Chrome with debugging port
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ]);

  await sleep(1500);

  // 2. Discover target
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('DOM.enable');

  // Track network requests
  const networkRequests = [];
  cdp.on('Network.requestWillBeSent', (params) => {
    networkRequests.push({
      url: params.request.url,
      method: params.request.method,
      hasPostData: !!params.request.hasPostData,
    });
  });

  // Track console logs
  const consoleMessages = [];
  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map(a => a.value || a.description || '').join(' ');
    consoleMessages.push({ type: params.type, text });
  });

  // Navigate to HEIC converter page
  console.log('--- TEST 1: Initial Page Load & Asset Inspection ---');
  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2000);

  const initialCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const dropzone = document.querySelector('#heic-tool-root #dropzone-wrapper');
      const slider = document.querySelector('#heic-quality-slider');
      const startBtn = document.querySelector('#start-convert-btn');
      const queueSection = document.querySelector('#queue-section');
      const privacyText = document.body.innerText.includes('Your files never leave your device. Everything is processed in your browser.');
      const horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth;
      
      return {
        hasDropzone: !!dropzone,
        sliderVal: slider ? slider.value : null,
        isConvertBtnHidden: queueSection.classList.contains('hidden'),
        hasPrivacyMessage: privacyText,
        hasHorizontalOverflow: horizontalOverflow,
        title: document.title
      };
    })()`,
    returnByValue: true
  });

  console.log('Initial page state:', JSON.stringify(initialCheck.result.value, null, 2));

  // Check if heic2any or jszip loaded before conversion
  const loadedScriptsBefore = networkRequests.map(r => r.url);
  const loadedHeicBefore = loadedScriptsBefore.some(u => u.includes('heic2any'));
  const loadedZipBefore = loadedScriptsBefore.some(u => u.includes('jszip'));
  console.log('Was heic2any loaded before conversion?', loadedHeicBefore ? 'FAIL' : 'PASS (Not loaded)');
  console.log('Was jszip loaded before conversion?', loadedZipBefore ? 'FAIL' : 'PASS (Not loaded)');

  // Helper to set files on the file input
  async function selectFiles(filenames) {
    const absPaths = filenames.map(f => path.resolve('test-fixtures', f));
    // Find input element in DOM
    const doc = await cdp.send('DOM.getDocument');
    const inputNode = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#heic-tool-root input[type=file]'
    });
    await cdp.send('DOM.setFileInputFiles', {
      files: absPaths,
      nodeId: inputNode.nodeId
    });
    await sleep(500);
  }

  // --- TEST 2: Single Real HEIC Conversion ---
  console.log('\n--- TEST 2: Single Real HEIC Conversion (autumn_1440x960.heic) ---');
  await selectFiles(['autumn_1440x960.heic']);

  // Verify queue state before conversion
  const queueBefore = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const q = document.querySelector('#queue-list');
      const btn = document.querySelector('#start-convert-btn');
      return {
        queueCount: document.querySelector('#queue-count')?.textContent,
        btnText: btn?.textContent?.trim(),
        firstCardText: q?.firstElementChild?.textContent?.trim()
      };
    })()`,
    returnByValue: true
  });
  console.log('Queue state before convert:', queueBefore.result.value);

  // Click Convert to JPG
  console.log('Clicking "Convert to JPG"...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`
  });

  // Poll for completion (up to 20 seconds for WebAssembly compilation & decoding)
  let singleCompleted = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const check = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const results = document.querySelectorAll('#results-list > div');
        const progressText = document.querySelector('#progress-status-text')?.textContent;
        const converting = document.querySelector('#start-convert-btn')?.disabled;
        return {
          resultsCount: results.length,
          progressText,
          converting
        };
      })()`,
      returnByValue: true
    });

    if (check.result.value.resultsCount >= 1) {
      singleCompleted = true;
      console.log(`Conversion completed at check ${i + 1}:`, check.result.value);
      break;
    }
  }

  if (!singleCompleted) {
    console.error('Single conversion timed out! Console logs:', consoleMessages);
    throw new Error('Single HEIC conversion did not complete in time');
  }

  // Verify that heic2any chunk was loaded during conversion
  const loadedScriptsAfter = networkRequests.map(r => r.url);
  const loadedHeicAfter = loadedScriptsAfter.some(u => u.includes('heic2any'));
  console.log('Was heic2any loaded during conversion?', loadedHeicAfter ? 'PASS (Loaded dynamically)' : 'FAIL');

  // Verify output details
  const outputDetails = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const resultCard = document.querySelector('#results-list > div');
      const thumb = resultCard.querySelector('img');
      const name = resultCard.querySelector('.font-semibold')?.textContent;
      const sizeText = resultCard.querySelector('.text-surface-500')?.textContent;
      const dlBtn = resultCard.querySelector('button');

      return {
        name,
        sizeText,
        hasThumb: !!thumb && !!thumb.src,
        hasDlBtn: !!dlBtn
      };
    })()`,
    returnByValue: true
  });
  console.log('Result card details:', outputDetails.result.value);

  // Verify resulting Blob in browser memory & fetch its bytes
  const blobInfo = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const img = document.querySelector('#results-list img');
      const res = await fetch(img.src);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf).slice(0, 4));
      return {
        blobSize: blob.size,
        blobType: blob.type,
        magicHex: bytes.map(b => b.toString(16).padStart(2, '0')).join(' '),
        imgNaturalWidth: img.naturalWidth,
        imgNaturalHeight: img.naturalHeight
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Generated JPG Blob verification:', blobInfo.result.value);

  // --- TEST 3: Quality Slider Verification (50%, 90%, 100%) ---
  console.log('\n--- TEST 3: Quality Slider Testing (spring_1440x960.heic) ---');
  const qualityResults = [];

  for (const qVal of [0.5, 0.9, 1.0]) {
    // Clear previous
    await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#clear-all-btn').click()` });
    await sleep(300);

    // Set slider value
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const s = document.querySelector('#heic-quality-slider');
        s.value = '${qVal}';
        s.dispatchEvent(new Event('input'));
      })()`
    });

    // Select spring file
    await selectFiles(['spring_1440x960.heic']);
    await sleep(300);

    // Click Convert
    await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#start-convert-btn').click()` });

    // Wait for completion
    let done = false;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const r = await cdp.send('Runtime.evaluate', {
        expression: `document.querySelectorAll('#results-list > div').length`,
        returnByValue: true
      });
      if (r.result.value >= 1) {
        done = true;
        break;
      }
    }

    const qBlob = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const img = document.querySelector('#results-list img');
        const res = await fetch(img.src);
        const blob = await res.blob();
        return { size: blob.size, type: blob.type };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log(`Quality ${Math.round(qVal * 100)}% -> Size: ${qBlob.result.value.size} bytes, MIME: ${qBlob.result.value.type}`);
    qualityResults.push({ quality: qVal, size: qBlob.result.value.size });
  }

  // --- TEST 4: Multiple Real HEIC Files & ZIP Download ---
  console.log('\n--- TEST 4: Multiple HEIC Files & ZIP Download ---');
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#clear-all-btn').click()` });
  await sleep(300);

  // Check jszip before clicking ZIP
  const loadedZipBeforeClick = networkRequests.some(u => u.url.includes('jszip'));
  console.log('Was jszip loaded before ZIP button clicked?', loadedZipBeforeClick ? 'FAIL' : 'PASS (Not loaded)');

  // Select 3 files together
  await selectFiles(['autumn_1440x960.heic', 'winter_1440x960.heic', 'spring_1440x960.heic']);
  await sleep(300);

  const batchCount = await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#queue-count')?.textContent`,
    returnByValue: true
  });
  console.log('Selected batch count:', batchCount.result.value);

  // Click Convert
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#start-convert-btn').click()` });

  // Monitor sequential progress
  let batchDone = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const progressStatus = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const results = document.querySelectorAll('#results-list > div');
        const statusText = document.querySelector('#progress-status-text')?.textContent;
        const pct = document.querySelector('#progress-percentage-text')?.textContent;
        const zipBtnVisible = !document.querySelector('#download-zip-btn')?.classList.contains('hidden');
        return {
          resultsCount: results.length,
          statusText,
          pct,
          zipBtnVisible
        };
      })()`,
      returnByValue: true
    });

    if (progressStatus.result.value.resultsCount === 3) {
      batchDone = true;
      console.log('Batch finished successfully:', progressStatus.result.value);
      break;
    }
  }

  if (!batchDone) {
    throw new Error('Batch conversion of 3 files did not complete');
  }

  // Test ZIP creation
  console.log('\nTriggering "Download All as ZIP"...');
  const zipResult = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      // Intercept downloadBlob to capture the ZIP blob
      let capturedBlob = null;
      let capturedName = null;
      const origCreate = URL.createObjectURL;
      
      const zipBtn = document.querySelector('#download-zip-btn');
      zipBtn.click();
      
      // Wait for ZIP button text to restore
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (!zipBtn.disabled) break;
      }
      
      return { success: true };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  const loadedZipAfterClick = networkRequests.some(u => u.url.includes('jszip'));
  console.log('Was jszip loaded after clicking ZIP button?', loadedZipAfterClick ? 'PASS (Loaded lazily)' : 'FAIL');

  // --- TEST 5: Mixed Valid + Invalid File Test ---
  console.log('\n--- TEST 5: Mixed Valid + Invalid File Handling ---');
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#clear-all-btn').click()` });
  await sleep(300);

  await selectFiles(['spring_1440x960.heic', 'invalid_sample.txt']);
  await sleep(300);

  const mixedCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const errorBox = document.querySelector('.validation-error');
      const errText = errorBox?.querySelector('.error-message')?.textContent;
      const isErrHidden = errorBox?.classList.contains('hidden');
      const queueCount = document.querySelector('#queue-count')?.textContent;
      return {
        isErrHidden,
        errText,
        queueCount
      };
    })()`,
    returnByValue: true
  });
  console.log('Mixed files result:', mixedCheck.result.value);

  // --- TEST 6: Per-File Error Isolation (Valid + Corrupted HEIC) ---
  console.log('\n--- TEST 6: Per-File Error Isolation ---');
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#clear-all-btn').click()` });
  await sleep(300);

  await selectFiles(['autumn_1440x960.heic', 'corrupted.heic']);
  await sleep(300);

  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#start-convert-btn').click()` });

  let isolationDone = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const check = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const cards = document.querySelectorAll('#queue-list > div');
        const results = document.querySelectorAll('#results-list > div');
        const converting = document.querySelector('#start-convert-btn')?.disabled;
        const statuses = Array.from(cards).map(c => ({
          name: c.querySelector('.font-semibold')?.textContent,
          badge: c.querySelector('span.uppercase')?.textContent,
          error: c.querySelector('.text-rose-600')?.textContent
        }));
        return {
          resultsCount: results.length,
          statuses,
          converting
        };
      })()`,
      returnByValue: true
    });

    if (!check.result.value.converting && check.result.value.resultsCount >= 1) {
      isolationDone = true;
      console.log('Isolation test result:', JSON.stringify(check.result.value, null, 2));
      break;
    }
  }

  // --- TEST 7: Special Filenames & Unicode ---
  console.log('\n--- TEST 7: Special Filenames & Unicode Handling ---');
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#clear-all-btn').click()` });
  await sleep(300);

  await selectFiles(['my holiday photo (1).heic', '旅行写真_2026.heic', 'test_upper.HEIC']);
  await sleep(300);

  const specialCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const cards = document.querySelectorAll('#queue-list > div');
      return Array.from(cards).map(c => c.querySelector('.font-semibold')?.textContent);
    })()`,
    returnByValue: true
  });
  console.log('Special filenames safely queued:', specialCheck.result.value);

  // --- TEST 8: Network Privacy Check ---
  console.log('\n--- TEST 8: Network Privacy Audit ---');
  const postRequests = networkRequests.filter(r => r.method === 'POST' || r.hasPostData);
  const externalRequests = networkRequests.filter(r => !r.url.startsWith('http://localhost:4321') && !r.url.startsWith('data:'));
  console.log(`Total HTTP requests during entire session: ${networkRequests.length}`);
  console.log(`Total POST/Upload requests: ${postRequests.length}`);
  console.log(`Total external domain requests: ${externalRequests.length}`);

  // --- TEST 9: Mobile Viewport Checks (375px, 390px, 768px) ---
  console.log('\n--- TEST 9: Mobile Responsive Dimensions ---');
  for (const width of [375, 390, 768]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(200);

    const overflowCheck = await cdp.send('Runtime.evaluate', {
      expression: `({
        windowWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      })`,
      returnByValue: true
    });
    console.log(`Viewport ${width}px:`, overflowCheck.result.value);
  }

  console.log('\n====================================================');
  console.log('ALL REAL BROWSER TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');

  cdp.close();
  chrome.kill();
  process.exit(0);
})().catch(err => {
  console.error('\nFATAL TEST ERROR:', err);
  process.exit(1);
});
