const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/video/video-compressor';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_video_smoke_' + Date.now());

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
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('--- STARTING VIDEO COMPRESSOR LIGHTWEIGHT SMOKE TEST ---');

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
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2000);

  const doc = await cdp.send('DOM.getDocument');
  const inputNode = await cdp.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '#video-compressor-root input[type=file]',
  });

  console.log('1. Selecting sample.mp4...');
  await cdp.send('DOM.setFileInputFiles', {
    files: [path.resolve('test-fixtures', 'sample.mp4')],
    nodeId: inputNode.nodeId,
  });

  // Wait for config card to be ready
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const check = await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('video-config-card')?.getAttribute('data-ready') === 'true'`,
      returnByValue: true,
    });
    if (check.result.value) {
      ready = true;
      break;
    }
  }
  if (!ready) throw new Error('Video metadata failed to load');

  console.log('2. Starting 0.3 MB compression...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('target-size-input').value = '0.3';
      document.getElementById('target-size-input').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('start-compression-btn').click();
    })()`,
  });

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
    console.log('   [BROWSER LOG]', text);
  });

  let compressed = false;
  for (let i = 0; i < 90; i++) {
    await sleep(500);
    const check = await cdp.send('Runtime.evaluate', {
      expression: `!document.getElementById('video-result-card').classList.contains('hidden')`,
      returnByValue: true,
    });
    if (check.result.value) {
      compressed = true;
      break;
    }
  }
  if (!compressed) throw new Error('Video compression timed out');

  const result = await cdp.send('Runtime.evaluate', {
    expression: `({
      actualSize: document.getElementById('result-actual-size')?.textContent,
      reduction: document.getElementById('result-reduction')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('✓ Video Compression Succeeded:', result.result.value);

  cdp.close();
  chrome.kill();
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  console.log('--- VIDEO COMPRESSOR SMOKE TEST PASSED ---');
  process.exit(0);
})().catch((err) => {
  console.error('Video smoke test failed:', err);
  process.exit(1);
});
