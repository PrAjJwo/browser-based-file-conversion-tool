const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class BrowserSession {
  constructor(port = 9245) {
    this.port = port;
    this.chromeProcess = null;
    this.cdp = null;
    this.tempDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'chrome_qa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  }

  async start() {
    this.chromeProcess = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${this.tempDir}`,
      '--disable-gpu',
      '--no-first-run',
      'about:blank',
    ]);

    // Wait for remote debugging endpoint
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const endpoints = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${this.port}/json`, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => resolve(JSON.parse(body)));
          }).on('error', reject);
        });

        const pageTarget = endpoints.find((e) => e.type === 'page');
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          this.cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
          await this.cdp.connect();
          await this.cdp.send('Page.enable');
          await this.cdp.send('DOM.enable');
          await this.cdp.send('Runtime.enable');
          return;
        }
      } catch (err) {
        // Retry
      }
    }
    throw new Error(`Failed to connect to Chrome CDP on port ${this.port}`);
  }

  async navigate(url, waitMs = 1200) {
    await this.cdp.send('Page.navigate', { url });
    await sleep(waitMs);
  }

  async setViewport(width, height) {
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 768,
    });
    await sleep(200);
  }

  async setFileInput(selector, filePaths) {
    const doc = await this.cdp.send('DOM.getDocument');
    const node = await this.cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector,
    });
    if (!node || !node.nodeId) {
      throw new Error(`File input not found for selector: ${selector}`);
    }
    await this.cdp.send('DOM.setFileInputFiles', {
      nodeId: node.nodeId,
      files: filePaths,
    });
  }

  async setupDownloadHook() {
    await this.cdp.send('Runtime.evaluate', {
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
  }

  async getLastDownloadHeader(byteCount = 16) {
    const res = await this.cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const dl = window.__downloads[window.__downloads.length - 1];
        if (!dl) return null;
        let bytes;
        try {
          const resp = await fetch(dl.href);
          const buf = await resp.arrayBuffer();
          bytes = new Uint8Array(buf).slice(0, ${byteCount});
        } catch (e) {
          const blob = window.__lastBlobs[window.__lastBlobs.length - 1];
          if (!blob) return null;
          const buf = await blob.arrayBuffer();
          bytes = new Uint8Array(buf).slice(0, ${byteCount});
        }
        return {
          filename: dl.filename,
          hex: Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '),
          ascii: String.fromCharCode(...Array.from(bytes).map(b => (b >= 32 && b <= 126 ? b : 46)))
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    return res.result.value;
  }

  async captureScreenshot(outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const res = await this.cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
  }

  async evaluate(expression) {
    const res = await this.cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result ? res.result.value : undefined;
  }

  async close() {
    if (this.cdp) {
      this.cdp.close();
    }
    if (this.chromeProcess) {
      this.chromeProcess.kill('SIGKILL');
    }
    // Clean temp user data dir asynchronously
    setTimeout(() => {
      try {
        if (fs.existsSync(this.tempDir)) {
          fs.rmSync(this.tempDir, { recursive: true, force: true });
        }
      } catch (e) {}
    }, 1500);
  }
}

module.exports = {
  BrowserSession,
  sleep,
};
