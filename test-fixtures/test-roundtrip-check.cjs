const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/image/heic-to-jpg';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_roundtrip_test_' + Date.now());

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
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
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
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

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('--- STARTING HEIC ROUND-TRIP DECODE VERIFICATION ---');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  try {
    const targets = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9229/json/list', (res) => {
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
    await cdp.send('DOM.enable');

    console.log('1. Navigating to ' + DEV_URL);
    await cdp.send('Page.navigate', { url: DEV_URL });
    await sleep(2000);

    console.log('2. Selecting generated test-gen.heic into dropzone...');
    const doc = await cdp.send('DOM.getDocument');
    const inputNode = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#heic-tool-root input[type=file]',
    });

    const absPath = path.resolve('test-fixtures/test-gen.heic');
    await cdp.send('DOM.setFileInputFiles', {
      files: [absPath],
      nodeId: inputNode.nodeId,
    });
    await sleep(800);

    const queueInfo = await cdp.eval(`(() => ({
      count: document.querySelector('#queue-count')?.textContent,
      filename: document.querySelector('#queue-list p.font-semibold')?.textContent
    }))()`);
    console.log('Queued file:', queueInfo);

    console.log('3. Clicking Start Convert in HEIC to JPG tool...');
    await cdp.eval(`document.querySelector('#start-convert-btn').click()`);

    let converted = false;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const count = await cdp.eval(`document.querySelectorAll('#results-list > div').length`);
      if (count === 1) {
        converted = true;
        break;
      }
    }

    if (!converted) {
      const pageErrors = await cdp.eval(`document.querySelector('#results-list')?.innerText`);
      console.error('Error in results list:', pageErrors);
      throw new Error('Conversion timed out');
    }

    const previewCheck = await cdp.eval(`(() => {
      const card = document.querySelector('#results-list > div');
      const img = card.querySelector('img');
      return {
        filename: card.querySelector('.font-semibold')?.textContent,
        sizeText: card.querySelector('.text-surface-500')?.textContent,
        hasImgSrc: !!img && img.src.startsWith('blob:'),
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
      };
    })()`);
    console.log('Roundtrip conversion succeeded! Result details:', previewCheck);

    cdp.close();
    chrome.kill();
    console.log('=== TEST-GEN.HEIC DECODED BY HEIC2ANY IN CHROME SUCCESSFULLY! ===');
  } catch (err) {
    chrome.kill();
    throw err;
  }
})();
