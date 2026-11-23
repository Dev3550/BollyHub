const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

async function checkAllLinks() {
  const url = 'https://new10.gdflix.io/file/5yGxn3nvp9CXhClyIgJR';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  console.log('All links on', url);
  $('a').each((i, el) => {
    console.log(`[${i}] Text: "${$(el).text().trim()}" -> Href: "${$(el).attr('href')}"`);
  });
}

checkAllLinks().catch(console.error);
