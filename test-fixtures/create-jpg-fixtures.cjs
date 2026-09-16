const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_create_jpg_' + Date.now());

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
  console.log('Generating genuine JPG test fixtures via Chrome canvas...');

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

  try {
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

    async function makeJpeg(width, height, drawFn, quality = 0.9) {
      return await cdp.eval(`(() => {
        const canvas = document.createElement('canvas');
        canvas.width = ${width};
        canvas.height = ${height};
        const ctx = canvas.getContext('2d');
        (${drawFn})(ctx, ${width}, ${height});
        return canvas.toDataURL('image/jpeg', ${quality}).split(',')[1];
      })()`);
    }

    // 1. Landscape JPG (1200 x 800)
    console.log('Creating landscape.jpg (1200x800)...');
    const landscapeB64 = await makeJpeg(1200, 800, `(ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1e3a8a');
      grad.addColorStop(0.5, '#0284c7');
      grad.addColorStop(1, '#10b981');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(w/2, h/2, 200, 0, Math.PI * 2);
      ctx.fill();
    }`);
    fs.writeFileSync('test-fixtures/landscape.jpg', Buffer.from(landscapeB64, 'base64'));

    // 2. Portrait JPG (600 x 900)
    console.log('Creating portrait.jpg (600x900)...');
    const portraitB64 = await makeJpeg(600, 900, `(ctx, w, h) => {
      const grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, 400);
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(0.7, '#8b5cf6');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }`);
    fs.writeFileSync('test-fixtures/portrait.jpg', Buffer.from(portraitB64, 'base64'));

    // 3. Reasonably large JPG (1920 x 1080)
    console.log('Creating large_photo.jpg (1920x1080)...');
    const largeB64 = await makeJpeg(1920, 1080, `(ctx, w, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = 'hsl(' + (i * 7) + ', 80%, 60%)';
        ctx.fillRect((i * 38) % w, (i * 27) % h, 200, 200);
      }
    }`);
    fs.writeFileSync('test-fixtures/large_photo.jpg', Buffer.from(largeB64, 'base64'));

    // 4. Filename containing spaces
    console.log('Creating "my summer holiday.jpg"...');
    fs.copyFileSync('test-fixtures/landscape.jpg', 'test-fixtures/my summer holiday.jpg');

    // 5. Uppercase .JPG
    console.log('Creating TEST_IMAGE.JPG...');
    fs.copyFileSync('test-fixtures/portrait.jpg', 'test-fixtures/TEST_IMAGE.JPG');

    // 6. Unicode filename
    console.log('Creating 東京_旅行_2026.jpg...');
    fs.copyFileSync('test-fixtures/landscape.jpg', 'test-fixtures/東京_旅行_2026.jpg');

    // 7. Corrupted file
    console.log('Creating corrupted.jpg...');
    fs.writeFileSync('test-fixtures/corrupted.jpg', Buffer.from('NOT_A_JPEG_FILE_INVALID_DATA_HEADER_BYTES'));

    cdp.close();
    chrome.kill();
    console.log('All genuine JPG fixtures created successfully!');
  } catch (err) {
    chrome.kill();
    throw err;
  }
})();
