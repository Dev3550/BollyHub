const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

async function checkCloud() {
  const url = 'https://new10.gdflix.io/cloud/1795442750/5yGxn3nvp9CXhClyIgJR';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://new10.gdflix.io/file/5yGxn3nvp9CXhClyIgJR'
    }
  });
  console.log('Status:', res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  $('a').each((i, el) => {
    console.log(`[${i}] Text: "${$(el).text().trim()}" -> Href: "${$(el).attr('href')}"`);
  });
}

checkCloud().catch(console.error);
