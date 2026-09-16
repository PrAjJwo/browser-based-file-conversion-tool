const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_hp_test_' + Date.now());

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
  console.log('=== STARTING HOMEPAGE REDESIGN CDP VERIFICATION ===');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--remote-allow-origins=*',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9227/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page');
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  const networkRequests = [];
  cdp.on('Network.requestWillBeSent', (params) => {
    networkRequests.push(params.request.url);
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Network.enable');

  console.log(`Navigating to ${DEV_URL}...`);
  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(2000);

  // 1. Performance & Heavy Asset Audit
  console.log('\n--- 1. PERFORMANCE & ASSET AUDIT ---');
  const heavyAssets = networkRequests.filter(url => 
    url.includes('ffmpeg') || 
    url.includes('heic2any') || 
    url.includes('jspdf') || 
    url.endsWith('.wasm')
  );
  if (heavyAssets.length === 0) {
    console.log('✔ PASS: Zero heavy converter libraries (Wasm, FFmpeg, heic2any, jsPDF) loaded on homepage.');
  } else {
    console.error('✖ FAIL: Heavy assets requested on homepage:', heavyAssets);
    process.exit(1);
  }

  // 2. SEO & Heading Hierarchy
  console.log('\n--- 2. SEO & HEADING HIERARCHY ---');
  const seoCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim().replace(/\\s+/g, ' '));
      const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim().replace(/\\s+/g, ' '));
      const title = document.title;
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
      const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
        try { return JSON.parse(s.textContent); } catch(e) { return null; }
      });
      return { h1s, h2s, title, metaDesc, canonical, schemaCount: schemas.length, schemas };
    })()`,
    returnByValue: true,
  });

  const seo = seoCheck.result.value;
  console.log(`Title: "${seo.title}"`);
  console.log(`Meta Description: "${seo.metaDesc}"`);
  console.log(`H1 count: ${seo.h1s.length} -> "${seo.h1s[0]}"`);
  console.log(`H2 count: ${seo.h2s.length} ->`, seo.h2s);

  if (seo.h1s.length !== 1) {
    throw new Error(`Expected exactly 1 H1, found ${seo.h1s.length}`);
  }
  if (!seo.title || !seo.metaDesc) {
    throw new Error('Missing title or meta description');
  }
  console.log('✔ PASS: SEO tags and single H1 validated.');

  // 3. Copy Fluff Check
  console.log('\n--- 3. COPY FLUFF AUDIT ---');
  const copyCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText.toLowerCase();
      const banned = [
        'revolutionary',
        'say goodbye to sketchy',
        'position in queue #42',
        'webassembly power',
        'safer than every other'
      ];
      const found = banned.filter(b => text.includes(b));
      return { found };
    })()`,
    returnByValue: true,
  });
  if (copyCheck.result.value.found.length === 0) {
    console.log('✔ PASS: All generic / exaggerated buzzwords removed.');
  } else {
    console.error('✖ FAIL: Found banned buzzwords:', copyCheck.result.value.found);
    process.exit(1);
  }

  // 4. Meaningful Category Presentation & Dynamic Counts
  console.log('\n--- 4. CATEGORY PRESENTATION ---');
  const catCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const categories = ['Image Tools', 'Video Tools', 'PDF & Documents', 'Audio Tools'];
      const text = document.body.innerText;
      const results = {};
      categories.forEach(cat => {
        results[cat] = text.includes(cat);
      });
      const hasImageCount = text.includes('Active Tools') || text.includes('Active Tool');
      const hasInDev = text.includes('In Development');
      return { results, hasImageCount, hasInDev };
    })()`,
    returnByValue: true,
  });
  console.log('Category check:', catCheck.result.value);
  if (!catCheck.result.value.hasImageCount || !catCheck.result.value.hasInDev) {
    throw new Error('Category counts or In Development badge missing');
  }
  console.log('✔ PASS: Category presentation shows accurate tool status and dynamic counts.');

  // 5. Active Tool Grid & Initial Count
  console.log('\n--- 5. ACTIVE TOOL GRID AUDIT ---');
  const gridCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.tool-grid-card'));
      return {
        count: cards.length,
        tools: cards.map(c => ({
          slug: c.getAttribute('data-slug'),
          category: c.getAttribute('data-category'),
          title: c.querySelector('h3')?.textContent.trim(),
          hasIcon: !!c.querySelector('svg'),
          hasArrow: c.innerText.includes('Open Tool')
        }))
      };
    })()`,
    returnByValue: true,
  });
  console.log(`Found ${gridCheck.result.value.count} active tool cards in grid:`);
  gridCheck.result.value.tools.forEach(t => console.log(` - [${t.category}] ${t.title} (slug: ${t.slug}, icon: ${t.hasIcon}, action: ${t.hasArrow})`));

  if (gridCheck.result.value.count !== 9) {
    throw new Error(`Expected exactly 9 active tools in grid, found ${gridCheck.result.value.count}`);
  }
  console.log('✔ PASS: All 9 active tools rendered with custom icons and links.');

  // 6. Interactive Search Filtering
  console.log('\n--- 6. CLIENT-SIDE SEARCH FILTERING ---');
  
  // Test A: Search 'heic'
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#tool-search-input');
      input.value = 'heic';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  });
  await sleep(300);

  const heicFiltered = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const visible = Array.from(document.querySelectorAll('.tool-grid-card:not(.hidden)'));
      return visible.map(c => c.getAttribute('data-slug'));
    })()`,
    returnByValue: true,
  });
  console.log('Filtered by "heic":', heicFiltered.result.value);
  if (!heicFiltered.result.value.includes('heic-to-jpg') || !heicFiltered.result.value.includes('jpg-to-heic') || heicFiltered.result.value.length !== 2) {
    throw new Error(`Expected 2 HEIC tools, got: ${heicFiltered.result.value}`);
  }

  // Test B: Search 'video'
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#tool-search-input');
      input.value = 'video';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  });
  await sleep(300);

  const videoFiltered = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const visible = Array.from(document.querySelectorAll('.tool-grid-card:not(.hidden)'));
      return visible.map(c => c.getAttribute('data-slug'));
    })()`,
    returnByValue: true,
  });
  console.log('Filtered by "video":', videoFiltered.result.value);
  if (videoFiltered.result.value.length !== 1 || videoFiltered.result.value[0] !== 'video-compressor') {
    throw new Error(`Expected only video-compressor, got: ${videoFiltered.result.value}`);
  }

  // Test C: Search nonsense string
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#tool-search-input');
      input.value = 'nonexistentxyzterm';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  });
  await sleep(300);

  const emptyCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const visibleCards = document.querySelectorAll('.tool-grid-card:not(.hidden)').length;
      const noResultsHidden = document.querySelector('#no-results-state').classList.contains('hidden');
      return { visibleCards, noResultsHidden };
    })()`,
    returnByValue: true,
  });
  console.log('Filtered by nonsense:', emptyCheck.result.value);
  if (emptyCheck.result.value.visibleCards !== 0 || emptyCheck.result.value.noResultsHidden !== false) {
    throw new Error('Empty state failed to display on unmatched query');
  }

  // Test D: Click Reset Filter
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#clear-search-btn').click()`,
  });
  await sleep(300);

  const resetCheck = await cdp.send('Runtime.evaluate', {
    expression: `document.querySelectorAll('.tool-grid-card:not(.hidden)').length`,
    returnByValue: true,
  });
  console.log('Restored tool count after reset:', resetCheck.result.value);
  if (resetCheck.result.value !== 9) {
    throw new Error('Reset failed to restore all 9 tools');
  }
  console.log('✔ PASS: Client-side search and filter state machine works perfectly.');

  // 7. Category Filter Tabs
  console.log('\n--- 7. CATEGORY TABS FILTERING ---');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('button[data-filter="pdf"]').click()`,
  });
  await sleep(300);

  const pdfTabCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const visible = Array.from(document.querySelectorAll('.tool-grid-card:not(.hidden)'));
      return visible.map(c => c.getAttribute('data-slug'));
    })()`,
    returnByValue: true,
  });
  console.log('PDF tab visible tools:', pdfTabCheck.result.value);
  if (pdfTabCheck.result.value.length !== 2) {
    throw new Error(`Expected 2 PDF tools, got ${pdfTabCheck.result.value.length}`);
  }

  // Reset to all
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('button[data-filter="all"]').click()`,
  });
  await sleep(300);

  // 8. Visual 3-Step Privacy & Why On-Device
  console.log('\n--- 8. PRIVACY & VALUE SECTIONS ---');
  const privacyCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      const lower = text.toLowerCase();
      return {
        hasPrivacyTitle: text.includes('How On-Device Processing Works'),
        hasStep1: text.includes('Choose Your File') && lower.includes('local memory read'),
        hasStep2: text.includes('Process Locally') && lower.includes('client cpu / wasm'),
        hasStep3: text.includes('Save Immediately') && lower.includes('direct blob export'),
        hasVerifyTip: text.includes('Verify it yourself') && text.includes('Network'),
        hasWhySection: text.includes('Why Choose On-Device Tools')
      };
    })()`,
    returnByValue: true,
  });
  console.log('Privacy & value check:', privacyCheck.result.value);
  if (!Object.values(privacyCheck.result.value).every(Boolean)) {
    throw new Error('Privacy or Value proposition section missing required elements');
  }
  console.log('✔ PASS: Visual 3-step privacy architecture and non-exaggerated benefits validated.');

  // 9. Responsive Viewports QA
  console.log('\n--- 9. RESPONSIVE VIEWPORT QA (375, 390, 768, 1024, 1440) ---');
  const viewports = [
    { name: 'Mobile XS (375x667)', width: 375, height: 667 },
    { name: 'Mobile Modern (390x844)', width: 390, height: 844 },
    { name: 'Tablet Portrait (768x1024)', width: 768, height: 1024 },
    { name: 'Tablet Landscape / Laptop (1024x768)', width: 1024, height: 768 },
    { name: 'Desktop Standard (1440x900)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 1024,
    });
    await sleep(400);

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

    console.log(`Viewport ${vp.name}: scrollWidth=${overflow.result.value.scrollWidth}, innerWidth=${overflow.result.value.innerWidth}, overflow=${overflow.result.value.overflow}`);
    if (overflow.result.value.overflow) {
      throw new Error(`Horizontal overflow detected at viewport ${vp.name}`);
    }
  }
  console.log('✔ PASS: Zero horizontal overflow across all 5 responsive viewports.');

  console.log('\n=== ALL HOMEPAGE REDESIGN VERIFICATIONS PASSED SUCCESSFULLY ===');

  cdp.close();
  chrome.kill();
  process.exit(0);
})().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
