const http = require('http');

http.get('http://localhost:4321/image/jpg-to-heic', (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    console.log('=== VERIFYING JPG TO HEIC SEO & CONTENT ===');

    // Title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1] : '';
    console.log('Page Title:', title);

    // Meta Description
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
    const meta = metaMatch ? metaMatch[1] : '';
    console.log(`Meta Description (${meta.length} chars):`, meta);

    // Canonical
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
    console.log('Canonical:', canonicalMatch ? canonicalMatch[1] : '');

    // H1
    const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) || [];
    console.log('H1 Count:', h1Matches.length, '->', h1Matches.map(h => h.replace(/<[^>]+>/g, '').trim()));

    // H2s
    const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/g) || [];
    const h2Texts = h2Matches.map(h => h.replace(/<[^>]+>/g, '').trim());
    console.log('H2 Headings:', h2Texts);

    // FAQs
    const faqMatches = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/g) || [];
    console.log('Visible FAQ Count:', faqMatches.length);

    // JSON-LD
    const jsonLdMatches = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    const schemas = jsonLdMatches.map(s => {
      try {
        const json = JSON.parse(s.replace(/<script[^>]*>/, '').replace(/<\/script>/, ''));
        return json['@type'];
      } catch (e) { return 'invalid'; }
    });
    console.log('JSON-LD Schemas:', schemas);

    const ok = h1Matches.length === 1 && meta.length >= 140 && meta.length <= 160 && faqMatches.length === 5;
    if (ok) {
      console.log('\n✓ SEO & CONTENT AUDIT PASSED 100%!');
    } else {
      console.error('\n❌ SEO Audit discrepancies detected!');
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
});
