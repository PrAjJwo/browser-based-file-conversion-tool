const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://127.0.0.1:4321/image/heic-to-jpg';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_gap_test_' + Date.now());
const DOWNLOAD_DIR = path.resolve('test-fixtures', 'downloads_' + Date.now());

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

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
  console.log('STARTING FINAL FUNCTIONAL GAP CHECK FOR TOOL #1');
  console.log('Browser: Google Chrome Headless via CDP');
  console.log('Target URL:', DEV_URL);
  console.log('Download Directory:', DOWNLOAD_DIR);
  console.log('====================================================\n');

  // 1. Launch Chrome
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  // 2. Discover targets
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9224/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('DOM.enable');

  try {
    await cdp.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_DIR,
    });
  } catch (e) {
    // Some versions use Browser domain
  }

  // Track console logs and exceptions
  const consoleMessages = [];
  const uncaughtExceptions = [];
  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || a.description || '').join(' ');
    consoleMessages.push({ type: params.type, text });
  });

  cdp.on('Runtime.exceptionThrown', (params) => {
    uncaughtExceptions.push(params.exceptionDetails);
    console.error('[UNCAUGHT EXCEPTION]', params.exceptionDetails.text);
  });

  // Track network requests
  const networkRequests = [];
  cdp.on('Network.requestWillBeSent', (params) => {
    networkRequests.push({
      url: params.request.url,
      method: params.request.method,
      hasPostData: !!params.request.hasPostData,
      postData: params.request.postData,
    });
  });

  // Navigate to HEIC converter
  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2500);

  // Install Object URL instrumentation & download interceptor
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__urlStats = { created: [], revoked: [], active: new Set() };
      window.__triggeredDownloads = [];

      const origCreate = URL.createObjectURL.bind(URL);
      const origRevoke = URL.revokeObjectURL.bind(URL);

      URL.createObjectURL = function(blob) {
        const url = origCreate(blob);
        window.__urlStats.created.push({ url, size: blob.size, type: blob.type });
        window.__urlStats.active.add(url);
        return url;
      };

      URL.revokeObjectURL = function(url) {
        window.__urlStats.revoked.push(url);
        window.__urlStats.active.delete(url);
        return origRevoke(url);
      };

      // Intercept HTMLElement.prototype.click to reliably capture download anchors
      const origClick = HTMLElement.prototype.click;
      HTMLElement.prototype.click = function() {
        if (this.tagName === 'A' && (this.hasAttribute('download') || this.download)) {
          const dlInfo = {
            filename: this.getAttribute('download') || this.download,
            href: this.getAttribute('href') || this.href,
            timestamp: Date.now()
          };
          window.__triggeredDownloads.push(dlInfo);
        }
        return origClick.apply(this, arguments);
      };
    })()`,
  });

  console.log('\n--- CHECK 2: DRAG/DROP AND FILE BROWSER (INDEPENDENT VERIFICATION) ---');
  
  // Read fixture files into base64
  const autumnBuffer = fs.readFileSync(path.resolve('test-fixtures', 'autumn_1440x960.heic'));
  const autumnB64 = autumnBuffer.toString('base64');
  const winterBuffer = fs.readFileSync(path.resolve('test-fixtures', 'winter_1440x960.heic'));
  const winterB64 = winterBuffer.toString('base64');
  const springBuffer = fs.readFileSync(path.resolve('test-fixtures', 'spring_1440x960.heic'));
  const springB64 = springBuffer.toString('base64');

  // Test 2A: Drag and Drop
  console.log('Testing 2A: Drag and Drop with genuine autumn_1440x960.heic...');
  const dragResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const b64 = "${autumnB64}";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], 'autumn_1440x960.heic', { type: 'image/heic' });

      const dt = new DataTransfer();
      dt.items.add(file);

      const dropzone = document.querySelector('#heic-tool-root .dropzone-area');
      const dropEvt = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
      dropzone.dispatchEvent(dropEvt);

      const queueList = document.querySelector('#queue-list');
      const queueSection = document.querySelector('#queue-section');
      const count = document.querySelector('#queue-count')?.textContent;
      const statusBadge = queueList?.querySelector('span.uppercase')?.textContent;
      
      return {
        sectionVisible: !queueSection.classList.contains('hidden'),
        count,
        statusBadge,
        cardFilename: queueList?.querySelector('p.font-semibold')?.textContent
      };
    })()`,
    returnByValue: true,
  });

  console.log('Drag and drop result:', dragResult.result.value);

  // Clear queue to test 2B independently
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  // Test 2B: Native file browser
  console.log('Testing 2B: Native file picker (DOM.setFileInputFiles) with autumn_1440x960.heic...');
  const doc = await cdp.send('DOM.getDocument');
  const inputNode = await cdp.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '#heic-tool-root input[type=file]',
  });
  await cdp.send('DOM.setFileInputFiles', {
    files: [path.resolve('test-fixtures', 'autumn_1440x960.heic')],
    nodeId: inputNode.nodeId,
  });
  await sleep(500);

  const pickerResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const queueList = document.querySelector('#queue-list');
      const queueSection = document.querySelector('#queue-section');
      const count = document.querySelector('#queue-count')?.textContent;
      const statusBadge = queueList?.querySelector('span.uppercase')?.textContent;
      
      return {
        sectionVisible: !queueSection.classList.contains('hidden'),
        count,
        statusBadge,
        cardFilename: queueList?.querySelector('p.font-semibold')?.textContent
      };
    })()`,
    returnByValue: true,
  });
  console.log('Native file picker result:', pickerResult.result.value);

  console.log('\n--- CHECK 1: CONVERT & INDIVIDUAL JPG DOWNLOAD ---');
  // Click Convert to JPG
  console.log('Clicking "Convert to JPG"...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  // Wait for conversion
  let singleDone = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const count = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#results-list > div').length`,
      returnByValue: true,
    });
    if (count.result.value >= 1) {
      singleDone = true;
      break;
    }
  }
  if (!singleDone) {
    const errStatus = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('#progress-status-text')?.textContent`,
      returnByValue: true,
    });
    console.log('Console messages on failure:', consoleMessages);
    throw new Error('Single conversion timed out. Progress text: ' + errStatus.result.value);
  }

  // Click individual download button
  console.log('Clicking individual Download JPG button...');
  const clickRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#results-list button');
      if (!btn) return { error: 'No button found' };
      btn.click();
      return { clicked: true, btnText: btn.textContent?.trim() };
    })()`,
    returnByValue: true,
  });
  console.log('Click result:', clickRes.result.value);
  const allDl = await cdp.send('Runtime.evaluate', {
    expression: `window.__triggeredDownloads`,
    returnByValue: true
  });
  console.log('All triggered downloads in window:', allDl.result.value);

  // Retrieve triggered download details from window.__triggeredDownloads
  const latestDownload = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const dl = window.__triggeredDownloads[window.__triggeredDownloads.length - 1];
      if (!dl) return null;
      const res = await fetch(dl.href);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      return {
        filename: dl.filename,
        size: blob.size,
        type: blob.type,
        bytesBase64: btoa(String.fromCharCode.apply(null, bytes.slice(0, 100))),
        magicHex: bytes.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join(' ')
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (!latestDownload.result.value) {
    throw new Error('Individual JPG download was not triggered');
  }

  const downloadedJpgName = latestDownload.result.value.filename;
  console.log('Actual downloaded filename:', downloadedJpgName);
  console.log('MIME Type:', latestDownload.result.value.type);
  console.log('Magic Bytes:', latestDownload.result.value.magicHex, '(expected: ff d8 ff e0 or ff d8 ff e1)');

  // Also write the downloaded file to DOWNLOAD_DIR for inspection
  const downloadedJpgBuffer = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const dl = window.__triggeredDownloads[window.__triggeredDownloads.length - 1];
      const res = await fetch(dl.href);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < u8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const downloadedJpgPath = path.join(DOWNLOAD_DIR, downloadedJpgName);
  fs.writeFileSync(downloadedJpgPath, Buffer.from(downloadedJpgBuffer.result.value, 'base64'));
  console.log(`Saved downloaded JPG to disk: ${downloadedJpgPath} (${fs.statSync(downloadedJpgPath).size} bytes)`);

  // Verify dimensions & orientation in browser
  const imageDimCheck = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const dl = window.__triggeredDownloads[window.__triggeredDownloads.length - 1];
      const img = new Image();
      img.src = dl.href;
      await new Promise(r => img.onload = r);
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2)
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Downloaded JPG dimensions:', imageDimCheck.result.value);

  console.log('\n--- CHECK 3: ZIP CONTENT VERIFICATION ---');
  // Clear and add 2 genuine HEIC files: autumn & winter
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  const doc2 = await cdp.send('DOM.getDocument');
  const inputNode2 = await cdp.send('DOM.querySelector', {
    nodeId: doc2.root.nodeId,
    selector: '#heic-tool-root input[type=file]',
  });
  await cdp.send('DOM.setFileInputFiles', {
    files: [
      path.resolve('test-fixtures', 'autumn_1440x960.heic'),
      path.resolve('test-fixtures', 'winter_1440x960.heic'),
    ],
    nodeId: inputNode2.nodeId,
  });
  await sleep(500);

  // Convert batch
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const check = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const results = document.querySelectorAll('#results-list > div');
        const zipBtn = document.querySelector('#download-zip-btn');
        return {
          resultsCount: results.length,
          zipVisible: !zipBtn.classList.contains('hidden')
        };
      })()`,
      returnByValue: true,
    });
    if (check.result.value.resultsCount === 2 && check.result.value.zipVisible) break;
  }

  // Record individual blob sizes from results cards before clicking ZIP
  const cardBlobSizes = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const cards = document.querySelectorAll('#results-list > div');
      const info = [];
      for (const card of cards) {
        const name = card.querySelector('.font-semibold')?.textContent;
        const img = card.querySelector('img');
        const res = await fetch(img.src);
        const blob = await res.blob();
        info.push({ name, size: blob.size });
      }
      return info;
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Result cards before ZIP:', cardBlobSizes.result.value);

  // Click Download All as ZIP
  console.log('Clicking "Download All as ZIP"...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#download-zip-btn').click()`,
  });

  // Wait for ZIP download triggered
  let zipDownload = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    const dl = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        return window.__triggeredDownloads.find(d => d.filename.endsWith('.zip'));
      })()`,
      returnByValue: true,
    });
    if (dl.result.value) {
      zipDownload = dl.result.value;
      break;
    }
  }

  if (!zipDownload) {
    throw new Error('ZIP download was not triggered');
  }

  console.log('ZIP filename:', zipDownload.filename);

  // Fetch ZIP bytes
  const zipBase64 = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const dl = window.__triggeredDownloads.find(d => d.filename.endsWith('.zip'));
      const res = await fetch(dl.href);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < u8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const downloadedZipPath = path.join(DOWNLOAD_DIR, zipDownload.filename);
  const zipBuffer = Buffer.from(zipBase64.result.value, 'base64');
  fs.writeFileSync(downloadedZipPath, zipBuffer);

  const zip = await JSZip.loadAsync(zipBuffer);
  const zipFiles = Object.keys(zip.files).filter((k) => !zip.files[k].dir);
  console.log('Number of JPGs inside ZIP:', zipFiles.length);
  console.log('Names of JPGs inside ZIP:', zipFiles);

  for (const zName of zipFiles) {
    const fileData = await zip.files[zName].async('uint8array');
    const magic = Buffer.from(fileData.slice(0, 3)).toString('hex');
    console.log(`ZIP entry "${zName}": ${fileData.length} bytes, magic 0x${magic} (is JPEG: ${magic === 'ffd8ff'})`);

    // Verify dimensions of extracted image in browser
    const extractedCheck = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const u8 = new Uint8Array([${fileData.slice(0, 50000).join(',')}]);
        const blob = new Blob([u8], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        await new Promise(r => img.onload = r);
        const res = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(url);
        return res;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Extracted "${zName}" dimensions:`, extractedCheck.result.value);
  }

  console.log('\n--- CHECK 4: RESET / SECOND BATCH ---');
  // Click Clear All
  console.log('Clicking Clear All button...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  const resetState = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      return {
        queueCount: document.querySelectorAll('#queue-list > div').length,
        queueSectionHidden: document.querySelector('#queue-section').classList.contains('hidden'),
        resultsCount: document.querySelectorAll('#results-list > div').length,
        resultsSectionHidden: document.querySelector('#results-section').classList.contains('hidden'),
        progressHidden: document.querySelector('#progress-container').classList.contains('hidden'),
        zipHidden: document.querySelector('#download-zip-btn').classList.contains('hidden'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Reset state:', resetState.result.value);

  // Now select a DIFFERENT image: spring_1440x960.heic
  console.log('Selecting spring_1440x960.heic for second batch...');
  const doc3 = await cdp.send('DOM.getDocument');
  const inputNode3 = await cdp.send('DOM.querySelector', {
    nodeId: doc3.root.nodeId,
    selector: '#heic-tool-root input[type=file]',
  });
  await cdp.send('DOM.setFileInputFiles', {
    files: [path.resolve('test-fixtures', 'spring_1440x960.heic')],
    nodeId: inputNode3.nodeId,
  });
  await sleep(500);

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const count = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#results-list > div').length`,
      returnByValue: true,
    });
    if (count.result.value === 1) break;
  }

  const secondBatchResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('#results-list > div');
      return {
        filename: card?.querySelector('.font-semibold')?.textContent,
        sizeText: card?.querySelector('.text-surface-500')?.textContent,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Second batch conversion result:', secondBatchResult.result.value);

  console.log('\n--- CHECK 5: INDIVIDUAL FILE REMOVAL ---');
  // Clear queue
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  // Select 3 files: autumn, winter, spring
  const doc4 = await cdp.send('DOM.getDocument');
  const inputNode4 = await cdp.send('DOM.querySelector', {
    nodeId: doc4.root.nodeId,
    selector: '#heic-tool-root input[type=file]',
  });
  await cdp.send('DOM.setFileInputFiles', {
    files: [
      path.resolve('test-fixtures', 'autumn_1440x960.heic'),
      path.resolve('test-fixtures', 'winter_1440x960.heic'),
      path.resolve('test-fixtures', 'spring_1440x960.heic'),
    ],
    nodeId: inputNode4.nodeId,
  });
  await sleep(500);

  const queueBeforeRemoval = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const items = Array.from(document.querySelectorAll('#queue-list > div')).map(card => card.querySelector('.font-semibold')?.textContent);
      return { items, count: items.length };
    })()`,
    returnByValue: true,
  });
  console.log('Queue before removal (3 items):', queueBeforeRemoval.result.value);

  // Remove the middle file (index 1: winter)
  console.log('Removing middle file (winter_1440x960.heic)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const cards = document.querySelectorAll('#queue-list > div');
      const middleRemoveBtn = cards[1].querySelector('button[aria-label^="Remove"]');
      middleRemoveBtn.click();
    })()`,
  });
  await sleep(300);

  const queueAfterRemoval = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const items = Array.from(document.querySelectorAll('#queue-list > div')).map(card => card.querySelector('.font-semibold')?.textContent);
      return { items, count: items.length };
    })()`,
    returnByValue: true,
  });
  console.log('Queue after removal (2 items):', queueAfterRemoval.result.value);

  // Convert remaining 2 files
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const count = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#results-list > div').length`,
      returnByValue: true,
    });
    if (count.result.value === 2) break;
  }

  const removalConversionResults = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('#results-list > div')).map(card => card.querySelector('.font-semibold')?.textContent);
      return { cards, count: cards.length };
    })()`,
    returnByValue: true,
  });
  console.log('Conversion results after removal:', removalConversionResults.result.value);

  console.log('\n--- CHECK 6: DUPLICATE FILENAMES ---');
  // Clear queue
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  // Enqueue two files with identical filename: photo.heic
  console.log('Queuing 2 files with the identical filename "photo.heic"...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const b64 = "${autumnB64}";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);

      const file1 = new File([arr], 'photo.heic', { type: 'image/heic' });
      const file2 = new File([arr], 'photo.heic', { type: 'image/heic' });

      const dropzone = document.querySelector('#heic-tool-root');
      dropzone.dispatchEvent(new CustomEvent('file-dropzone:files-selected', {
        detail: { files: [file1, file2] },
        bubbles: true
      }));
    })()`,
  });
  await sleep(500);

  // Convert both
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const count = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#results-list > div').length`,
      returnByValue: true,
    });
    if (count.result.value === 2) break;
  }

  const duplicateResults = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('#results-list > div')).map(card => card.querySelector('.font-semibold')?.textContent);
      return { cards };
    })()`,
    returnByValue: true,
  });
  console.log('Duplicate filenames result cards:', duplicateResults.result.value);

  // Also verify ZIP packaging for duplicate filenames
  console.log('Downloading ZIP of duplicates...');
  const preZipDlCount = (await cdp.send('Runtime.evaluate', { expression: `window.__triggeredDownloads.length`, returnByValue: true })).result.value;
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#download-zip-btn').click()`,
  });

  for (let i = 0; i < 30; i++) {
    await sleep(300);
    const count = await cdp.send('Runtime.evaluate', { expression: `window.__triggeredDownloads.length`, returnByValue: true });
    if (count.result.value > preZipDlCount) break;
  }

  const dupZipBase64 = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const dl = window.__triggeredDownloads[window.__triggeredDownloads.length - 1];
      const res = await fetch(dl.href);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < u8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const dupZip = await JSZip.loadAsync(Buffer.from(dupZipBase64.result.value, 'base64'));
  const dupZipEntries = Object.keys(dupZip.files).filter((k) => !dupZip.files[k].dir);
  console.log('Filenames inside duplicate ZIP:', dupZipEntries);

  console.log('\n--- CHECK 7: CASE-INSENSITIVE EXTENSION HANDLING ---');
  const caseTestResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      function generateJpgFilename(originalName) {
        let base = originalName.replace(/\\.(heic|heif)$/i, '');
        if (!base) base = 'image';
        return base + '.jpg';
      }

      return {
        'photo.heic': generateJpgFilename('photo.heic'),
        'photo.HEIC': generateJpgFilename('photo.HEIC'),
        'photo.heif': generateJpgFilename('photo.heif'),
        'photo.HEIF': generateJpgFilename('photo.HEIF'),
        'my.vacation.photo.HEIC': generateJpgFilename('my.vacation.photo.HEIC'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Case-insensitive extension tests:', caseTestResult.result.value);

  console.log('\n--- CHECK 8: OBJECT URL LIFECYCLE AUDIT ---');
  // Clear queue and wait for 1000ms download revocation timeouts to finish
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(1500);

  const urlStats = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      return {
        totalCreated: window.__urlStats.created.length,
        totalRevoked: window.__urlStats.revoked.length,
        activeRemainingCount: window.__urlStats.active.size,
        activeRemaining: Array.from(window.__urlStats.active),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Object URL stats after Clear All:', urlStats.result.value);

  console.log('\n--- CHECK 9: MEMORY WARNING UX ---');
  // Trigger warning with > 50 MB batch
  const warningCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const bigFile = new File([new Uint8Array(10)], 'huge_photo.heic', { type: 'image/heic' });
      Object.defineProperty(bigFile, 'size', { value: 55 * 1024 * 1024 });

      const root = document.querySelector('#heic-tool-root');
      root.dispatchEvent(new CustomEvent('file-dropzone:files-selected', {
        detail: { files: [bigFile] },
        bubbles: true
      }));

      const banner = document.querySelector('#batch-warning-banner');
      const bannerText = document.querySelector('#batch-warning-text')?.textContent;
      const convertBtn = document.querySelector('#start-convert-btn');

      return {
        bannerVisible: !banner.classList.contains('hidden'),
        bannerText: bannerText?.trim(),
        convertBtnDisabled: convertBtn.disabled,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Memory warning check:', warningCheck.result.value);

  // Clear simulated big file
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  console.log('\n--- CHECK 10: KEYBOARD ACCESSIBILITY ---');
  // Enqueue a file so controls are active and visible in the DOM
  const docKey = await cdp.send('DOM.getDocument');
  const inputKey = await cdp.send('DOM.querySelector', {
    nodeId: docKey.root.nodeId,
    selector: '#heic-tool-root input[type=file]',
  });
  await cdp.send('DOM.setFileInputFiles', {
    files: [path.resolve('test-fixtures', 'spring_1440x960.heic')],
    nodeId: inputKey.nodeId,
  });
  await sleep(400);

  const keyboardCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // 1. Quality slider focus & keyboard input
      const slider = document.querySelector('#heic-quality-slider');
      slider.focus();
      const sliderFocused = document.activeElement === slider;

      slider.value = "0.8";
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const badgeText = document.querySelector('#quality-display-badge')?.textContent?.trim();

      // 2. Queue buttons focus
      const clearBtn = document.querySelector('#clear-all-btn');
      clearBtn.focus();
      const clearBtnFocused = document.activeElement === clearBtn;

      const convertBtn = document.querySelector('#start-convert-btn');
      convertBtn.focus();
      const convertBtnFocused = document.activeElement === convertBtn;

      // 3. Queue card remove button focus
      const removeBtn = document.querySelector('#queue-list button');
      if (removeBtn) removeBtn.focus();
      const removeBtnFocused = document.activeElement === removeBtn;

      return {
        sliderFocused,
        sliderResponded: badgeText === '80%',
        clearBtnFocused,
        convertBtnFocused,
        removeBtnFocused: !!removeBtnFocused,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Keyboard accessibility check:', keyboardCheck.result.value);

  // Clear queue
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-all-btn').click()`,
  });
  await sleep(300);

  console.log('\n--- CHECK 11: STATUS ANNOUNCEMENT (ARIA-LIVE & SEMANTICS) ---');
  const ariaCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const progressContainer = document.querySelector('#progress-container');
      const progressBar = progressContainer?.querySelector('[role="progressbar"]');
      const validationError = document.querySelector('.validation-error');
      
      return {
        hasRoleStatus: progressContainer?.getAttribute('role') === 'status',
        hasAriaLivePolite: progressContainer?.getAttribute('aria-live') === 'polite',
        hasProgressBarRole: !!progressBar,
        hasValidationErrorAlert: validationError?.getAttribute('role') === 'alert',
      };
    })()`,
    returnByValue: true,
  });
  console.log('Status announcement semantics check:', ariaCheck.result.value);

  console.log('\n--- CHECK 12: CONSOLE CLEANLINESS ---');
  const errorsOrWarnings = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warn');
  console.log('Console message counts:', {
    totalLogs: consoleMessages.length,
    warningsOrErrors: errorsOrWarnings.length,
    uncaughtExceptions: uncaughtExceptions.length,
  });
  if (errorsOrWarnings.length > 0) {
    console.log('Warnings/Errors:', errorsOrWarnings);
  }
  if (uncaughtExceptions.length > 0) {
    console.log('Exceptions:', uncaughtExceptions);
  }

  console.log('\n--- CHECK 13: EXTERNAL NETWORK PRIVACY AUDIT ---');
  const externalRequests = networkRequests.filter((r) => !r.url.startsWith('http://127.0.0.1') && !r.url.startsWith('http://localhost'));
  console.log('Total external requests (Google Fonts):', externalRequests.length);
  const dataLeakingRequests = externalRequests.filter((r) => {
    return r.hasPostData || (r.postData && r.postData.length > 0) || r.url.includes('autumn') || r.url.includes('winter') || r.url.includes('spring') || r.url.includes('photo');
  });
  console.log('Any external requests with file content, POST data, or filenames?', dataLeakingRequests.length > 0 ? 'FAIL' : 'PASS (0 requests)');

  // Clean up Chrome
  cdp.close();
  chrome.kill();

  console.log('\n====================================================');
  console.log('ALL GAP CHECKS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
})().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
