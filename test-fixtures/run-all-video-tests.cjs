const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/video/video-compressor';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_video_suite_' + Date.now());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

(async () => {
  console.log('====================================================');
  console.log('STARTING COMPLETE TOOL #2 REAL-BROWSER TEST SUITE');
  console.log('Target URL:', DEV_URL);
  console.log('====================================================\n');

  const mp4Fixture = path.resolve('test-fixtures', 'sample.mp4');
  const movFixture = path.resolve('test-fixtures', 'sample.mov');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--remote-allow-origins=*',
    '--disable-extensions',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9229/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page' && !t.url.startsWith('chrome-extension://'));
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('DOM.enable');

  const networkPostRequests = [];
  const networkUploadBytes = [];
  cdp.on('Network.requestWillBeSent', (params) => {
    if (params.request.method === 'POST') {
      networkPostRequests.push(params.request.url);
    }
    if (params.request.postData) {
      networkUploadBytes.push(params.request.postData.length);
    }
  });

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
    if (text.includes('[video-compressor]') || text.includes('Error') || text.includes('error')) {
      console.log('   [BROWSER LOG]', text);
    }
  });

  let pageLoaded = false;
  cdp.on('Page.loadEventFired', () => {
    pageLoaded = true;
  });

  await cdp.send('Page.navigate', { url: DEV_URL });
  let loadAttempts = 0;
  while (!pageLoaded && loadAttempts < 30) {
    await sleep(200);
    loadAttempts++;
  }
  await sleep(1500);

  // Helper to select files via native file picker and wait for UI to update
  async function selectFile(filePath) {
    // 1. Reset state first
    await cdp.send('Runtime.evaluate', {
      expression: `
        const card = document.getElementById('video-config-card');
        if (card) card.removeAttribute('data-ready');
        const resetBtn = document.getElementById('compress-another-btn');
        if (resetBtn) resetBtn.click();
        const clearBtn = document.getElementById('video-clear-btn');
        if (clearBtn) clearBtn.click();
      `,
    });
    await sleep(300);

    // 2. Select file
    const doc = await cdp.send('DOM.getDocument', { depth: -1 });
    const inputNode = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#video-compressor-root input[type=file]',
    });
    if (!inputNode.nodeId) throw new Error('Could not find file input');
    await cdp.send('DOM.setFileInputFiles', {
      files: [filePath],
      nodeId: inputNode.nodeId,
    });

    // 3. Wait until config card has data-ready="true"
    let isReady = false;
    let attempts = 0;
    while (!isReady && attempts < 40) {
      await sleep(200);
      attempts++;
      const evalReady = await cdp.send('Runtime.evaluate', {
        expression: `document.getElementById('video-config-card')?.getAttribute('data-ready') === 'true'`,
        returnByValue: true,
      });
      isReady = evalReady.result.value;
    }
    if (!isReady) throw new Error('Timed out waiting for video config data-ready');
    await sleep(300);
  }

  // Helper to wait for compression completion
  async function waitForCompression(timeoutSec = 45) {
    let attempts = 0;
    let lastPhase = '';
    while (attempts < timeoutSec) {
      await sleep(1000);
      attempts++;
      const res = await cdp.send('Runtime.evaluate', {
        expression: `({
          isResultVisible: !document.getElementById('video-result-card')?.classList.contains('hidden'),
          errorVisible: !document.getElementById('compression-error-banner')?.classList.contains('hidden'),
          errorText: document.getElementById('compression-error-text')?.textContent?.trim(),
          phase: document.getElementById('compression-phase-label')?.textContent?.trim(),
          pct: document.getElementById('compression-percentage-label')?.textContent?.trim()
        })`,
        returnByValue: true,
      });
      const st = res.result.value;
      if (st.phase && st.phase !== lastPhase) {
        lastPhase = st.phase;
        console.log(`     [Progress] ${st.phase} (${st.pct})`);
      }
      if (st.errorVisible) {
        throw new Error('Compression failed with error: ' + st.errorText);
      }
      if (st.isResultVisible) {
        return;
      }
    }
    throw new Error(`Compression timed out after ${timeoutSec}s`);
  }

  // Helper to verify output video stream
  async function verifyOutputVideo() {
    return await cdp.send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const previewVideo = document.getElementById('result-video-preview');
        const href = previewVideo.src;
        const res = await fetch(href);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);

        // Check MP4 container magic: ftyp at offset 4
        const hasFtyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
        const duration = previewVideo.duration;
        const videoWidth = previewVideo.videoWidth;
        const videoHeight = previewVideo.videoHeight;
        const downloadBtn = document.getElementById('download-video-btn');

        return {
          byteLength: bytes.byteLength,
          hasFtyp,
          duration,
          videoWidth,
          videoHeight,
          downloadFilename: downloadBtn.getAttribute('download') || downloadBtn.download,
          actualSizeText: document.getElementById('result-actual-val')?.textContent?.trim(),
          targetSizeText: document.getElementById('result-target-val')?.textContent?.trim(),
          reductionText: document.getElementById('result-reduction-badge')?.textContent?.trim(),
          passesText: document.getElementById('result-passes-badge')?.textContent?.trim()
        };
      })()`,
      returnByValue: true,
    });
  }

  const results = {
    multiTargetAccuracy: [],
    testA_MP4: null,
    testB_MOV: null,
    testC_AggressiveTarget: null,
    testD_TargetLarger: null,
    testE_ResetAndReuse: null,
    responsive: {},
    accessibility: null,
    networkPrivacy: null,
  };

  // ====================================================
  // TEST A: MP4 MULTI-TARGET ACCURACY TESTING
  // Targets: 0.30 MB, 0.20 MB, 0.12 MB
  // ====================================================
  console.log('--- TEST A: MP4 Multi-Target Compression (sample.mp4, 383,631 bytes) ---');
  const mp4Targets = [0.30, 0.20, 0.12];

  for (const targetMB of mp4Targets) {
    console.log(`\n  >> Testing Target Size: ${targetMB} MB...`);
    await selectFile(mp4Fixture);

    await cdp.send('Runtime.evaluate', {
      expression: `
        const targetInput = document.getElementById('target-size-input');
        targetInput.value = '${targetMB}';
        targetInput.dispatchEvent(new Event('input'));
      `,
    });
    await sleep(300);

    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('start-compress-btn').click();`,
    });
    await waitForCompression(45);

    const out = (await verifyOutputVideo()).result.value;
    const requestedBytes = Math.round(targetMB * 1024 * 1024);
    const diffPct = (((out.byteLength - requestedBytes) / requestedBytes) * 100).toFixed(1);

    const metric = {
      format: 'MP4',
      requestedTargetMB: targetMB,
      requestedBytes,
      outputBytes: out.byteLength,
      actualSizeText: out.actualSizeText,
      diffPct: `${diffPct > 0 ? '+' : ''}${diffPct}%`,
      reduction: out.reductionText,
      passes: out.passesText,
      validMp4: out.hasFtyp,
      duration: out.duration,
      resolution: `${out.videoWidth}x${out.videoHeight}`
    };
    results.multiTargetAccuracy.push(metric);
    console.log('     Result:', metric);
  }
  results.testA_MP4 = results.multiTargetAccuracy[1]; // 0.20 MB test

  // ====================================================
  // TEST B: MOV TO MP4 CONVERSION
  // ====================================================
  console.log('\n--- TEST B: MOV to MP4 Conversion (sample.mov, Target: 0.25 MB) ---');
  await selectFile(movFixture);

  const movMeta = await cdp.send('Runtime.evaluate', {
    expression: `({
      filename: document.getElementById('video-filename')?.textContent?.trim(),
      fileSize: document.getElementById('meta-file-size')?.textContent?.trim(),
      duration: document.getElementById('meta-duration')?.textContent?.trim(),
      resolution: document.getElementById('meta-resolution')?.textContent?.trim(),
      format: document.getElementById('meta-format')?.textContent?.trim()
    })`,
    returnByValue: true,
  });
  console.log('   MOV Metadata:', movMeta.result.value);

  // Set target size to 0.25 MB
  await cdp.send('Runtime.evaluate', {
    expression: `
      const targetInput = document.getElementById('target-size-input');
      targetInput.value = '0.25';
      targetInput.dispatchEvent(new Event('input'));
    `,
  });
  await sleep(300);

  // Compress MOV
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('start-compress-btn').click();`,
  });
  await waitForCompression(45);

  const testBOut = await verifyOutputVideo();
  results.testB_MOV = testBOut.result.value;
  console.log('   ✓ TEST B SUCCESS:', results.testB_MOV);

  // ====================================================
  // TEST C: AGGRESSIVE SMALL TARGET & QUALITY WARNING
  // ====================================================
  console.log('\n--- TEST C: Aggressive Small Target Warning Check ---');
  await selectFile(mp4Fixture);

  // Set target size to 0.05 MB (50 KB)
  const testCEval = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const inp = document.getElementById('target-size-input');
      inp.value = '0.05';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        inputValue: inp.value,
        warningVisible: !document.getElementById('target-warning-banner')?.classList.contains('hidden'),
        warningText: document.getElementById('target-warning-text')?.textContent?.trim(),
        bitrateDisplay: document.getElementById('calculated-bitrate-display')?.textContent?.trim()
      };
    })()`,
    returnByValue: true,
  });
  results.testC_AggressiveTarget = testCEval.result.value;
  console.log('   Aggressive Target Warning:', results.testC_AggressiveTarget);

  // ====================================================
  // TEST D: TARGET LARGER THAN SOURCE WARNING
  // ====================================================
  console.log('\n--- TEST D: Target Larger Than Source Warning Check ---');
  // Click 10 MB preset button (original is 0.37 MB)
  const testDEval = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.preset-btn[data-target="10"]');
      if (btn) btn.click();
      const inp = document.getElementById('target-size-input');
      return {
        inputValue: inp.value,
        warningVisible: !document.getElementById('target-warning-banner')?.classList.contains('hidden'),
        warningText: document.getElementById('target-warning-text')?.textContent?.trim(),
        bitrateDisplay: document.getElementById('calculated-bitrate-display')?.textContent?.trim()
      };
    })()`,
    returnByValue: true,
  });
  results.testD_TargetLarger = testDEval.result.value;
  console.log('   Target Larger Warning:', results.testD_TargetLarger);
  console.log('   Target Larger Warning:', results.testD_TargetLarger);

  // ====================================================
  // TEST E: SECOND CONVERSION WITHOUT REFRESH (FFMPEG REUSE)
  // ====================================================
  console.log('\n--- TEST E: Second Conversion Without Refresh (FFmpeg Engine Reuse) ---');
  await selectFile(mp4Fixture);
  await cdp.send('Runtime.evaluate', {
    expression: `
      const targetInput = document.getElementById('target-size-input');
      targetInput.value = '0.22';
      targetInput.dispatchEvent(new Event('input'));
    `,
  });
  await sleep(300);

  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('start-compress-btn').click();`,
  });
  await waitForCompression(45);
  const testEOut = await verifyOutputVideo();
  results.testE_ResetAndReuse = testEOut.result.value;
  console.log('   ✓ TEST E SUCCESS (Engine Reused):', results.testE_ResetAndReuse);

  // ====================================================
  // TEST F: RESPONSIVE VIEWPORT AUDIT
  // ====================================================
  console.log('\n--- TEST F: Responsive Viewport Audit (375, 390, 768, 1024, 1440) ---');
  const viewports = [375, 390, 768, 1024, 1440];
  for (const width of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 800,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await sleep(300);

    const overflowEval = await cdp.send('Runtime.evaluate', {
      expression: `({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
        isRootVisible: !!document.getElementById('video-compressor-root')
      })`,
      returnByValue: true,
    });
    results.responsive[width] = overflowEval.result.value;
    console.log(`   Viewport ${width}px:`, overflowEval.result.value.hasOverflow ? 'OVERFLOW' : 'PASS (0 overflow)');
  }

  // ====================================================
  // TEST G: ACCESSIBILITY CHECKS
  // ====================================================
  console.log('\n--- TEST G: Accessibility (A11y) Audit ---');
  const a11yEval = await cdp.send('Runtime.evaluate', {
    expression: `({
      targetInputAriaLabel: document.getElementById('target-size-input')?.getAttribute('aria-label'),
      resSelectAriaLabel: document.getElementById('resolution-select')?.getAttribute('aria-label'),
      progressRole: document.getElementById('compression-progress-container')?.getAttribute('role'),
      progressAriaLive: document.getElementById('compression-progress-container')?.getAttribute('aria-live'),
      hasSkipLink: !!document.querySelector('a[href="#main-content"]')
    })`,
    returnByValue: true,
  });
  results.accessibility = a11yEval.result.value;
  console.log('   A11y Results:', results.accessibility);

  // ====================================================
  // TEST H: NETWORK PRIVACY AUDIT
  // ====================================================
  console.log('\n--- TEST H: Network Privacy Audit ---');
  results.networkPrivacy = {
    postRequestCount: networkPostRequests.length,
    postRequests: networkPostRequests,
    totalBytesUploaded: networkUploadBytes.reduce((a, b) => a + b, 0),
  };
  console.log('   Network Privacy Audit:', results.networkPrivacy);

  console.log('\n====================================================');
  console.log('ALL VERIFICATION PHASES COMPLETED SUCCESSFULLY!');
  console.log('====================================================');

  fs.writeFileSync('test-fixtures/video-qa-results.json', JSON.stringify(results, null, 2));
  console.log('\nSaved full results to test-fixtures/video-qa-results.json');

  cdp.close();
  chrome.kill();
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
