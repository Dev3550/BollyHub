const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

const EARNVIDS_KEY = '48914lqe3hwneiukt644z';

async function resolveBollyflixiMovie(moviePageUrl) {
  console.log(`\n===============================================================`);
  console.log(`🎬 Scraping Movie Page: ${moviePageUrl}`);
  console.log(`===============================================================`);

  // Step 1: Fetch movie page
  const res = await fetch(moviePageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const pageTitle = $('title').text().replace('BollyFlix', '').replace(/- HDTC.*/, '').trim();
  console.log(`  Movie: ${pageTitle}`);

  // Find 720p or highest download link (nexdrive.help)
  let nexdriveUrl = '';
  $('a').each((_, a) => {
    const h = $(a).attr('href') || '';
    const t = $(a).text().trim();
    if (h.includes('nexdrive.help') && (t.includes('720p') || t.includes('1.') || t.includes('Download') || !nexdriveUrl)) {
      nexdriveUrl = h;
    }
  });

  if (!nexdriveUrl) {
    console.error('  ❌ No NexDrive link found');
    return null;
  }
  console.log(`  Step 1: Found NexDrive Link: ${nexdriveUrl}`);

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
    console.error('  ❌ No fast-dl.one link found on NexDrive');
    return null;
  }
  console.log(`  Step 2: Found fast-dl.one Link: ${fastDlUrl}`);

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
    console.error('  ❌ No dl.php link found on fast-dl.one');
    return null;
  }

  const finalDlEndpoint = new URL(dlPhpPath, fastDlUrl).href;
  console.log(`  Step 3: Triggering download token from: ${finalDlEndpoint}`);

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
    console.error(`  ❌ Failed to get 302 redirect. Status: ${tokenRes.status}`);
    return null;
  }

  console.log(`  ✅ Direct Google CDN URL acquired!`);
  console.log(`     ${directCdnUrl.substring(0, 70)}...`);

  // Step 5: Push to EarnVids
  console.log(`  Step 5: Pushing to EarnVids (dev3550)...`);
  const fldId = 157410; // South / New Release folder
  const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directCdnUrl)}&fld_id=${fldId}&title=${encodeURIComponent(pageTitle + ' [720p]')}`;
  const pushRes = await (await fetch(pushUrl)).json();
  console.log(`  📥 EarnVids Queue Response:`, pushRes);

  if (pushRes.result?.filecode) {
    const code = pushRes.result.filecode;
    console.log(`\n🎉 SUCCESS! Uploaded to EarnVids!`);
    console.log(`   Title: ${pageTitle}`);
    console.log(`   Filecode: ${code}`);
    console.log(`   Embed: https://morencius.com/e/${code}`);
    return { title: pageTitle, filecode: code, embedUrl: `https://morencius.com/e/${code}` };
  }
  return null;
}

// Test on Pratap 2026
resolveBollyflixiMovie('https://bollyflixi.com/754837-pratap-2026-hindi-audio-hq-hdtc-720p-480p-1080p.html').catch(console.error);
