const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:4321/video/video-compressor';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_video_seo_' + Date.now());

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  console.log('=== VERIFYING VIDEO COMPRESSOR CONTENT & SEO ===');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9231',
    '--remote-allow-origins=*',
    '--disable-extensions',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);
  await sleep(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9231/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const curId = id++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: DEV_URL });
  await sleep(2000);

  const seoEval = await send('Runtime.evaluate', {
    expression: `(() => {
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim());
      const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim());
      const faqs = Array.from(document.querySelectorAll('#faq-heading + div details, section[aria-labelledby="faq-heading"] details')).map(d => ({
        q: d.querySelector('summary')?.textContent?.trim(),
        a: d.querySelector('p')?.textContent?.trim()
      }));

      // Extract JSON-LD scripts
      const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => JSON.parse(s.textContent));

      const title = document.title;
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');

      return {
        title,
        metaDesc,
        metaDescLength: metaDesc ? metaDesc.length : 0,
        canonical,
        ogTitle,
        ogDesc,
        h1Count: h1s.length,
        h1: h1s[0],
        h2s,
        faqCount: faqs.length,
        faqs,
        jsonLdTypes: jsonLdScripts.map(s => s['@type'] || (Array.isArray(s) ? s.map(x => x['@type']) : 'unknown'))
      };
    })()`,
    returnByValue: true
  });

  const res = seoEval.result.value;
  console.log('Page Title:', res.title);
  console.log('Meta Description:', res.metaDesc, `(${res.metaDescLength} chars)`);
  console.log('Canonical:', res.canonical);
  console.log('H1 Count:', res.h1Count, '->', res.h1);
  console.log('H2 Headings:', res.h2s);
  console.log('Visible FAQ Count:', res.faqCount);
  console.log('JSON-LD Schemas:', res.jsonLdTypes);

  if (res.h1Count !== 1) throw new Error(`Expected exactly 1 H1, found ${res.h1Count}`);
  if (res.faqCount < 5) throw new Error(`Expected at least 5 FAQs, found ${res.faqCount}`);
  if (!res.metaDesc || res.metaDescLength < 120 || res.metaDescLength > 170) {
    throw new Error(`Meta description length out of range (120-170): ${res.metaDescLength}`);
  }

  ws.close();
  chrome.kill();
  try { fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true }); } catch {}
  console.log('\n✓ CONTENT & ON-PAGE SEO VERIFIED SUCCESSFULLY!');
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ SEO VERIFICATION FAILED:', err);
  process.exit(1);
});
