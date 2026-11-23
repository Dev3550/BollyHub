const cheerio = require('d:/Exotic Clean/node_modules/cheerio');
const fs = require('fs');
const path = require('path');

const EARNVIDS_KEY = '48914lqe3hwneiukt644z';
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

async function resolveDirect(startUrl) {
  let curr = startUrl;
  for (let step = 0; step < 8; step++) {
    const res = await fetch(curr, { headers: { ...headers, Referer: curr }, redirect: 'manual' });
    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) break;
      curr = loc.startsWith('http') ? loc : new URL(loc, curr).href;
      if (curr.includes('googleusercontent.com')) return curr;
    } else if (res.status === 200) {
      const html = await res.text();
      const $ = cheerio.load(html);
      let foundLink = '';
      $('a').each((_, a) => {
        const txt = $(a).text().trim();
        const href = $(a).attr('href');
        if (href && (txt.includes('Instant DL') || href.includes('instadl.rest'))) foundLink = href;
      });
      if (!foundLink) return null;
      const dlRes = await fetch(foundLink, { headers: { ...headers, Referer: curr }, redirect: 'manual' });
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

async function uploadMovie(title, fastdlUrl, fldId) {
  console.log(`\n===============================================================`);
  console.log(`🎬 Processing: ${title}`);
  console.log(`📁 EarnVids Folder: ${fldId}`);
  console.log(`===============================================================`);

  console.log('Resolving direct CDN link...');
  const directUrl = await resolveDirect(fastdlUrl);
  if (!directUrl) {
    console.error(`❌ Could not resolve direct link for ${title}`);
    return null;
  }
  console.log(`✅ Direct CDN link acquired!`);

  console.log('Pushing to EarnVids remote queue...');
  const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directUrl)}&fld_id=${fldId}&title=${encodeURIComponent(title + ' [720p]')}`;
  const res = await (await fetch(pushUrl)).json();
  console.log('EarnVids Response:', res);

  if (res.result?.filecode) {
    const code = res.result.filecode;
    console.log(`🎉 SUCCESS! Pushed to EarnVids!`);
    console.log(`   Filecode: ${code}`);
    console.log(`   Embed: https://morencius.com/e/${code}`);
    return { title, filecode: code, embedUrl: `https://morencius.com/e/${code}`, fldId };
  }
  return null;
}

async function run() {
  const d = JSON.parse(fs.readFileSync('D:/BollyHub/data/bollyflix_categorized_download_links.json', 'utf8'));

  const results = [];

  // 1. Ramayana: Rise of a Legend (2026) - Already pushed as d7p0z2uc1zm8
  results.push({
    title: 'Ramayana: Rise of a Legend (2026)',
    filecode: 'd7p0z2uc1zm8',
    embedUrl: 'https://morencius.com/e/d7p0z2uc1zm8',
    fldId: 157410,
    category: 'SOUTH HINDI DUBBED',
    release_year: '2026',
    poster: 'https://m.media-amazon.com/images/M/MV5BMjA4NzUyMzYtNDU0Mi00OGYwLTgwOWItYmM4MjNmYWI5M2EwXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg'
  });

  // 2. Mahakavya Shri Ramayan Katha (2026)
  const mahakavya = d['Bollywood'].qualities['720p'].find(m => m.title.includes('Mahakavya'));
  if (mahakavya) {
    const res2 = await uploadMovie('Mahakavya Shri Ramayan Katha (2026)', mahakavya.fastdlUrl, 157402);
    if (res2) {
      results.push({
        ...res2,
        category: 'BOLLYWOOD',
        release_year: '2026',
        poster: 'https://m.media-amazon.com/images/M/MV5BYzA2ZDk3OTctZjU5MS00NzAwLWEwOGMtMGQwNTllODQ5MDljXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg'
      });
    }
  }

  // 3. Adipurush (2023)
  const adipurush = d['Bollywood'].qualities['720p'].find(m => m.title.includes('Adipurush'));
  if (adipurush) {
    const res3 = await uploadMovie('Adipurush (2023)', adipurush.fastdlUrl, 157402);
    if (res3) {
      results.push({
        ...res3,
        category: 'BOLLYWOOD',
        release_year: '2023',
        poster: 'https://m.media-amazon.com/images/M/MV5BNmU1NTE3OGQtYzAzMS00ODU4LTk2YmQtOGIzNDBhNjVhNTUyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg'
      });
    }
  }

  console.log(`\n===============================================================`);
  console.log(`📋 3 MOVIES READY FOR BOLLEYHUB:`);
  for (const r of results) {
    console.log(`🎬 ${r.title}`);
    console.log(`   Filecode: ${r.filecode}`);
    console.log(`   Embed: ${r.embedUrl}`);
  }
  console.log(`===============================================================`);

  // Write checkpoint
  fs.writeFileSync('D:/BollyHub/data/ramayan_3_uploads.json', JSON.stringify(results, null, 2));
}

run().catch(console.error);
