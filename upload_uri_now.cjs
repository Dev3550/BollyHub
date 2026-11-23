const cheerio = require('d:/Exotic Clean/node_modules/cheerio');
const fs = require('fs');

const EARNVIDS_KEY = '48914lqe3hwneiukt644z';
const d = JSON.parse(fs.readFileSync('D:/BollyHub/data/bollyflix_categorized_download_links.json', 'utf8'));

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function resolveDirect(startUrl) {
  let currentUrl = startUrl;
  for (let step = 0; step < 8; step++) {
    const res = await fetch(currentUrl, {
      headers: { ...headers, Referer: currentUrl },
      redirect: 'manual'
    });

    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) break;
      currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href;
      if (currentUrl.includes('googleusercontent.com')) return currentUrl;
    } else if (res.status === 200) {
      const html = await res.text();
      const $ = cheerio.load(html);
      let foundLink = '';
      $('a').each((_, a) => {
        const txt = $(a).text().trim();
        const href = $(a).attr('href');
        if (href && (txt.includes('Instant DL') || href.includes('instadl.rest') || href.includes('googleusercontent.com'))) {
          foundLink = href;
        }
      });

      if (!foundLink) return null;
      if (foundLink.includes('googleusercontent.com')) return foundLink;

      const dlRes = await fetch(foundLink, {
        headers: { ...headers, Referer: currentUrl },
        redirect: 'manual'
      });
      const dlLoc = dlRes.headers.get('location');
      if (dlLoc) {
        if (dlLoc.includes('googleusercontent.com')) {
          try {
            const u = new URL(dlLoc);
            return u.searchParams.get('url') || dlLoc;
          } catch (_) {
            return dlLoc;
          }
        }
        return dlLoc;
      }
      return null;
    } else {
      break;
    }
  }
  return null;
}

async function uploadUri() {
  const item = d['Bollywood'].qualities['720p'][8]; // Uri The Surgical Strike
  console.log('Resolving Uri:', item.title);
  const directUrl = await resolveDirect(item.fastdlUrl);
  if (!directUrl) {
    console.log('Failed to resolve direct URL for Uri');
    return;
  }
  console.log('Resolved Uri direct URL!');
  const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directUrl)}&fld_id=157402&title=${encodeURIComponent('Uri The Surgical Strike (2019) [720p]')}`;
  const res = await (await fetch(pushUrl)).json();
  console.log('EarnVids Response for Uri:', res);
  if (res.result?.filecode) {
    console.log('🎉 Uri Filecode:', res.result.filecode);
    console.log('📺 Uri Embed:', `https://morencius.com/e/${res.result.filecode}`);
  }
}

uploadUri().catch(console.error);
