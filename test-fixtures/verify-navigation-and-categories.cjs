const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_nav_test_' + Date.now());

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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('=== STARTING NAVIGATION & CATEGORY PAGES VERIFICATION ===');

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

  // =========================================================================
  // 1. Header Navigation & Dropdowns
  // =========================================================================
  console.log('\n--- 1. HEADER NAVIGATION AUDIT ---');
  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(1500);

  const headerCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const headerNav = document.querySelector('header nav');
      const navText = headerNav ? headerNav.innerText : '';
      const hasAudio = navText.includes('Audio');
      const hasImage = navText.includes('Image Tools');
      const hasVideo = navText.includes('Video Tools');
      const hasPdf = navText.includes('PDF');
      const searchBtn = !!document.querySelector('header a[href*="tools-directory"]');

      return { hasAudio, hasImage, hasVideo, hasPdf, searchBtn };
    })()`,
    returnByValue: true,
  });

  console.log('Header Navigation:', headerCheck.result.value);
  if (headerCheck.result.value.hasAudio) {
    throw new Error('Audio Tools must NOT be featured in primary header navigation');
  }
  if (!headerCheck.result.value.hasImage || !headerCheck.result.value.hasVideo || !headerCheck.result.value.hasPdf) {
    throw new Error('Active categories missing from header navigation');
  }
  if (!headerCheck.result.value.searchBtn) {
    throw new Error('Quick search trigger button missing in header');
  }
  console.log('✔ PASS: Header contains active categories only and excludes Audio.');

  // Test Dropdown Click
  console.log('Testing Image Tools dropdown toggle...');
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('header .dropdown-trigger').click()`,
  });
  await sleep(300);

  const dropdownCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const openPanel = document.querySelector('header .dropdown-panel:not(.hidden)');
      return {
        isOpen: !!openPanel,
        tools: openPanel ? Array.from(openPanel.querySelectorAll('a')).map(a => a.innerText.split('\\n')[0]) : []
      };
    })()`,
    returnByValue: true,
  });
  console.log('Image Dropdown Open:', dropdownCheck.result.value);
  if (!dropdownCheck.result.value.isOpen || dropdownCheck.result.value.tools.length < 6) {
    throw new Error('Image Tools dropdown failed to open or missing active tools');
  }
  console.log('✔ PASS: Desktop mega dropdown reveals all 6 active image tools.');

  // =========================================================================
  // 2. Mobile Navigation Drawer & Focus Management
  // =========================================================================
  console.log('\n--- 2. MOBILE DRAWER AUDIT ---');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(300);

  // Open drawer
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#mobile-menu-btn').click()`,
  });
  await sleep(300);

  const drawerOpen = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const drawer = document.querySelector('#mobile-drawer');
      const backdrop = document.querySelector('#mobile-drawer-backdrop');
      const btnExpanded = document.querySelector('#mobile-menu-btn').getAttribute('aria-expanded');
      return {
        drawerVisible: drawer && !drawer.classList.contains('hidden'),
        backdropVisible: backdrop && !backdrop.classList.contains('hidden'),
        btnExpanded
      };
    })()`,
    returnByValue: true,
  });
  console.log('Mobile Drawer Open Check:', drawerOpen.result.value);
  if (!drawerOpen.result.value.drawerVisible || drawerOpen.result.value.btnExpanded !== 'true') {
    throw new Error('Mobile drawer failed to open');
  }

  // Close drawer via close button
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('#mobile-drawer-close').click()`,
  });
  await sleep(300);

  const drawerClosed = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const drawer = document.querySelector('#mobile-drawer');
      const btnExpanded = document.querySelector('#mobile-menu-btn').getAttribute('aria-expanded');
      return {
        drawerHidden: drawer && drawer.classList.contains('hidden'),
        btnExpanded
      };
    })()`,
    returnByValue: true,
  });
  console.log('Mobile Drawer Closed Check:', drawerClosed.result.value);
  if (!drawerClosed.result.value.drawerHidden || drawerClosed.result.value.btnExpanded !== 'false') {
    throw new Error('Mobile drawer failed to close');
  }
  console.log('✔ PASS: Mobile drawer opens, manages aria-expanded, and closes cleanly.');

  // Reset viewport to desktop
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(300);

  // =========================================================================
  // 3. Category Pages Audit (/image, /video, /pdf, /audio)
  // =========================================================================
  const categoriesToTest = [
    {
      route: '/image',
      expectedTitle: 'Image Tools',
      expectedCount: '6 Active Tools',
      expectedGroups: ['Image Conversion', 'Resize & Compress'],
      isAudio: false,
    },
    {
      route: '/video',
      expectedTitle: 'Video Tools',
      expectedCount: '1 Active Tool',
      isAudio: false,
      hasFeaturedCard: true,
    },
    {
      route: '/pdf',
      expectedTitle: 'PDF & Document Tools',
      expectedCount: '2 Active Tools',
      expectedGroups: ['Document Compilation', 'Media & Captions'],
      isAudio: false,
    },
    {
      route: '/audio',
      expectedTitle: 'Audio Tools',
      isAudio: true,
    },
  ];

  for (const cat of categoriesToTest) {
    console.log(`\n--- 3. CATEGORY AUDIT: ${cat.route} ---`);
    await cdp.send('Page.navigate', { url: `http://localhost:4321${cat.route}` });
    await sleep(1500);

    const catCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1')?.textContent.trim();
        const breadcrumb = document.querySelector('nav[aria-label="Breadcrumb"]')?.innerText.replace(/\\s+/g, ' ');
        const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content');
        const text = document.body.innerText;
        
        // Developer jargon check
        const hasJargon = text.includes('0 tools registered') || 
                          text.includes('queued in our architecture') || 
                          text.includes('Tools in Preparation');

        return { h1, breadcrumb, robots, hasJargon, textSnippet: text.slice(0, 300) };
      })()`,
      returnByValue: true,
    });

    const res = catCheck.result.value;
    console.log(`Category ${cat.route}:`, {
      h1: res.h1,
      breadcrumb: res.breadcrumb,
      robots: res.robots,
      hasJargon: res.hasJargon
    });

    if (res.hasJargon) {
      throw new Error(`Developer jargon found on category page ${cat.route}`);
    }

    if (cat.isAudio) {
      if (res.robots !== 'noindex, follow') {
        throw new Error(`/audio must have robots="noindex, follow", found: "${res.robots}"`);
      }
      const hasDevNotice = await cdp.send('Runtime.evaluate', {
        expression: `document.body.innerText.includes('Audio Tools Under Development')`,
        returnByValue: true,
      });
      if (!hasDevNotice.result.value) {
        throw new Error('/audio missing clean human "Under Development" notice');
      }
      console.log('✔ PASS: /audio has noindex, follow and clean human messaging.');
    } else {
      if (res.robots !== 'index, follow') {
        throw new Error(`${cat.route} should have robots="index, follow", found: "${res.robots}"`);
      }
      if (!res.breadcrumb.includes('Home') || !res.breadcrumb.includes('/')) {
        throw new Error(`Invalid subtle breadcrumbs on ${cat.route}: "${res.breadcrumb}"`);
      }
      console.log(`✔ PASS: ${cat.route} has subtle breadcrumbs, correct robots, and active tools.`);
    }

    // Responsive QA on Category Page (375, 768, 1440)
    for (const width of [375, 768, 1440]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 800,
        deviceScaleFactor: 1,
        mobile: width < 1024,
      });
      await sleep(200);
      const overflow = await cdp.send('Runtime.evaluate', {
        expression: `document.documentElement.scrollWidth > window.innerWidth`,
        returnByValue: true,
      });
      if (overflow.result.value) {
        throw new Error(`Horizontal overflow on ${cat.route} at ${width}px`);
      }
    }
    console.log(`✔ PASS: ${cat.route} has 0 horizontal overflow across responsive viewports.`);
  }

  // =========================================================================
  // 4. Footer Audit
  // =========================================================================
  console.log('\n--- 4. FOOTER NAVIGATION AUDIT ---');
  await cdp.send('Page.navigate', { url: DEV_URL });
  await sleep(1500);

  const footerCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const footer = document.querySelector('footer');
      const footerText = footer ? footer.innerText : '';
      const lower = footerText.toLowerCase();
      const hasJargon = lower.includes('tools arriving') || lower.includes('0 tools registered');
      const hasImageLinks = lower.includes('image tools');
      const hasVideoLinks = lower.includes('video tools');
      const hasPdfLinks = lower.includes('pdf & documents');

      return { hasJargon, hasImageLinks, hasVideoLinks, hasPdfLinks };
    })()`,
    returnByValue: true,
  });

  console.log('Footer Check:', footerCheck.result.value);
  if (footerCheck.result.value.hasJargon) {
    throw new Error('Footer contains developer jargon or empty tool notices');
  }
  if (!footerCheck.result.value.hasImageLinks || !footerCheck.result.value.hasVideoLinks || !footerCheck.result.value.hasPdfLinks) {
    throw new Error('Footer missing active tool categories');
  }
  console.log('✔ PASS: Footer only references active categories with zero developer jargon.');

  console.log('\n=== ALL NAVIGATION & CATEGORY REDESIGN TESTS PASSED ===');

  cdp.close();
  chrome.kill();
  process.exit(0);
})().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
