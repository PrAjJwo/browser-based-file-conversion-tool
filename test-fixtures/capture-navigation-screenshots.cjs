const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_nav_ss_' + Date.now());
const ARTIFACTS_DIR = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\6e5d0d05-2e09-4264-819f-1c973b6be2c7';

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
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    'about:blank'
  ]);

  try {
    await sleep(1500);

    const endpoints = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9229/json', (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });

    const pageTarget = endpoints.find(e => e.type === 'page');
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('DOM.enable');

    // 1. Desktop Header Dropdown (1440x900)
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.navigate', { url: 'http://localhost:4321/' });
    await sleep(1000);
    // Click Image Tools trigger (first .dropdown-trigger)
    await client.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.dropdown-trigger')[0].click()`
    });
    await sleep(400);
    const ss1 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'header_dropdown_desktop.png'), Buffer.from(ss1.data, 'base64'));
    console.log('Saved header_dropdown_desktop.png');

    // 2. Mobile Nav Drawer (390x844)
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await client.send('Page.navigate', { url: 'http://localhost:4321/' });
    await sleep(1000);
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('mobile-menu-btn').click()`
    });
    await sleep(400);
    const ss2 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile_nav_drawer.png'), Buffer.from(ss2.data, 'base64'));
    console.log('Saved mobile_nav_drawer.png');

    // 3. Category /image Desktop (1280x900)
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.navigate', { url: 'http://localhost:4321/image' });
    await sleep(1000);
    const ss3 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'category_image_desktop.png'), Buffer.from(ss3.data, 'base64'));
    console.log('Saved category_image_desktop.png');

    // 4. Category /video Desktop (1280x900)
    await client.send('Page.navigate', { url: 'http://localhost:4321/video' });
    await sleep(1000);
    const ss4 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'category_video_desktop.png'), Buffer.from(ss4.data, 'base64'));
    console.log('Saved category_video_desktop.png');

    // 5. Category /pdf Desktop (1280x900)
    await client.send('Page.navigate', { url: 'http://localhost:4321/pdf' });
    await sleep(1000);
    const ss5 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'category_pdf_desktop.png'), Buffer.from(ss5.data, 'base64'));
    console.log('Saved category_pdf_desktop.png');

    // 6. Category /audio Desktop (1280x900)
    await client.send('Page.navigate', { url: 'http://localhost:4321/audio' });
    await sleep(1000);
    const ss6 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'category_audio_humanized.png'), Buffer.from(ss6.data, 'base64'));
    console.log('Saved category_audio_humanized.png');

    client.close();
    console.log('All screenshots captured successfully!');
  } finally {
    chrome.kill('SIGKILL');
  }
})();
