// D:\BollyHub\upload_2_now.cjs
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const EARNVIDS_KEY = '48914lqe3hwneiukt644z';

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function resolveDirect(startUrl) {
  if (!startUrl) return null;
  try {
    let currentUrl = startUrl;
    for (let step = 0; step < 8; step++) {
      const res = await fetch(currentUrl, {
        headers: { ...browserHeaders, Referer: currentUrl },
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
        let instadlLink = '';
        $('a').each((_, a) => {
          const txt = $(a).text().trim();
          const href = $(a).attr('href');
          if (href && (txt.includes('Instant DL') || href.includes('instadl.rest'))) {
            instadlLink = href;
          }
        });

        if (!instadlLink) return null;
        if (instadlLink.includes('googleusercontent.com')) return instadlLink;

        const dlRes = await fetch(instadlLink, {
          headers: { ...browserHeaders, Referer: currentUrl },
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
  } catch (e) {
    console.error('Resolve error:', e.message);
  }
  return null;
}

async function uploadToEarnVids(directUrl, title, fldId) {
  const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directUrl)}&fld_id=${fldId}&title=${encodeURIComponent(title)}`;
  const res = await fetch(pushUrl);
  return await res.json();
}

async function run() {
  const linksPath = path.join(__dirname, 'data', 'bollyflix_categorized_download_links.json');
  const d = JSON.parse(fs.readFileSync(linksPath, 'utf8'));

  // Target 2 pending movies
  const targets = [
    {
      title: 'Billu (2009)',
      fastdlUrl: d['Bollywood']['qualities']['720p'].find(m => m.title.includes('Billu'))?.fastdlUrl,
      category: 'Bollywood',
      quality: '720p',
      fldId: 157402
    },
    {
      title: 'Dil Bechara (2020)',
      fastdlUrl: d['Bollywood']['qualities']['720p'].find(m => m.title.includes('Dil Bechara'))?.fastdlUrl,
      category: 'Bollywood',
      quality: '720p',
      fldId: 157402
    }
  ];

  console.log('===============================================================');
  console.log('🎬 Uploading 2 Verified Movies to EarnVids Right Now');
  console.log('👤 Target Account: dev3550');
  console.log('===============================================================\n');

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`[${i + 1}/2] Processing: ${t.title}`);
    console.log(`  🔗 Resolving direct CDN link...`);
    const directUrl = await resolveDirect(t.fastdlUrl);
    if (!directUrl) {
      console.log(`  ❌ Failed to resolve CDN link for ${t.title}`);
      continue;
    }

    console.log(`  ✅ Direct CDN Link: ${directUrl.substring(0, 75)}...`);
    console.log(`  📤 Uploading to EarnVids (Folder ${t.fldId})...`);

    const res = await uploadToEarnVids(directUrl, `${t.title} [720p]`, t.fldId);
    console.log(`  📥 EarnVids Response:`, res);

    if (res.status === 200 && res.result?.filecode) {
      const filecode = res.result.filecode;
      console.log(`  🎉 SUCCESS! Pushed to EarnVids!`);
      console.log(`     Filecode: ${filecode}`);
      console.log(`     Embed URL: https://morencius.com/embed/${filecode}`);
      console.log(`     Download URL: https://morencius.com/d/${filecode}`);
    } else {
      console.log(`  ⚠️ EarnVids message: ${res.msg}`);
    }
    console.log('---------------------------------------------------------------');
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n✅ 2 Movies batch process finished!');
}

run();
