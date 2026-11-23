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

async function run() {
  console.log('🧹 1. Clearing all old errors from EarnVids queue...');
  await fetch(`https://earnvids.com/api/file/url_actions?key=${EARNVIDS_KEY}&delete_errors=1`);

  const movies = [
    {
      title: 'Halahal (2020) [300MB]',
      cleanTitle: 'Halahal (2020) Hindi WEB-DL 480p',
      url: 'https://dl.fastdlserver.site/?id=THAvZWVBYndka2F1VEpQNjJSTlIrS3VhZDl4Y1ZuKzFNR2d1UERmT3VlNkhHNGV4YXlENnNPZFVYR1FOZzBkNw==&type=file',
      fldId: 157401 // Bollywood 480p
    },
    {
      title: 'Sadak (1991) [400MB]',
      cleanTitle: 'Sadak (1991) Hindi WEB-DL 480p',
      url: 'https://dl.fastdlserver.site/?id=dXA3ekhDTTh4U1ZoNFFRaFV4elFkemFLdU96TmwzcDVrSHBOR0YwU3ArQldCM3VBVkZ5SzZXMkdac1EvZ0c3ZQ==&type=file',
      fldId: 157401 // Bollywood 480p
    }
  ];

  console.log('\n🚀 2. Pushing exactly 2 lightweight movies (~300-400MB each) to EarnVids...');
  const pushed = [];

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    console.log(`\n[${i+1}/2] Resolving fresh link for: ${m.title}`);
    const directUrl = await resolveDirect(m.url);
    if (!directUrl) {
      console.log(`❌ Failed to resolve link for ${m.title}`);
      continue;
    }
    console.log(`  ✅ Direct link acquired!`);

    const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directUrl)}&fld_id=${m.fldId}&title=${encodeURIComponent(m.cleanTitle)}`;
    const pushRes = await (await fetch(pushUrl)).json();
    console.log('  Push Response:', pushRes);

    if (pushRes.result?.filecode) {
      const code = pushRes.result.filecode;
      pushed.push({ title: m.title, filecode: code, embed: `https://morencius.com/e/${code}` });
      console.log(`  🎉 Pushed! Filecode: ${code} | Link: https://morencius.com/e/${code}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n📊 3. Monitoring EarnVids live download progress (for 90 seconds)...');
  for (let tick = 1; tick <= 18; tick++) {
    await new Promise(r => setTimeout(r, 5000));
    const q = await (await fetch(`https://earnvids.com/api/file/url_uploads?key=${EARNVIDS_KEY}`)).json();
    console.log(`\n[T+${tick * 5}s] EarnVids Queue Status:`);
    const items = q.result || [];
    if (items.length === 0) {
      console.log('  Queue is empty (Files finished downloading and moved to My Files!)');
      break;
    }
    for (const it of items) {
      console.log(`  - File: ${it.file_code} | Status: ${it.status} | Progress: ${it.progress}% | Bytes: ${it.bytes_loaded || 0}`);
    }
  }

  // Check account storage
  const acc = await (await fetch(`https://earnvids.com/api/account/info?key=${EARNVIDS_KEY}`)).json();
  console.log('\n===============================================================');
  console.log(`💾 Final Storage Used: ${(acc.result?.storage_used / 1024).toFixed(1)} MB (${(acc.result?.storage_used / (1024*1024)).toFixed(2)} GB)`);
  console.log(`📁 Total Files in Account: ${acc.result?.files_total}`);
  console.log('===============================================================');
}

run().catch(console.error);
