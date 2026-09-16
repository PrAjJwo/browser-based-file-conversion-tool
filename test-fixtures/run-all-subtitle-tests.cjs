const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/pdf/subtitle-converter';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_sub_test_' + Date.now());

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
  console.log('STARTING COMPLETE SUBTITLE CONVERTER TEST SUITE');
  console.log(`Target URL: ${DEV_URL}`);
  console.log('====================================================\n');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9230',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9230/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) {
    throw new Error('No page target found in headless Chrome.');
  }

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Network.enable');

  const networkRequests = [];
  client.on('Network.requestWillBeSent', (params) => {
    networkRequests.push({
      url: params.request.url,
      method: params.request.method,
      postData: params.request.postData,
    });
  });

  console.log(`Navigating to ${DEV_URL}...`);
  await client.send('Page.navigate', { url: DEV_URL });
  await sleep(2000);

  async function evaluate(expression) {
    const res = await client.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
    }
    return res.result.value;
  }

  let totalPassed = 0;
  let totalFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      totalPassed++;
    } else {
      console.error(`  FAIL: ${message}`);
      totalFailed++;
    }
  }

  // Load fixtures as base64 or text into browser helper
  const fixturesDir = __dirname;
  const sampleSrt = fs.readFileSync(path.join(fixturesDir, 'sample.srt'), 'utf8');
  const sampleVtt = fs.readFileSync(path.join(fixturesDir, 'sample.vtt'), 'utf8');
  const sampleTxt = fs.readFileSync(path.join(fixturesDir, 'sample.txt'), 'utf8');
  const unicodeSrt = fs.readFileSync(path.join(fixturesDir, 'unicode.srt'), 'utf8');
  const malformedSrt = fs.readFileSync(path.join(fixturesDir, 'malformed.srt'), 'utf8');
  const largeSrt = fs.readFileSync(path.join(fixturesDir, 'large.srt'), 'utf8');

  // Inject helper in window to dispatch synthetic File objects to the dropzone
  await evaluate(`
    window.__simulateFileSelection = function(content, filename, mimeType) {
      const blob = new Blob([content], { type: mimeType || 'text/plain' });
      const file = new File([blob], filename, { type: mimeType || 'text/plain', lastModified: Date.now() });
      document.dispatchEvent(new CustomEvent('file-dropzone:files-selected', {
        detail: { files: [file] },
        bubbles: true
      }));
    };
  `);

  // =========================================================================
  // TEST 1: SRT -> VTT CONVERSION
  // =========================================================================
  console.log('\n--- TEST 1: SRT -> VTT Conversion ---');
  await evaluate(`window.__simulateFileSelection(${JSON.stringify(sampleSrt)}, 'sample.srt', 'application/x-subrip')`);
  await sleep(400);

  const t1Summary = await evaluate(`({
    workspaceVisible: !document.getElementById('sub-workspace-section').classList.contains('hidden'),
    filename: document.getElementById('sub-filename').textContent,
    detectedBadge: document.getElementById('sub-detected-badge').textContent,
    cueCount: document.getElementById('sub-cue-count').textContent,
    duration: document.getElementById('sub-duration').textContent,
    outputFilename: document.getElementById('sub-output-filename').value,
    targetFormat: document.getElementById('sub-target-format').value
  })`);

  assert(t1Summary.workspaceVisible, 'Workspace section unhidden after loading SRT');
  assert(t1Summary.filename === 'sample.srt', `Filename displayed: ${t1Summary.filename}`);
  assert(t1Summary.detectedBadge === 'SRT', `Detected format badge: ${t1Summary.detectedBadge}`);
  assert(t1Summary.cueCount === '3 cues', `Cue count: ${t1Summary.cueCount}`);
  assert(t1Summary.targetFormat === 'vtt', `Default target format for SRT is VTT`);
  assert(t1Summary.outputFilename === 'sample.vtt', `Output filename correctly set to sample.vtt`);

  // Click Convert Subtitles
  await evaluate(`document.getElementById('sub-convert-btn').click()`);
  await sleep(300);

  const t1Result = await evaluate(`({
    resultCardVisible: !document.getElementById('sub-result-card').classList.contains('hidden'),
    downloadBtnVisible: !document.getElementById('sub-download-btn').classList.contains('hidden'),
    resultFilename: document.getElementById('sub-result-filename').textContent,
    statusText: document.getElementById('sub-status-msg').textContent
  })`);

  assert(t1Result.resultCardVisible, 'Result card is visible after conversion');
  assert(t1Result.downloadBtnVisible, 'Download button is visible');
  assert(t1Result.resultFilename === 'sample.vtt', `Result filename: ${t1Result.resultFilename}`);
  assert(t1Result.statusText.includes('Conversion complete'), `Status: ${t1Result.statusText}`);

  // Test Download action
  let downloadTriggered = false;
  await evaluate(`
    window.__downloadTriggered = false;
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.download) {
        window.__downloadTriggered = {
          filename: this.download,
          hrefLength: this.href.length
        };
      }
      return origClick.apply(this, arguments);
    };
  `);
  await evaluate(`document.getElementById('sub-download-btn').click()`);
  await sleep(300);
  const dlCheck = await evaluate(`window.__downloadTriggered`);
  assert(dlCheck && dlCheck.filename === 'sample.vtt', `Download triggered for: ${dlCheck?.filename}`);

  // =========================================================================
  // TEST 2: VTT -> SRT REVERSE CONVERSION
  // =========================================================================
  console.log('\n--- TEST 2: VTT -> SRT Reverse Conversion ---');
  await evaluate(`window.__simulateFileSelection(${JSON.stringify(sampleVtt)}, 'sample.vtt', 'text/vtt')`);
  await sleep(400);

  const t2Summary = await evaluate(`({
    detectedBadge: document.getElementById('sub-detected-badge').textContent,
    cueCount: document.getElementById('sub-cue-count').textContent,
    targetFormat: document.getElementById('sub-target-format').value,
    outputFilename: document.getElementById('sub-output-filename').value
  })`);

  assert(t2Summary.detectedBadge === 'VTT', `Detected format badge: ${t2Summary.detectedBadge}`);
  assert(t2Summary.cueCount === '3 cues', `Cue count: ${t2Summary.cueCount}`);
  assert(t2Summary.targetFormat === 'srt', `Default target format for VTT is SRT`);
  assert(t2Summary.outputFilename === 'sample.srt', `Output filename set to sample.srt`);

  await evaluate(`document.getElementById('sub-convert-btn').click()`);
  await sleep(300);

  const t2Result = await evaluate(`({
    resultFilename: document.getElementById('sub-result-filename').textContent,
    resultInfo: document.getElementById('sub-result-info').textContent
  })`);

  assert(t2Result.resultFilename === 'sample.srt', `Result filename: ${t2Result.resultFilename}`);
  assert(t2Result.resultInfo.includes('SRT'), `Result info mentions SRT: ${t2Result.resultInfo}`);

  // =========================================================================
  // TEST 3: SUBTITLES -> TXT DIALOGUE EXTRACTION
  // =========================================================================
  console.log('\n--- TEST 3: SRT -> TXT Extraction ---');
  await evaluate(`window.__simulateFileSelection(${JSON.stringify(sampleSrt)}, 'movie.srt', 'application/x-subrip')`);
  await sleep(400);

  // Change target format to TXT
  await evaluate(`
    const sel = document.getElementById('sub-target-format');
    sel.value = 'txt';
    sel.dispatchEvent(new Event('change'));
  `);
  await sleep(200);

  const t3Check = await evaluate(`({
    outputFilename: document.getElementById('sub-output-filename').value,
    txtModeVisible: !document.getElementById('sub-txt-mode-container').classList.contains('hidden')
  })`);

  assert(t3Check.outputFilename === 'movie.txt', `Output filename updated to movie.txt`);
  assert(t3Check.txtModeVisible, `TXT extraction mode dropdown visible`);

  await evaluate(`document.getElementById('sub-convert-btn').click()`);
  await sleep(300);

  const t3Result = await evaluate(`({
    resultFilename: document.getElementById('sub-result-filename').textContent,
    resultInfo: document.getElementById('sub-result-info').textContent
  })`);

  assert(t3Result.resultFilename === 'movie.txt', `TXT result filename: ${t3Result.resultFilename}`);
  assert(t3Result.resultInfo.includes('TXT'), `Result info mentions TXT: ${t3Result.resultInfo}`);

  // =========================================================================
  // TEST 4: PLAIN TXT WITHOUT TIMESTAMPS (HANDLING BOUNDARIES)
  // =========================================================================
  console.log('\n--- TEST 4: Plain TXT Without Timestamps ---');
  await evaluate(`window.__simulateFileSelection(${JSON.stringify(sampleTxt)}, 'notes.txt', 'text/plain')`);
  await sleep(400);

  const t4Summary = await evaluate(`({
    detectedBadge: document.getElementById('sub-detected-badge').textContent,
    cueCount: document.getElementById('sub-cue-count').textContent,
    timingStatus: document.getElementById('sub-timing-status').textContent,
    warningVisible: !document.getElementById('sub-warning-banner').classList.contains('hidden'),
    warningText: document.getElementById('sub-warning-list').textContent,
    optionsCount: document.getElementById('sub-target-format').options.length
  })`);

  assert(t4Summary.detectedBadge === 'TXT', `Detected format: ${t4Summary.detectedBadge}`);
  assert(t4Summary.cueCount === '0 cues', `Cue count: 0 cues`);
  assert(t4Summary.timingStatus === 'No Timestamps', `Timing status: ${t4Summary.timingStatus}`);
  assert(t4Summary.warningVisible, 'Warning banner displayed for untimed text');
  assert(t4Summary.warningText.includes('Plain TXT files do not contain subtitle timing'), 'Actionable warning explains timestamps cannot be inferred');
  assert(t4Summary.optionsCount === 1, 'Only TXT option available for untimed text (no fake timestamps)');

  // =========================================================================
  // TEST 5: MALFORMED SUBTITLE RESILIENCE
  // =========================================================================
  console.log('\n--- TEST 5: Malformed Subtitle Resilience ---');
  await evaluate(`window.__simulateFileSelection(${JSON.stringify(malformedSrt)}, 'broken.srt', 'application/x-subrip')`);
  await sleep(400);

  const t5Summary = await evaluate(`({
    workspaceVisible: !document.getElementById('sub-workspace-section').classList.contains('hidden'),
    warningVisible: !document.getElementById('sub-warning-banner').classList.contains('hidden'),
    warningListCount: document.getElementById('sub-warning-list').children.length,
    cueCount: document.getElementById('sub-cue-count').textContent,
    timingStatus: document.getElementById('sub-timing-status').textContent
  })`);

  assert(t5Summary.workspaceVisible, 'Page did not crash on malformed subtitle file');
  assert(t5Summary.warningVisible, 'Validation warning banner is displayed');
  assert(t5Summary.warningListCount >= 2, `Identified ${t5Summary.warningListCount} distinct malformed issues`);
  assert(t5Summary.timingStatus === 'Timing Warnings', `Timing status flags warnings: ${t5Summary.timingStatus}`);

  // =========================================================================
  // TEST 6: TEXTAREA EDITOR & LIVE RE-VALIDATION
  // =========================================================================
  console.log('\n--- TEST 6: Textarea Editor & Live Re-validation ---');
  await evaluate(`window.__simulateFileSelection(${JSON.stringify(sampleSrt)}, 'editor_test.srt', 'application/x-subrip')`);
  await sleep(400);

  // Edit textarea content
  await evaluate(`
    const ta = document.getElementById('sub-editor-textarea');
    ta.value = '1\\n00:00:01,000 --> 00:00:04,500\\nEDITED: Live Editor Verification Succeeded!\\n';
    ta.dispatchEvent(new Event('input'));
  `);
  await sleep(300);

  const t6Summary = await evaluate(`({
    cueCount: document.getElementById('sub-cue-count').textContent,
    timingStatus: document.getElementById('sub-timing-status').textContent,
    warningHidden: document.getElementById('sub-warning-banner').classList.contains('hidden')
  })`);

  assert(t6Summary.cueCount === '1 cues', `Cue count dynamically updated to 1 cue`);
  assert(t6Summary.timingStatus === 'Valid Timecodes', `Timing status valid`);
  assert(t6Summary.warningHidden, 'Zero warnings for clean edited cue');

  // Convert edited text
  await evaluate(`document.getElementById('sub-convert-btn').click()`);
  await sleep(300);
  const t6Result = await evaluate(`document.getElementById('sub-status-msg').textContent`);
  assert(t6Result.includes('Conversion complete'), `Status shows complete: ${t6Result}`);

  // Test Reset button
  await evaluate(`document.getElementById('sub-reset-btn').click()`);
  await sleep(300);
  const t6Reset = await evaluate(`document.getElementById('sub-cue-count').textContent`);
  assert(t6Reset === '3 cues', `Reset restored original 3 cues`);

  // =========================================================================
  // TEST 7: UNICODE, CJK, ARABIC & EMOJI
  // =========================================================================
  console.log('\n--- TEST 7: Unicode, CJK, Arabic & Emoji Integrity ---');
  await evaluate(`window.__simulateFileSelection(${JSON.stringify(unicodeSrt)}, 'multilingual.srt', 'application/x-subrip')`);
  await sleep(400);

  const t7Summary = await evaluate(`({
    cueCount: document.getElementById('sub-cue-count').textContent,
    timingStatus: document.getElementById('sub-timing-status').textContent
  })`);

  assert(t7Summary.cueCount === '5 cues', `Parsed 5 multilingual cues`);
  assert(t7Summary.timingStatus === 'Valid Timecodes', `Timestamps valid across all languages`);

  await evaluate(`document.getElementById('sub-convert-btn').click()`);
  await sleep(300);
  const t7Result = await evaluate(`document.getElementById('sub-result-filename').textContent`);
  assert(t7Result === 'multilingual.vtt', `Successfully converted to multilingual.vtt`);

  // =========================================================================
  // TEST 8: LARGE FILE PERFORMANCE (250 CUES)
  // =========================================================================
  console.log('\n--- TEST 8: Large File Performance (250 cues) ---');
  const tStart = Date.now();
  await evaluate(`window.__simulateFileSelection(${JSON.stringify(largeSrt)}, 'large_movie.srt', 'application/x-subrip')`);
  await sleep(500);

  const t8Summary = await evaluate(`({
    cueCount: document.getElementById('sub-cue-count').textContent,
    duration: document.getElementById('sub-duration').textContent
  })`);

  await evaluate(`document.getElementById('sub-convert-btn').click()`);
  await sleep(400);
  const tEnd = Date.now();

  assert(t8Summary.cueCount === '250 cues', `250 cues loaded in browser`);
  console.log(`  Performance: 250 cues parsed, rendered, and converted in ${tEnd - tStart}ms`);
  assert(tEnd - tStart < 2500, 'Large file processed under 2.5 seconds');

  // =========================================================================
  // TEST 9: NETWORK PRIVACY AUDIT
  // =========================================================================
  console.log('\n--- TEST 9: Network Privacy Audit ---');
  const postRequests = networkRequests.filter((r) => r.method === 'POST');
  const externalRequests = networkRequests.filter(
    (r) =>
      !r.url.startsWith('http://localhost:4321') &&
      !r.url.startsWith('chrome-extension://') &&
      !r.url.includes('fonts.googleapis.com') &&
      !r.url.includes('fonts.gstatic.com')
  );

  console.log(`  Total network requests during suite: ${networkRequests.length}`);
  console.log(`  Total POST requests: ${postRequests.length}`);
  console.log(`  External non-font requests: ${externalRequests.length}`);

  assert(postRequests.length === 0, 'Zero POST requests made to any server');
  assert(externalRequests.length === 0, 'Zero remote external requests or conversion API calls');

  // =========================================================================
  // TEST 10: RESPONSIVE VIEWPORT OVERFLOW AUDIT
  // =========================================================================
  console.log('\n--- TEST 10: Responsive Viewport Overflow Audit ---');
  const viewports = [
    { width: 375, height: 667, name: 'Mobile (375px)' },
    { width: 390, height: 844, name: 'iPhone (390px)' },
    { width: 768, height: 1024, name: 'Tablet (768px)' },
    { width: 1024, height: 768, name: 'Desktop (1024px)' },
    { width: 1440, height: 900, name: 'Large Desktop (1440px)' },
  ];

  for (const vp of viewports) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 768,
    });
    await sleep(200);

    const overflow = await evaluate(`({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    })`);

    assert(!overflow.hasOverflow, `${vp.name}: 0 horizontal overflow (scroll: ${overflow.scrollWidth}px vs client: ${overflow.clientWidth}px)`);
  }

  // =========================================================================
  // TEST 11: ACCESSIBILITY (A11Y) AUDIT
  // =========================================================================
  console.log('\n--- TEST 11: Accessibility (A11y) Audit ---');
  const a11y = await evaluate(`({
    statusHasRole: document.getElementById('sub-status-msg').getAttribute('role') === 'status',
    statusHasLive: document.getElementById('sub-status-msg').getAttribute('aria-live') === 'polite',
    textareaHasLabel: !!document.getElementById('sub-editor-textarea').getAttribute('aria-label'),
    targetSelectHasLabel: !!document.getElementById('sub-target-format').getAttribute('aria-label'),
    outputInputHasLabel: !!document.getElementById('sub-output-filename').getAttribute('aria-label'),
    warningHasAlertRole: document.getElementById('sub-warning-banner').getAttribute('role') === 'alert'
  })`);

  assert(a11y.statusHasRole, 'Status message has role="status"');
  assert(a11y.statusHasLive, 'Status message has aria-live="polite"');
  assert(a11y.textareaHasLabel, 'Editor textarea has accessible aria-label');
  assert(a11y.targetSelectHasLabel, 'Format select has accessible aria-label');
  assert(a11y.outputInputHasLabel, 'Output filename input has accessible aria-label');
  assert(a11y.warningHasAlertRole, 'Warning banner has role="alert"');

  console.log('\n====================================================');
  console.log(`SUBTITLE TEST SUITE SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('====================================================\n');

  client.close();
  chrome.kill();

  if (totalFailed > 0) {
    process.exit(1);
  }
})().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
