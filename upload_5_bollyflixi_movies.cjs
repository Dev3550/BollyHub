const cheerio = require('d:/Exotic Clean/node_modules/cheerio');
const fs = require('fs');
const path = require('path');

const EARNVIDS_KEY = '48914lqe3hwneiukt644z';

async function resolveAndUpload(moviePageUrl, targetFolderId = 157410) {
  try {
    console.log(`\n===============================================================`);
    console.log(`🎬 Target: ${moviePageUrl}`);

    // Step 1: Fetch movie page
    const res = await fetch(moviePageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const rawTitle = $('title').text().replace('BollyFlix', '').replace(/- HDTC.*/, '').replace(/- WEBDL.*/, '').trim();
    console.log(`   Title: ${rawTitle}`);

    // Find 720p download link (nexdrive.help)
    let nexdriveUrl = '';
    $('a').each((_, a) => {
      const h = $(a).attr('href') || '';
      const t = $(a).text().trim();
      if (h.includes('nexdrive.help') && (t.includes('720p') || t.includes('1.') || t.includes('900') || !nexdriveUrl)) {
        nexdriveUrl = h;
      }
    });

    if (!nexdriveUrl) {
      console.log('   ⚠️ No NexDrive link found');
      return null;
    }
    console.log(`   [1/3] Found NexDrive: ${nexdriveUrl}`);

    // Step 2: Fetch NexDrive page
    const nexRes = await fetch(nexdriveUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const nexHtml = await nexRes.text();
    const nex$ = cheerio.load(nexHtml);

    let fastDlUrl = '';
    nex$('a').each((_, a) => {
      const h = nex$(a).attr('href') || '';
      if (h.includes('fast-dl.one')) fastDlUrl = h;
    });

    if (!fastDlUrl) {
      console.log('   ⚠️ No fast-dl.one link found on NexDrive');
      return null;
    }
    console.log(`   [2/3] Found FastDL: ${fastDlUrl}`);

    // Step 3: Fetch fast-dl.one page
    const fRes = await fetch(fastDlUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const fHtml = await fRes.text();
    const f$ = cheerio.load(fHtml);

    let dlPhpPath = '';
    f$('a').each((_, a) => {
      const h = f$(a).attr('href') || '';
      if (h.includes('dl.php?code=')) dlPhpPath = h;
    });

    if (!dlPhpPath) {
      console.log('   ⚠️ No dl.php link found on fast-dl.one');
      return null;
    }

    const finalDlEndpoint = new URL(dlPhpPath, fastDlUrl).href;

    // Step 4: Resolve 302 location to direct Google CDN link
    const tokenRes = await fetch(finalDlEndpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': fastDlUrl
      },
      redirect: 'manual'
    });

    const directCdnUrl = tokenRes.headers.get('location');
    if (!directCdnUrl) {
      console.log(`   ⚠️ Failed to get 302 redirect. Status: ${tokenRes.status}`);
      return null;
    }

    console.log(`   [3/3] ✅ Resolved Direct Google CDN Link!`);

    // Step 5: Push to EarnVids
    const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directCdnUrl)}&fld_id=${targetFolderId}&title=${encodeURIComponent(rawTitle + ' [720p]')}`;
    const pushRes = await (await fetch(pushUrl)).json();

    if (pushRes.result?.filecode) {
      const code = pushRes.result.filecode;
      console.log(`   🎉 SUCCESS! Pushed to EarnVids dev3550!`);
      console.log(`      Filecode: ${code}`);
      console.log(`      Embed: https://morencius.com/e/${code}`);
      return {
        title: rawTitle,
        filecode: code,
        embedUrl: `https://morencius.com/e/${code}`,
        folderId: targetFolderId
      };
    } else {
      console.log(`   ⚠️ EarnVids response:`, pushRes);
      return null;
    }
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    return null;
  }
}

async function run() {
  const targetMovies = [
    { url: 'https://bollyflixi.com/754837-pratap-2026-hindi-audio-hq-hdtc-720p-480p-1080p.html', folder: 157410 }, // South
    { url: 'https://bollyflixi.com/754763-nanhey-dil-2026-hindi-audio-hdtc-720p-480p-1080p.html', folder: 157402 }, // Bollywood
    { url: 'https://bollyflixi.com/754726-kalli-kheti-2026-hindi-audio-hdtc-720p-480p-1080p.html', folder: 157402 }, // Bollywood
    { url: 'https://bollyflixi.com/754689-ever-after-2026-hindi-dual-audio-webdl-720p-480p-1080p.html', folder: 157406 }, // Hollywood Dual Audio
    { url: 'https://bollyflixi.com/754208-drones-2026-hindi-tamil-dual-audio-webdl-720p-480p-1080p.html', folder: 157410 } // South
  ];

  console.log(`🚀 Starting Batch Upload of 5 Latest Movies from BollyFlixi to EarnVids...`);
  const uploaded = [];

  for (let i = 0; i < targetMovies.length; i++) {
    const t = targetMovies[i];
    console.log(`\n[${i + 1}/5] Processing movie...`);
    const res = await resolveAndUpload(t.url, t.folder);
    if (res) uploaded.push(res);
    console.log(`Waiting 4 seconds before next movie...`);
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log(`\n===============================================================`);
  console.log(`🎉 BATCH UPLOAD COMPLETE: ${uploaded.length}/5 MOVIES PUSHED TO EARNVIDS!`);
  console.log(`===============================================================`);
  for (const u of uploaded) {
    console.log(`🎬 ${u.title}`);
    console.log(`   Filecode: ${u.filecode}`);
    console.log(`   Live Embed: ${u.embedUrl}`);
  }

  fs.writeFileSync('D:/BollyHub/data/bollyflixi_5_uploaded.json', JSON.stringify(uploaded, null, 2));
}

run().catch(console.error);
