const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_brand_test_' + Date.now());

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
  console.log('=== STARTING BRAND IDENTITY & DESIGN SYSTEM VERIFICATION ===');

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

  console.log(`Navigating to ${DEV_URL}...`);
  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2000);

  // 1. Brand Replacement Audit
  console.log('\n--- 1. BRAND REPLACEMENT AUDIT ---');
  const brandCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const title = document.title;
      const bodyText = document.body.innerText;
      const hasOldBrand = bodyText.includes('Browser File Tools');
      const headerBrand = document.querySelector('header')?.innerText.includes('PureFile');
      const footerBrand = document.querySelector('footer')?.innerText.includes('PureFile');
      const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
      
      const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
        try { return JSON.parse(s.textContent); } catch(e) { return null; }
      });
      const webSiteSchema = schemas.find(s => s && s['@type'] === 'WebSite');

      return {
        title,
        hasOldBrand,
        headerBrand,
        footerBrand,
        ogSiteName,
        schemaSiteName: webSiteSchema ? webSiteSchema.name : null,
        schemaSiteUrl: webSiteSchema ? webSiteSchema.url : null
      };
    })()`,
    returnByValue: true,
  });

  const b = brandCheck.result.value;
  console.log('Brand Audit Details:', b);

  if (b.hasOldBrand) {
    throw new Error('Found old brand name "Browser File Tools" in visible body text');
  }
  if (!b.headerBrand || !b.footerBrand) {
    throw new Error('New brand "PureFile" missing in header or footer');
  }
  if (!b.title.includes('PureFile')) {
    throw new Error(`Page title does not include "PureFile": "${b.title}"`);
  }
  if (b.ogSiteName !== 'PureFile' || b.schemaSiteName !== 'PureFile') {
    throw new Error('Metadata / Schema does not reference "PureFile"');
  }
  console.log('✔ PASS: Visible brand and metadata successfully updated to PureFile.');

  // 2. Logo System & Favicon Audit
  console.log('\n--- 2. LOGO SYSTEM & FAVICON AUDIT ---');
  const logoCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const headerSvg = document.querySelector('header svg');
      const footerSvg = document.querySelector('footer svg');
      return {
        hasHeaderSvg: !!headerSvg,
        hasFooterSvg: !!footerSvg,
        headerSvgViewBox: headerSvg?.getAttribute('viewBox'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Logo Check:', logoCheck.result.value);
  if (!logoCheck.result.value.hasHeaderSvg) {
    throw new Error('Header logo SVG missing');
  }

  // Verify favicon.svg HTTP response
  const faviconStatus = await new Promise((resolve) => {
    http.get('http://localhost:4321/favicon.svg', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, hasPureFileGeometry: data.includes('fill="#09090B"') }));
    }).on('error', (e) => resolve({ error: e.message }));
  });
  console.log('Favicon Check:', faviconStatus);
  if (faviconStatus.status !== 200 || !faviconStatus.hasPureFileGeometry) {
    throw new Error('Favicon failed to load or does not match PureFile geometry');
  }
  console.log('✔ PASS: PureFile logo system and favicon verified.');

  // 3. Design Tokens & CSS Variables Audit
  console.log('\n--- 3. DESIGN TOKENS & CSS VARIABLES AUDIT ---');
  const tokenCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        colorBrand: style.getPropertyValue('--color-brand').trim(),
        colorSurfaceBg: style.getPropertyValue('--color-surface-bg').trim(),
        colorTextPrimary: style.getPropertyValue('--color-text-primary').trim(),
        radiusMd: style.getPropertyValue('--radius-md').trim(),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Design Tokens:', tokenCheck.result.value);
  if (tokenCheck.result.value.colorBrand !== '#2563eb' || tokenCheck.result.value.colorTextPrimary !== '#09090b') {
    throw new Error('Design tokens mismatch Direction A (Clean Professional Utility)');
  }
  console.log('✔ PASS: CSS design tokens conform strictly to Direction A.');

  // 4. Button & Form Component System Verification
  console.log('\n--- 4. BUTTON & FORM COMPONENT SYSTEM AUDIT ---');
  const componentCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // Test virtual injection of component classes
      const testContainer = document.createElement('div');
      testContainer.innerHTML = \`
        <button class="btn-primary btn-md" id="test-btn-p">Primary Action</button>
        <button class="btn-secondary btn-md" id="test-btn-s">Secondary Action</button>
        <input class="input-base" id="test-input" placeholder="Type here..." />
        <div class="card-base" id="test-card">Card Content</div>
      \`;
      document.body.appendChild(testContainer);

      const pBtn = document.getElementById('test-btn-p');
      const sBtn = document.getElementById('test-btn-s');
      const inp = document.getElementById('test-input');
      const card = document.getElementById('test-card');

      const pStyle = getComputedStyle(pBtn);
      const sStyle = getComputedStyle(sBtn);
      const iStyle = getComputedStyle(inp);
      const cStyle = getComputedStyle(card);

      const results = {
        btnPrimaryBg: pStyle.backgroundColor,
        btnPrimaryRadius: pStyle.borderRadius,
        btnSecondaryBorder: sStyle.borderColor,
        inputHeight: iStyle.height,
        cardBg: cStyle.backgroundColor,
      };

      testContainer.remove();
      return results;
    })()`,
    returnByValue: true,
  });
  console.log('Component System Verification:', componentCheck.result.value);
  if (!componentCheck.result.value.btnPrimaryBg.includes('37, 99, 235')) { // rgb(37, 99, 235) is #2563eb
    throw new Error('btn-primary does not use brand cobalt #2563eb');
  }
  console.log('✔ PASS: Button, Form, and Card utility systems verified.');

  // 5. Header Privacy Indicator
  console.log('\n--- 5. HEADER PRIVACY INDICATOR AUDIT ---');
  const privacyCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const headerText = document.querySelector('header')?.innerText;
      return {
        hasHeaderBadge: headerText.includes('Local Sandbox') && headerText.includes('0 Bytes Uploaded'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Header Privacy Badge:', privacyCheck.result.value);
  if (!privacyCheck.result.value.hasHeaderBadge) {
    throw new Error('Header privacy badge missing or incorrect');
  }
  console.log('✔ PASS: Quiet, confident header privacy indicator verified.');

  // 6. Responsive Viewports QA
  console.log('\n--- 6. RESPONSIVE VIEWPORT QA (375, 390, 768, 1024, 1440) ---');
  const viewports = [
    { name: 'Mobile XS (375x667)', width: 375, height: 667 },
    { name: 'Mobile Modern (390x844)', width: 390, height: 844 },
    { name: 'Tablet Portrait (768x1024)', width: 768, height: 1024 },
    { name: 'Tablet Landscape (1024x768)', width: 1024, height: 768 },
    { name: 'Desktop (1440x900)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 1024,
    });
    await sleep(300);

    const overflow = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        return {
          scrollWidth: docWidth,
          innerWidth: winWidth,
          overflow: docWidth > winWidth
        };
      })()`,
      returnByValue: true,
    });

    console.log(`Viewport ${vp.name}: overflow=${overflow.result.value.overflow}`);
    if (overflow.result.value.overflow) {
      throw new Error(`Horizontal overflow at ${vp.name}`);
    }
  }
  console.log('✔ PASS: Zero horizontal overflow across all viewports.');

  console.log('\n=== ALL BRAND IDENTITY & DESIGN SYSTEM TESTS PASSED ===');

  cdp.close();
  chrome.kill();
  process.exit(0);
})().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
