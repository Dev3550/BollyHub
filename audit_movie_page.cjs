const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

async function inspectMovie(url) {
  console.log(`Inspecting movie: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  console.log('Status:', res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  console.log('Title:', $('title').text().trim());

  console.log('\n--- ALL DOWNLOAD / OUTBOUND LINKS ---');
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && (href.startsWith('http') || href.includes('download') || href.includes('file'))) {
      console.log(`[${i}] Text: "${text}" -> Href: "${href}"`);
    }
  });

  // Check forms and buttons
  $('form').each((i, el) => {
    console.log(`Form [${i}]: action="${$(el).attr('action')}" method="${$(el).attr('method')}"`);
  });
}

inspectMovie('https://bollyflixi.com/754837-pratap-2026-hindi-audio-hq-hdtc-720p-480p-1080p.html').catch(console.error);
