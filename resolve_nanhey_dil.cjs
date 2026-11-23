const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

async function getNanheyDil720p() {
  const url = 'https://bollyflixi.com/754763-nanhey-dil-2026-hindi-audio-hdtc-720p-480p-1080p.html';
  console.log('Fetching:', url);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);

  const links = [];
  $('a').each((i, el) => {
    const h = $(el).attr('href') || '';
    const t = $(el).text().trim();
    if (h.includes('nexdrive.help')) {
      links.push({ text: t, href: h });
    }
  });

  console.log('Found NexDrive links on Nanhey Dil:');
  console.log(links);

  // We want 720p (usually ~800MB - 1.1GB)
  const target720 = links.find(l => l.text.includes('720p') || l.text.includes('1.') || l.text.includes('800MB') || l.text.includes('900MB')) || links[1] || links[0];
  console.log('Selected 720p link:', target720);

  if (target720) {
    const nexRes = await fetch(target720.href, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const nexHtml = await nexRes.text();
    const nex$ = cheerio.load(nexHtml);
    let fastDlUrl = '';
    nex$('a').each((_, a) => {
      const h = nex$(a).attr('href') || '';
      if (h.includes('fast-dl.one')) fastDlUrl = h;
    });
    console.log('FastDL URL:', fastDlUrl);

    if (fastDlUrl) {
      const fRes = await fetch(fastDlUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const fHtml = await fRes.text();
      const f$ = cheerio.load(fHtml);
      let dlPhp = '';
      f$('a').each((_, a) => {
        const h = f$(a).attr('href') || '';
        if (h.includes('dl.php?code=')) dlPhp = h;
      });
      console.log('dlPhp:', dlPhp);
      const endpoint = new URL(dlPhp, fastDlUrl).href;

      const tokenRes = await fetch(endpoint, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': fastDlUrl },
        redirect: 'manual'
      });
      console.log('Location status:', tokenRes.status);
      const cdnUrl = tokenRes.headers.get('location');
      console.log('Direct CDN URL:', cdnUrl ? cdnUrl.substring(0, 80) + '...' : null);
      return cdnUrl;
    }
  }
}

getNanheyDil720p().catch(console.error);
