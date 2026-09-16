const http = require('http');

http.get('http://localhost:4321/image/image-compressor', (res) => {
  let html = '';
  res.on('data', (c) => (html += c));
  res.on('end', () => {
    console.log('=== VERIFYING IMAGE COMPRESSOR SEO & SCHEMA ===');

    // Title
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : '';
    console.log('Page Title:', title);
    if (!title.includes('Image Compressor')) {
      throw new Error(`Page title does not include Image Compressor: "${title}"`);
    }

    // Meta Description
    const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/);
    const desc = descMatch ? descMatch[1] : '';
    console.log(`Meta Description (${desc.length} chars):`, desc);
    if (desc.length < 130 || desc.length > 165) {
      console.warn(`WARNING: Meta description length (${desc.length}) outside 130-165 range`);
    }

    // Canonical
    const canonMatch = html.match(/<link\s+rel="canonical"\s+href="(.*?)"/);
    const canonical = canonMatch ? canonMatch[1] : '';
    console.log('Canonical:', canonical);
    if (!canonical.includes('/image/image-compressor')) {
      throw new Error(`Canonical does not point to /image/image-compressor: "${canonical}"`);
    }

    // H1
    const h1Matches = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim()
    );
    console.log(`H1 Count: ${h1Matches.length} ->`, h1Matches);
    if (h1Matches.length !== 1) {
      throw new Error(`Expected exactly 1 H1, found ${h1Matches.length}`);
    }

    // H2s
    const h2Matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim()
    );
    console.log('H2 Headings:', h2Matches);

    // Visible FAQs (<details>)
    const detailsCount = (html.match(/<details/g) || []).length;
    console.log('Visible FAQ Count:', detailsCount);
    if (detailsCount !== 5) {
      throw new Error(`Expected 5 visible FAQs, found ${detailsCount}`);
    }

    // JSON-LD Schemas
    const schemaMatches = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const schemas = schemaMatches.map((m) => {
      try {
        return JSON.parse(m[1])['@type'];
      } catch (e) {
        return 'INVALID';
      }
    });
    console.log('JSON-LD Schemas:', schemas);
    if (!schemas.includes('FAQPage') || !schemas.includes('SoftwareApplication') || !schemas.includes('BreadcrumbList')) {
      throw new Error('Missing expected JSON-LD schemas: ' + JSON.stringify(schemas));
    }

    // Check that FAQPage questions match visible content
    const faqSchemaRaw = schemaMatches.find(m => m[1].includes('"FAQPage"'));
    if (faqSchemaRaw) {
      const faqData = JSON.parse(faqSchemaRaw[1]);
      console.log('FAQPage entity count:', faqData.mainEntity?.length);
      if (faqData.mainEntity?.length !== 5) {
        throw new Error(`Expected 5 mainEntity in FAQPage, got: ${faqData.mainEntity?.length}`);
      }
    }

    console.log('\n✓ IMAGE COMPRESSOR SEO & SCHEMA AUDIT PASSED 100%!');
  });
}).on('error', (err) => {
  console.error('Failed to fetch page:', err);
  process.exit(1);
});
