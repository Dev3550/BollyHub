// D:\BollyHub\fast_direct_uploader.cjs
// Ultra-Fast Direct EarnVids Bulk Remote Uploader (40+ Latest Movies)

const fs = require('fs');
const path = require('path');

let cheerio;
try {
  cheerio = require('cheerio');
} catch (_) {
  try {
    cheerio = require('d:/Exotic Clean/node_modules/cheerio');
  } catch (e) {
    console.error('Cheerio module could not be loaded:', e.message);
  }
}

const EARNVIDS_KEY = process.env.EARNVIDS_KEY || '48914lqe3hwneiukt644z';
const TARGET_COUNT = parseInt(process.env.BATCH_SIZE, 10) || 40;

// Folder Mapping on EarnVids (dev3550 Account)
const FOLDER_MAP = {
  'Bollywood': {
    parent: 157400,
    '480p': 157401,
    '720p': 157402,
    '1080p': 157403
  },
  'Hollywood': {
    parent: 157404,
    '480p': 157405,
    '720p': 157406,
    '1080p': 157407
  },
  'South Hindi Dubbed': {
    parent: 157408,
    '480p': 157409,
    '720p': 157410,
    '1080p': 157411
  }
};

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

async function resolveDirectFromUrl(startUrl) {
  if (!startUrl) return null;
  try {
    let currentUrl = startUrl;
    for (let step = 0; step < 8; step++) {
      const res = await fetch(currentUrl, {
        headers: { ...browserHeaders, Referer: currentUrl },
        redirect: 'manual',
        signal: AbortSignal.timeout(12000)
      });

      if ([301, 302, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        if (!loc) break;
        currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href;
        if (currentUrl.includes('googleusercontent.com')) {
          return currentUrl;
        }
        if (currentUrl.includes('url=http')) {
          try {
            const u = new URL(currentUrl);
            const target = u.searchParams.get('url');
            if (target && target.includes('googleusercontent.com')) {
              return target;
            }
          } catch (_) {}
        }
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

        if (!instadlLink) {
          $('a').each((_, a) => {
            const href = $(a).attr('href');
            if (href && href.includes('googleusercontent.com')) {
              instadlLink = href;
            }
          });
        }

        if (!instadlLink) return null;

        if (instadlLink.includes('googleusercontent.com')) {
          return instadlLink;
        }

        const dlRes = await fetch(instadlLink, {
          headers: { ...browserHeaders, Referer: currentUrl },
          redirect: 'manual',
          signal: AbortSignal.timeout(12000)
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
  } catch (_) {}
  return null;
}

async function resolveDirectGoogleCdnUrl(item) {
  if (item.fastdlUrl) {
    const cdn = await resolveDirectFromUrl(item.fastdlUrl);
    if (cdn && cdn.startsWith('http')) return cdn;
  }
  if (item.fastdlPagesUrl) {
    try {
      const u = new URL(item.fastdlPagesUrl);
      const innerUrl = u.searchParams.get('url');
      if (innerUrl) {
        const cdn = await resolveDirectFromUrl(innerUrl);
        if (cdn && cdn.startsWith('http')) return cdn;
      }
    } catch (_) {}
  }
  return null;
}

async function run() {
  console.log('===============================================================');
  console.log('⚡ BollyHub FAST Direct EarnVids Bulk Remote Uploader');
  console.log('👤 Target Account: dev3550');
  console.log(`🎯 Target Batch Size: ${TARGET_COUNT} movies`);
  console.log('===============================================================');

  const linksPath = path.join(__dirname, 'data', 'bollyflix_categorized_download_links.json');
  const checkpointPath = path.join(__dirname, 'data', 'earnvid_uploaded_checkpoint.json');
  const resultsPath = path.join(__dirname, 'data', 'earnvid_movies_uploaded.json');

  if (!fs.existsSync(linksPath)) {
    console.error('Download links database not found at:', linksPath);
    return;
  }

  // Load checkpoint
  let checkpoint = new Set();
  if (fs.existsSync(checkpointPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
      checkpoint = new Set(saved);
    } catch (_) {}
  }

  // Load results
  let uploadedResults = [];
  if (fs.existsSync(resultsPath)) {
    try {
      uploadedResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    } catch (_) {}
  }

  const data = JSON.parse(fs.readFileSync(linksPath, 'utf8'));

  // Prioritize 720p across Bollywood, South Hindi Dubbed, and Hollywood
  const pendingQueue = [];
  const categories = ['Bollywood', 'South Hindi Dubbed', 'Hollywood'];
  const qualities = ['720p', '1080p', '480p'];

  for (const q of qualities) {
    for (const cat of categories) {
      if (!data[cat] || !data[cat].qualities) continue;
      const items = data[cat].qualities[q] || [];
      for (const item of items) {
        const uniqueKey = `${item.movieId}_${q}`;
        if (!checkpoint.has(uniqueKey)) {
          pendingQueue.push({
            ...item,
            category: cat,
            quality: q,
            fldId: FOLDER_MAP[cat][q],
            uniqueKey
          });
        }
      }
    }
  }

  console.log(`📊 Currently Uploaded Checkpoint: ${checkpoint.size} movies.`);
  console.log(`📋 Total Available Queue: ${pendingQueue.length} items waiting.`);

  const batch = pendingQueue.slice(0, TARGET_COUNT);
  console.log(`\n🚀 Starting ultra-fast push for ${batch.length} movies...\n`);

  let successCount = 0;
  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    console.log(`[${i + 1}/${batch.length}] 🎬 ${item.title}`);
    console.log(`    📁 ${item.category} -> ${item.quality} (EarnVids Folder: ${item.fldId})`);

    const directUrl = await resolveDirectGoogleCdnUrl(item);
    if (!directUrl) {
      console.log(`    ⚠️ Could not resolve CDN URL, skipping to next.`);
      continue;
    }

    // Direct Remote Upload Call
    try {
      const title = `${item.title} [${item.quality}]`;
      const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directUrl)}&fld_id=${item.fldId}&title=${encodeURIComponent(title)}`;
      const res = await fetch(pushUrl);
      const json = await res.json();

      if (json.status === 200 && json.result && json.result.filecode) {
        const filecode = json.result.filecode;
        console.log(`    ✅ Pushed to EarnVids: https://morencius.com/embed/${filecode}`);

        checkpoint.add(item.uniqueKey);
        uploadedResults.push({
          movieId: item.movieId,
          title: item.title,
          category: item.category,
          quality: item.quality,
          filecode: filecode,
          embedUrl: `https://morencius.com/embed/${filecode}`,
          uploadedAt: new Date().toISOString()
        });
        successCount++;

        // Save progress after each successful push
        fs.writeFileSync(checkpointPath, JSON.stringify(Array.from(checkpoint), null, 2), 'utf8');
        fs.writeFileSync(resultsPath, JSON.stringify(uploadedResults, null, 2), 'utf8');
      } else {
        console.log(`    ❌ EarnVids response:`, json);
      }
    } catch (err) {
      console.log(`    ❌ Error pushing: ${err.message}`);
    }

    // Short 1-second pause between requests so EarnVids queue doesn't rate-limit
    await new Promise(r => setTimeout(r, 1000));
  }

  // Update persistent master log
  try {
    const { execSync } = require('child_process');
    execSync('node update_master_log.cjs', { cwd: __dirname });
    console.log('💾 Master persistent archive updated.');
  } catch (_) {}

  console.log('\n===============================================================');
  console.log(`🎉 FAST BATCH COMPLETE: Successfully pushed ${successCount}/${batch.length} movies to EarnVids!`);
  console.log(`📁 Total in Checkpoint now: ${checkpoint.size} movies.`);
  console.log('===============================================================');
}

run().catch(console.error);
