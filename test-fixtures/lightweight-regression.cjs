const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/image/heic-to-jpg';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_reg_test_' + Date.now());

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
  console.log('--- STARTING LIGHTWEIGHT HEIC REGRESSION TEST ---');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9226/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page');
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  cdp.on('Runtime.consoleAPICalled', (params) => {
    console.log('   [BROWSER LOG]', params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' '));
  });
  cdp.on('Runtime.exceptionThrown', (params) => {
    console.log('   [BROWSER EXCEPTION]', JSON.stringify(params.exceptionDetails));
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2000);

  // Hook download anchor click to record downloads
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

  // 1. File Selection
  console.log('1. Selecting autumn_1440x960.heic...');
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

  const queueCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      return {
        count: document.querySelector('#queue-count')?.textContent,
        filename: document.querySelector('#queue-list p.font-semibold')?.textContent
      };
    })()`,
    returnByValue: true,
  });
  console.log('Queued file:', queueCheck.result.value);

  // 2. Conversion
  console.log('2. Converting to JPG...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#start-convert-btn').click()`,
  });

  let converted = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const count = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#results-list > div').length`,
      returnByValue: true,
    });
    if (count.result.value === 1) {
      converted = true;
      break;
    }
  }

  if (!converted) {
    const debug = await cdp.send('Runtime.evaluate', {
      expression: `({
        results: document.querySelector('#results-list')?.innerHTML,
        queue: document.querySelector('#queue-list')?.innerHTML,
        btn: document.querySelector('#start-convert-btn')?.outerHTML
      })`,
      returnByValue: true,
    });
    console.error('Debug DOM on timeout:', debug.result.value);
    throw new Error('Conversion timed out');
  }
  console.log('Conversion succeeded: 1 result card generated');

  // 3. Result Preview
  const previewCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('#results-list > div');
      const img = card.querySelector('img');
      return {
        filename: card.querySelector('.font-semibold')?.textContent,
        sizeText: card.querySelector('.text-surface-500')?.textContent,
        hasImgSrc: !!img && img.src.startsWith('blob:'),
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
      };
    })()`,
    returnByValue: true,
  });
  console.log('3. Result preview details:', previewCheck.result.value);

  // 4. Individual Download
  console.log('4. Clicking Download JPG button...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#results-list button').click()`,
  });
  await sleep(500);

  const dlCheck = await cdp.send('Runtime.evaluate', {
    expression: `window.__downloads`,
    returnByValue: true,
  });
  console.log('Downloaded payload:', dlCheck.result.value);

  cdp.close();
  chrome.kill();

  // 5. Route status check
  console.log('\n5. Checking Route Statuses...');
  const activeRoutes = [
    { path: '/video/video-compressor', rootId: 'video-compressor-root' },
    { path: '/image/jpg-to-heic', rootId: 'jpg-tool-root' },
    { path: '/pdf/image-to-pdf', rootId: 'image-to-pdf-root' },
    { path: '/pdf/subtitle-converter', rootId: 'subtitle-converter-root' },
    { path: '/image/image-resizer', rootId: 'image-resizer-root' },
    { path: '/image/image-compressor', rootId: 'image-compressor-root' },
    { path: '/image/image-converter', rootId: 'image-converter-root' },
  ];

  for (const r of activeRoutes) {
    await new Promise((resolve, reject) => {
      http.get('http://localhost:4321' + r.path, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const isActive = body.includes(r.rootId);
          console.log(`Route ${r.path}: Status ${res.statusCode}, Active: ${isActive}`);
          if (!isActive) reject(new Error(`Expected ${r.path} to be ACTIVE`));
          resolve();
        });
      }).on('error', reject);
    });
  }

  const comingSoonRoutes = [];

  for (const r of comingSoonRoutes) {
    await new Promise((resolve, reject) => {
      http.get('http://localhost:4321' + r, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const isComingSoon = body.includes('Foundation Stage: Coming Soon') || body.includes('Coming Soon');
          console.log(`Route ${r}: Status ${res.statusCode}, Coming Soon: ${isComingSoon}`);
          if (!isComingSoon) reject(new Error(`Expected ${r} to be Coming Soon`));
          resolve();
        });
      }).on('error', reject);
    });
  }

  console.log('\n--- LIGHTWEIGHT REGRESSION PASSED SUCCESSFULLY ---');
  process.exit(0);
})().catch((err) => {
  console.error('Regression failed:', err);
  process.exit(1);
});
