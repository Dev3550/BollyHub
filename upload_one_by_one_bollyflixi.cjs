const cheerio = require('d:/Exotic Clean/node_modules/cheerio');
const fs = require('fs');

const EARNVIDS_KEY = '48914lqe3hwneiukt644z';

async function resolveBollyflixi720p(moviePageUrl) {
  console.log(`\n===============================================================`);
  console.log(`🎬 Resolving 720p for: ${moviePageUrl}`);

  const res = await fetch(moviePageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  const rawTitle = $('title').text().replace('BollyFlix', '').replace(/- HDTC.*/, '').replace(/- WEBDL.*/, '').trim();
  console.log(`   Movie Title: ${rawTitle}`);

  const links = [];
  $('a').each((i, el) => {
    const h = $(el).attr('href') || '';
    const t = $(el).text().trim();
    if (h.includes('nexdrive.help')) {
      links.push({ text: t, href: h });
    }
  });

  // Find 720p (~700MB - 1.1GB)
  let target = links.find(l => l.text.includes('720p') || l.text.includes('800MB') || l.text.includes('900MB') || l.text.includes('1.0') || l.text.includes('1.1'));
  if (!target && links.length > 1) {
    target = links[1]; // usually 720p is the second quality after 480p
  }
  if (!target) target = links[0];

  console.log(`   Selected Quality: "${target.text}" (${target.href})`);

  const nexRes = await fetch(target.href, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const nexHtml = await nexRes.text();
  const nex$ = cheerio.load(nexHtml);

  let fastDlUrl = '';
  nex$('a').each((_, a) => {
    const h = nex$(a).attr('href') || '';
    if (h.includes('fast-dl.one')) fastDlUrl = h;
  });

  if (!fastDlUrl) throw new Error('No fast-dl.one link found');
  console.log(`   FastDL Page: ${fastDlUrl}`);

  const fRes = await fetch(fastDlUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const fHtml = await fRes.text();
  const f$ = cheerio.load(fHtml);

  let dlPhp = '';
  f$('a').each((_, a) => {
    const h = f$(a).attr('href') || '';
    if (h.includes('dl.php?code=')) dlPhp = h;
  });

  if (!dlPhp) throw new Error('No dl.php token link found');
  const endpoint = new URL(dlPhp, fastDlUrl).href;

  const tokenRes = await fetch(endpoint, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': fastDlUrl },
    redirect: 'manual'
  });

  const cdnUrl = tokenRes.headers.get('location');
  if (!cdnUrl) throw new Error(`Redirect failed: HTTP ${tokenRes.status}`);

  console.log(`   ✅ Direct CDN URL Acquired!`);
  return { title: rawTitle, directUrl: cdnUrl, quality: target.text };
}

async function uploadAndMonitorSingle(moviePageUrl, folderId = 157402) {
  const movie = await resolveBollyflixi720p(moviePageUrl);

  console.log(`\n📤 Pushing to EarnVids dev3550 (Folder: ${folderId})...`);
  const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(movie.directUrl)}&fld_id=${folderId}&title=${encodeURIComponent(movie.title + ' [720p]')}`;
  const pushRes = await (await fetch(pushUrl)).json();
  console.log('   EarnVids Response:', pushRes);

  if (!pushRes.result?.filecode) {
    throw new Error(`Failed to queue on EarnVids: ${JSON.stringify(pushRes)}`);
  }

  const filecode = pushRes.result.filecode;
  console.log(`\n🎉 Assigned Filecode: ${filecode}`);
  console.log(`📺 Embed Link: https://morencius.com/e/${filecode}`);

  console.log(`\n⏳ Monitoring live progress until 100% complete...`);
  let isDone = false;
  for (let second = 5; second <= 120; second += 5) {
    await new Promise(r => setTimeout(r, 5000));
    const q = await (await fetch(`https://earnvids.com/api/file/url_uploads?key=${EARNVIDS_KEY}`)).json();
    const item = (q.result || []).find(x => x.file_code === filecode);

    if (!item) {
      // Check if it already finished and moved to files
      const f = await (await fetch(`https://earnvids.com/api/file/info?key=${EARNVIDS_KEY}&file_code=${filecode}`)).json();
      if (f.result?.[0]?.status === 200) {
        console.log(`\n✅ [100%] COMPLETE! File is live in your account!`);
        isDone = true;
        break;
      }
    } else {
      console.log(`   [T+${second}s] Status: ${item.status} | Progress: ${item.progress}% | Loaded: ${item.bytes_loaded || 0}`);
      if (item.status === 'OK' || item.status === 'COMPLETED' || item.progress === 100) {
        console.log(`\n✅ [100%] COMPLETE! File successfully saved to EarnVids!`);
        isDone = true;
        break;
      }
      if (item.status === 'ERROR') {
        console.log(`\n⚠️ EarnVids reported ERROR for this link.`);
        break;
      }
    }
  }

  return { title: movie.title, filecode, isDone, embed: `https://morencius.com/e/${filecode}` };
}

async function run() {
  console.log('🧹 Clearing old errors from EarnVids queue...');
  await fetch(`https://earnvids.com/api/file/url_actions?key=${EARNVIDS_KEY}&delete_errors=1`);

  console.log('\n===============================================================');
  console.log('🎯 STEP 1: Uploading Movie 1 (Nanhey Dil 720p)...');
  console.log('   (Step 2 will strictly NOT start until Step 1 finishes!)');
  console.log('===============================================================');

  const movie1 = await uploadAndMonitorSingle('https://bollyflixi.com/754763-nanhey-dil-2026-hindi-audio-hdtc-720p-480p-1080p.html', 157402);

  console.log('\nResult of Movie 1:', movie1);

  console.log('\n===============================================================');
  console.log('🎯 STEP 2: Uploading Movie 2 (Kalli Kheti 720p)...');
  console.log('===============================================================');

  const movie2 = await uploadAndMonitorSingle('https://bollyflixi.com/754726-kalli-kheti-2026-hindi-audio-hdtc-720p-480p-1080p.html', 157402);

  console.log('\nResult of Movie 2:', movie2);

  console.log('\n===============================================================');
  console.log('🎉 BOTH MOVIES PROCESSED:');
  console.log(`1. ${movie1.title} -> ${movie1.embed}`);
  console.log(`2. ${movie2.title} -> ${movie2.embed}`);
  console.log('===============================================================');
}

run().catch(console.error);
