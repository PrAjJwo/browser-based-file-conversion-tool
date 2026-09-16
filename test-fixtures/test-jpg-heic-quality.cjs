const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:4321/image/jpg-to-heic';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_jpg_qual_' + Date.now());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error('Eval failed: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

(async () => {
  console.log('--- TESTING QUALITY CONTROLS ON LANDSCAPE.JPG (1200x800) ---');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9242',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  try {
    const targets = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9242/json/list', (res) => {
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

    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2500);

    const doc = await cdp.send('DOM.getDocument');
    const fileInput = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#jpg-tool-root input[type=file]',
    });

    const qualityLevels = [50, 75, 85, 100];
    const results = [];

    for (const q of qualityLevels) {
      console.log(`Testing Quality: ${q}%...`);
      // Set slider
      await cdp.eval(`(() => {
        const slider = document.querySelector('#jpg-quality-slider');
        slider.value = "${q}";
        slider.dispatchEvent(new Event('input'));
      })()`);

      // Add file
      await cdp.send('DOM.setFileInputFiles', {
        files: [path.resolve('test-fixtures/landscape.jpg')],
        nodeId: fileInput.nodeId,
      });
      await sleep(600);

      // Click convert
      await cdp.eval(`document.querySelector('#start-convert-btn').click()`);

      let done = false;
      for (let i = 0; i < 30; i++) {
        await sleep(500);
        const disabled = await cdp.eval(`document.querySelector('#start-convert-btn')?.disabled`);
        if (!disabled) {
          done = true;
          break;
        }
      }
      if (!done) throw new Error(`Timed out at quality ${q}%`);

      const cardDetails = await cdp.eval(`(() => {
        const card = document.querySelector('#results-list .result-card');
        const text = card?.querySelector('.text-surface-500')?.innerText || '';
        return text;
      })()`);

      results.push({ quality: `${q}%`, details: cardDetails.replace(/\\n/g, ' ') });

      // Clear for next run
      await cdp.eval(`document.querySelector('#clear-all-btn').click()`);
      await sleep(400);
    }

    console.log('\n=== QUALITY COMPARISON RESULTS ===');
    console.table(results);

    cdp.close();
    chrome.kill();
  } catch (err) {
    chrome.kill();
    throw err;
  }
})();
