const http = require('http');

async function fetchRoute(baseUrl, path) {
  return new Promise((resolve) => {
    const cleanPath = path.split('#')[0];
    const req = http.get(`${baseUrl}${cleanPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          path,
          statusCode: res.statusCode,
          ok: res.statusCode === 200,
          html: data,
        });
      });
    });
    req.on('error', (err) => resolve({ path, statusCode: 0, ok: false, error: err, html: '' }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ path, statusCode: 408, ok: false, error: new Error('Timeout'), html: '' });
    });
  });
}

function extractInternalLinks(html) {
  const links = new Set();
  const regex = /<a\s+[^>]*?href=["'](\/[^"']*?)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    // Skip external URLs, protocol-relative URLs, dev-only URLs, mailto, etc.
    if (href.startsWith('//') || href.startsWith('/__qa')) continue;
    links.add(href);
  }
  return Array.from(links);
}

async function crawlInternalLinks(baseUrl = 'http://localhost:4321', initialRoutes = ['/']) {
  const visited = new Set();
  const queue = [...initialRoutes];
  const brokenLinks = [];
  let totalLinksChecked = 0;

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const cleanPath = currentPath.split('#')[0] || '/';

    if (visited.has(cleanPath)) continue;
    visited.add(cleanPath);

    const res = await fetchRoute(baseUrl, cleanPath);
    totalLinksChecked++;

    if (!res.ok) {
      brokenLinks.push({
        path: currentPath,
        statusCode: res.statusCode,
        error: res.error ? res.error.message : `HTTP ${res.statusCode}`,
      });
      continue;
    }

    const pageLinks = extractInternalLinks(res.html);
    for (const link of pageLinks) {
      const normalized = link.split('#')[0] || '/';
      if (!visited.has(normalized) && !queue.includes(normalized)) {
        queue.push(normalized);
      }
    }
  }

  return {
    totalChecked: totalLinksChecked,
    visitedPaths: Array.from(visited),
    brokenLinks,
    ok: brokenLinks.length === 0,
  };
}

module.exports = {
  crawlInternalLinks,
  extractInternalLinks,
};
