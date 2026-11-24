const cheerio = require('d:/Exotic Clean/node_modules/cheerio');
const fs = require('fs');

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
    }
  }
  return null;
}

async function uploadMovie1() {
  console.log('===============================================================');
  console.log('🎯 Step 1: Uploading Movie 1: Ramayana Rise of a Legend (2026)');
  console.log('===============================================================');

  const ramayanUrl = 'https://dl.fastdlserver.site/?id=cXdjS3VRc1g5UTQrYVdVMnpIbWtVOEF5bTBpRHk5bk1BaURCUlI3bTFlNUVwQWtlbzdrODR0Sy9pc2pDalpjUg==&type=file';
  console.log('Resolving fresh direct CDN link...');
  const direct = await resolveDirect(ramayanUrl);
  if (!direct) {
    throw new Error('Failed to resolve direct CDN link for Ramayana');
  }
  console.log('✅ Fresh direct CDN link acquired!');
  console.log('Direct URL:', direct.substring(0, 80) + '...');

  const fldId = 157410; // South Hindi Dubbed 720p
  const title = 'Ramayana: Rise of a Legend (2026) Multi Audio 720p HEVC [BollyFlix]';

  console.log('Pushing to EarnVids dev3550...');
  const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(direct)}&fld_id=${fldId}&title=${encodeURIComponent(title)}`;
  const pushRes = await (await fetch(pushUrl)).json();
  console.log('EarnVids Push Response:', pushRes);

  if (pushRes.result?.filecode) {
    const code = pushRes.result.filecode;
    console.log(`\n🎉 Movie 1 PUSHED TO EARNVIDS!`);
    console.log(`   Filecode: ${code}`);
    console.log(`   Player URL: https://morencius.com/e/${code}`);
    console.log(`   EarnVids Watch: https://earnvids.com/e/${code}`);

    console.log('\nMonitoring live progress for 60 seconds...');
    for (let s = 5; s <= 60; s += 5) {
      await new Promise(r => setTimeout(r, 5000));
      const q = await (await fetch(`https://earnvids.com/api/file/url_uploads?key=${EARNVIDS_KEY}`)).json();
      const item = (q.result || []).find(x => x.file_code === code);
      if (item) {
        console.log(`  [T+${s}s] Status: ${item.status} | Progress: ${item.progress}% | Loaded: ${item.bytes_loaded || 0}`);
        if (item.status === 'OK' || item.status === 'COMPLETED' || item.progress === 100) {
          console.log('✅ File 1 download completed on EarnVids!');
          break;
        }
      } else {
        const info = await (await fetch(`https://earnvids.com/api/file/info?key=${EARNVIDS_KEY}&file_code=${code}`)).json();
        console.log(`  [T+${s}s] Not in queue, file status:`, info.result?.[0]?.status);
        if (info.result?.[0]?.status === 200) {
          console.log('✅ File 1 is live in My Files (status 200)!');
          break;
        }
      }
    }
  }
}

uploadMovie1().catch(console.error);
