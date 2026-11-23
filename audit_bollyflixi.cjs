const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

async function audit() {
  const target = 'https://bollyflixi.com/';
  console.log(`Auditing: ${target}`);
  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });
    console.log('Status:', res.status);
    console.log('Final URL:', res.url);
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log('Title:', $('title').text().trim());

    // Find movie articles/links
    const posts = [];
    $('article, .post, .item, a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && (href.includes('/movie/') || href.includes('download') || (href.startsWith('https://bollyflixi.com/') && href.length > 30))) {
        if (!posts.some(p => p.href === href)) {
          posts.push({ text: text.substring(0, 50), href });
        }
      }
    });

    console.log(`Found ${posts.length} movie candidates. First 5:`);
    console.log(posts.slice(0, 5));

    // If we have a movie link, inspect it
    if (posts.length > 0) {
      const sampleMovie = posts[0].href;
      console.log(`\nInspecting sample movie page: ${sampleMovie}`);
      const mRes = await fetch(sampleMovie, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      console.log('Movie page status:', mRes.status);
      const mHtml = await mRes.text();
      const m$ = cheerio.load(mHtml);
      console.log('Movie Title:', m$('title').text().trim());

      const dlLinks = [];
      m$('a').each((i, el) => {
        const href = m$(el).attr('href');
        const text = m$(el).text().trim();
        if (href && (
          text.toLowerCase().includes('download') ||
          text.toLowerCase().includes('480p') ||
          text.toLowerCase().includes('720p') ||
          text.toLowerCase().includes('1080p') ||
          href.includes('drive') ||
          href.includes('fastdl') ||
          href.includes('gdflix') ||
          href.includes('hubcloud') ||
          href.includes('link')
        )) {
          dlLinks.push({ text: text.substring(0, 40), href: href.substring(0, 80) });
        }
      });

      console.log(`Found ${dlLinks.length} download-related links:`);
      console.log(dlLinks.slice(0, 10));
    }
  } catch (e) {
    console.error('Audit Error:', e.message);
  }
}

audit().catch(console.error);
