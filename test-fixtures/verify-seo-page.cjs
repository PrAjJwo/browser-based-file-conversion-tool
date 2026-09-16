const http = require('http');

http.get('http://127.0.0.1:4321/image/heic-to-jpg', (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    console.log('==============================================');
    console.log('PAGE SEO & STRUCTURE AUDIT: /image/heic-to-jpg');
    console.log('==============================================\n');

    // 1. Check title
    const titleMatch = body.match(/<title>(.*?)<\/title>/);
    console.log('1. <title> Tag:', titleMatch ? titleMatch[1] : 'MISSING');

    // 2. Check meta description
    const descMatch = body.match(/<meta name="description" content="(.*?)"/);
    const desc = descMatch ? descMatch[1] : '';
    console.log('2. Meta Description:', desc);
    console.log('   Length:', desc.length, 'characters (target: 140-160)');

    // 3. Check H1 count & content
    const h1s = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) || [];
    console.log('\n3. H1 Count:', h1s.length, '(expected: 1)');
    h1s.forEach((h) => console.log('   H1:', h.replace(/<[^>]+>/g, '').trim()));

    // 4. Check H2 count & order
    const h2s = body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/g) || [];
    console.log('\n4. H2 Count:', h2s.length);
    h2s.forEach((h, i) => console.log(`   H2 [${i + 1}]:`, h.replace(/<[^>]+>/g, '').trim()));

    // 5. Check Schemas
    const schemaMatches = body.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
    console.log('\n5. JSON-LD Schemas:', schemaMatches.length);
    schemaMatches.forEach((s, idx) => {
      const raw = s.replace(/<script[^>]*>|<\/script>/g, '');
      const parsed = JSON.parse(raw);
      console.log(`   Schema ${idx + 1} [@type: ${parsed['@type']}]:`);
      if (parsed['@type'] === 'SoftwareApplication') {
        console.log('     Name:', parsed.name);
        console.log('     OperatingSystem:', parsed.operatingSystem);
      } else if (parsed['@type'] === 'BreadcrumbList') {
        console.log('     Items:', parsed.itemListElement.map((e) => e.name).join(' > '));
      } else if (parsed['@type'] === 'FAQPage') {
        console.log('     FAQ Question Count:', parsed.mainEntity.length);
        parsed.mainEntity.forEach((q, qIdx) => {
          console.log(`       Q${qIdx + 1}: ${q.name}`);
        });
      }
    });

    // 6. Check exact privacy sentence
    const exactSentence = 'Your files never leave your device. Everything is processed in your browser.';
    const occurrences = (body.match(new RegExp(exactSentence, 'g')) || []).length;
    console.log('\n6. Exact Privacy Promise Occurrences:', occurrences);

    // 7. Word count of "What is a HEIC file?"
    const whatIsHeicMatch = body.match(/id="what-is-heic-heading"[\s\S]*?<\/section>/);
    if (whatIsHeicMatch) {
      const pMatches = whatIsHeicMatch[0].match(/<p[^>]*>([\s\S]*?)<\/p>/g) || [];
      const textOnly = pMatches
        .map((p) => p.replace(/<[^>]+>/g, ' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const words = textOnly.split(' ').filter((w) => w.length > 0);
      console.log('\n7. "What is a HEIC file?" Explanatory Word Count:', words.length, '(target: 140–180)');
    }

    // 8. Internal link to /image
    const hasImageLink = body.includes('href="/image"');
    console.log('8. Contains internal link to /image:', hasImageLink);

    // 9. Check FAQ accordions (<details>/<summary>)
    const detailsCount = (body.match(/<details/g) || []).length;
    const summaryCount = (body.match(/<summary/g) || []).length;
    console.log('\n9. Accessible FAQ Details/Summary Count:', detailsCount, 'details,', summaryCount, 'summaries');

    console.log('\n==============================================');
    console.log('AUDIT COMPLETED');
    console.log('==============================================');
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('Audit failed to connect to dev server:', err);
  process.exit(1);
});
