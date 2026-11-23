// D:\BollyHub\upload_2_verified.cjs
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
  // Clear any existing errors first so EarnVids queue is 100% clean
  console.log('🧹 Clearing any pending errors from EarnVids queue...');
  await fetch(`https://earnvids.com/api/file/url_actions?key=${EARNVIDS_KEY}&delete_errors=1`);

  const linksPath = path.join(__dirname, 'data', 'bollyflix_categorized_download_links.json');
  const d = JSON.parse(fs.readFileSync(linksPath, 'utf8'));

  // Select 2 fresh South Hindi Dubbed movies
  const targets = [
    {
      title: 'Anbil Avan (2026)',
      fastdlUrl: d['South Hindi Dubbed']['qualities']['720p'].find(m => m.title.includes('Anbil Avan'))?.fastdlUrl,
      category: 'South Hindi Dubbed',
      quality: '720p',
      fldId: 157410
    },
    {
      title: '#Cult (2026)',
      fastdlUrl: d['South Hindi Dubbed']['qualities']['720p'].find(m => m.title.includes('#Cult'))?.fastdlUrl,
      category: 'South Hindi Dubbed',
      quality: '720p',
      fldId: 157410
    }
  ];

  console.log('===============================================================');
  console.log('🎬 Uploading Exact 2 Movies to EarnVids (Clean Direct Mode)');
  console.log('👤 Target Account: dev3550');
  console.log('===============================================================\n');

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`[${i + 1}/2] Resolving fresh link: ${t.title}`);
    const directUrl = await resolveDirect(t.fastdlUrl);
    if (!directUrl) {
      console.log(`  ❌ Failed to resolve CDN link for ${t.title}`);
      continue;
    }

    console.log(`  ✅ Direct CDN Link: ${directUrl.substring(0, 70)}...`);
    console.log(`  📤 Pushing to EarnVids Folder ${t.fldId} (${t.category})...`);

    const res = await uploadToEarnVids(directUrl, `${t.title} [720p]`, t.fldId);
    console.log(`  📥 EarnVids Response:`, res);

    if (res.status === 200 && res.result?.filecode) {
      const filecode = res.result.filecode;
      results.push({
        title: t.title,
        filecode: filecode,
        embedUrl: `https://morencius.com/e/${filecode}`,
        fldId: t.fldId
      });
      console.log(`  🎉 SUCCESS! Pushed to EarnVids!`);
      console.log(`     Filecode: ${filecode}`);
      console.log(`     Link: https://morencius.com/e/${filecode}`);
    } else {
      console.log(`  ⚠️ EarnVids message:`, res);
    }
    console.log('---------------------------------------------------------------');
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n===============================================================');
  console.log('📋 SUMMARY OF PUSHED MOVIES:');
  for (const r of results) {
    console.log(`🎬 ${r.title} ➔ https://morencius.com/e/${r.filecode}`);
  }
  console.log('===============================================================');
}

run();
