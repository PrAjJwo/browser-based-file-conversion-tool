const http = require('http');
const { getActiveTools, getCategoryRoutes } = require('./helpers/routes.cjs');
const { QAReporter } = require('./helpers/reporter.cjs');
const { BrowserSession, sleep } = require('./helpers/cdp.cjs');
const { FIXTURES } = require('../test-fixtures/index.cjs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';

async function checkRouteHttp(urlPath) {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}${urlPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          html: data,
          ok: res.statusCode === 200,
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        html: '',
        ok: false,
        error: err,
      });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ statusCode: 408, html: '', ok: false, error: new Error('Timeout') });
    });
  });
}

(async () => {
  console.log('\n==================================================');
  console.log('  PUREFILE SMOKE QA SUITE (Quick Verification)');
  console.log('==================================================\n');

  const reporter = new QAReporter('PureFile Quick Smoke');
  const activeTools = getActiveTools();
  const categoryRoutes = getCategoryRoutes();

  // 1. Homepage Route Check
  console.log('[1/4] Checking Core Platform Pages...');
  const homeRes = await checkRouteHttp('/');
  if (homeRes.ok && homeRes.html.includes('PureFile') && homeRes.html.includes('Browse by Category')) {
    reporter.addResult('Homepage (/)', 'PASS', { info: '200 OK, Title & Directory Present' });
  } else {
    reporter.addResult('Homepage (/)', 'FAIL', {
      tool: 'Platform Homepage',
      test: 'Homepage Accessibility',
      expected: 'HTTP 200 with PureFile brand and tool directory',
      actual: `Status: ${homeRes.statusCode}, Content length: ${homeRes.html.length}`,
      suggestedFile: 'src/pages/index.astro',
    });
  }

  // 2. Category Hub Routes
  console.log('\n[2/4] Checking Category Hub Routes...');
  for (const catRoute of categoryRoutes) {
    const res = await checkRouteHttp(catRoute);
    const catName = catRoute.replace('/', '').toUpperCase();
    if (res.ok && res.html.includes('PureFile')) {
      reporter.addResult(`Category: ${catName} (${catRoute})`, 'PASS', { info: '200 OK' });
    } else {
      reporter.addResult(`Category: ${catName} (${catRoute})`, 'FAIL', {
        tool: `Category ${catName}`,
        test: 'Category Route Load',
        expected: 'HTTP 200 OK',
        actual: `Status: ${res.statusCode}`,
        suggestedFile: 'src/pages/[category]/index.astro',
      });
    }
  }

  // 3. Active Tool Routes
  console.log('\n[3/4] Checking Active Tool Routes...');
  for (const tool of activeTools) {
    const res = await checkRouteHttp(tool.route);
    const hasTitle = res.html.includes(tool.title);
    const hasDropzone = res.html.includes('dropzone') || res.html.includes('file-input');

    if (res.ok && hasTitle && hasDropzone) {
      reporter.addResult(`Tool Route: ${tool.title}`, 'PASS', { info: `${tool.route} (200 OK)` });
    } else {
      reporter.addResult(`Tool Route: ${tool.title}`, 'FAIL', {
        tool: tool.title,
        test: 'Tool Route & UI Shell',
        expected: `HTTP 200 with tool title "${tool.title}" and active dropzone`,
        actual: `Status: ${res.statusCode}, Title found: ${hasTitle}, Dropzone found: ${hasDropzone}`,
        suggestedFile: `src/components/tools/${tool.title.replace(/\s+/g, '')}Tool.astro`,
      });
    }
  }

  // 4. Live Browser Workflow Sanity Check (Subtitle Converter)
  console.log('\n[4/4] Running In-Browser Converter Sanity Test...');
  const browser = new BrowserSession(9247);
  try {
    await browser.start();
    await browser.navigate(`${BASE_URL}/pdf/subtitle-converter`, 1500);
    await browser.setupDownloadHook();

    // Select sample.srt fixture
    await browser.setFileInput('input[type="file"]', [FIXTURES.subtitles.sampleSrt]);
    await sleep(600);

    // Convert to vtt
    await browser.evaluate(`(() => {
      const fmt = document.getElementById('sub-target-format');
      fmt.value = 'vtt';
      fmt.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('sub-convert-btn').click();
    })()`);
    await sleep(800);

    // Download & Verify
    await browser.evaluate(`document.getElementById('sub-download-btn').click()`);
    await sleep(400);

    const header = await browser.getLastDownloadHeader();
    const isVtt = header && header.ascii.startsWith('WEBVTT');

    if (isVtt) {
      reporter.addResult('Live In-Browser Conversion (Subtitle SRT → VTT)', 'PASS', {
        info: `Magic Header: ${header.ascii.slice(0, 6)}, Filename: ${header.filename}`,
      });
    } else {
      reporter.addResult('Live In-Browser Conversion (Subtitle SRT → VTT)', 'FAIL', {
        tool: 'Subtitle Converter',
        test: 'Live Conversion & Download',
        expected: 'Valid WEBVTT output header',
        actual: header ? header.ascii : 'No download captured',
        suggestedFile: 'src/scripts/subtitle-converter.ts',
      });
    }

    await browser.close();
  } catch (err) {
    await browser.close();
    reporter.addResult('Live In-Browser Conversion', 'FAIL', {
      tool: 'Subtitle Converter',
      test: 'Browser Automation Run',
      expected: 'Clean browser execution',
      actual: err.message,
      suggestedFile: 'qa/qa-smoke.cjs',
      error: err,
    });
  }

  const success = reporter.printSummary();
  process.exit(success ? 0 : 1);
})();
