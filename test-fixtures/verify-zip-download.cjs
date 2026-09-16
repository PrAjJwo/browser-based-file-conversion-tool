const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_zip_' + Date.now());
const FIXTURES_DIR = path.resolve(__dirname);
const BASE_URL = 'http://localhost:4321';

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
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
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
  console.log('--- TESTING ZIP DOWNLOAD & ARCHIVE INSPECTION ---');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9244',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  try {
    await sleep(1500);

    const endpoints = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9244/json', (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });

    const pageTarget = endpoints.find((e) => e.type === 'page');
    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    await cdp.send('Page.navigate', { url: `${BASE_URL}/image/social-resizer` });
    await sleep(1500);

    // Setup download hook & blob capture
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        window.__downloads = [];
        window.__lastBlobs = [];
        const origCreate = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          window.__lastBlobs.push(blob);
          return origCreate.apply(this, arguments);
        };
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

    // Upload landscape.jpg
    const doc = await cdp.send('DOM.getDocument');
    const node = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: 'input[type="file"]',
    });
    await cdp.send('DOM.setFileInputFiles', {
      nodeId: node.nodeId,
      files: [path.join(FIXTURES_DIR, 'landscape.jpg')],
    });
    await sleep(600);

    // Click Export Selected Presets
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('export-selected-btn').click()`,
    });

    // Wait for results
    await sleep(3500);

    // Check ZIP button visibility
    const zipBtnVisible = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('social-download-zip-btn');
        return !!btn && !btn.classList.contains('hidden');
      })()`,
      returnByValue: true,
    });
    console.log('ZIP Button Visible:', zipBtnVisible.result.value);

    // Click ZIP download button
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('social-download-zip-btn').click()`,
    });
    await sleep(1500);

    // Check captured download
    const zipDl = await cdp.send('Runtime.evaluate', {
      expression: `window.__downloads[window.__downloads.length - 1]`,
      returnByValue: true,
    });

    console.log('ZIP Download Info:', zipDl.result.value);

    // Fetch arraybuffer directly from captured blob reference
    const zipData = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const blob = window.__lastBlobs[window.__lastBlobs.length - 1];
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let hex = '';
          for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
          }
          return { hex, byteLength: buf.byteLength };
        } catch (e) {
          return { error: e.message };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log('Browser fetch result:', zipData.result.value ? { byteLength: zipData.result.value.byteLength, error: zipData.result.value.error } : zipData);

    const buffer = Buffer.from(zipData.result.value.hex, 'hex');
    console.log('ZIP Byte Length:', buffer.length);
    console.log('ZIP Header Hex:', buffer.slice(0, 4).toString('hex'));

    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    console.log('Is valid ZIP magic number (PK..):', isZip);

    // Open and inspect archive contents with JSZip
    const loadedZip = await JSZip.loadAsync(buffer);
    const fileNames = Object.keys(loadedZip.files);
    console.log('Files inside ZIP archive:', fileNames);

    if (isZip && fileNames.length >= 3) {
      console.log('✔ ZIP AUDIT PASSED: Archive generated, downloaded, and contents verified!');
    } else {
      throw new Error('ZIP content validation failed');
    }

    cdp.close();
    chrome.kill('SIGKILL');
  } catch (err) {
    console.error('ZIP audit failed:', err);
    chrome.kill('SIGKILL');
    process.exit(1);
  }
})();
