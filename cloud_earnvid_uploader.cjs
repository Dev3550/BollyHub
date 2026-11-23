// D:\BollyHub\cloud_earnvid_uploader.cjs
// Cloud-Enabled Automated BollyFlix -> EarnVids Bulk Uploader
// Runs autonomously on GitHub Actions Cloud Runners (24/7 without local PC)

const fs = require('fs');
const path = require('path');

let cheerio;
try {
  cheerio = require('cheerio');
} catch (_) {
  cheerio = require('d:/Exotic Clean/node_modules/cheerio');
}

const EARNVIDS_KEY = process.env.EARNVIDS_KEY || '48914lqe3hwneiukt644z';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 50; // 50 movies/qualities per run (Runs every 15 mins)

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

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function resolveDirectGoogleCdnUrl(fastDlUrl) {
  if (!fastDlUrl) return null;
  try {
    let currentUrl = fastDlUrl;
    for (let step = 0; step < 6; step++) {
      const res = await fetch(currentUrl, { headers, redirect: 'manual' });
      if ([301, 302, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        if (!loc) break;
        currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href;
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

        const dlRes = await fetch(instadlLink, {
          headers: { ...headers, Referer: currentUrl },
          redirect: 'manual'
        });
        const dlLoc = dlRes.headers.get('location');
        if (dlLoc) {
          const u = new URL(dlLoc);
          return u.searchParams.get('url') || dlLoc;
        }
        return null;
      } else {
        break;
      }
    }
  } catch (_) {}
  return null;
}

async function run() {
  console.log('===============================================================');
  console.log('☁️ BollyHub 24/7 Cloud EarnVids Uploader Running');
  console.log('👤 EarnVids Target Account: dev3550');
  console.log(`📦 Batch Size: ${BATCH_SIZE} links`);
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

  // Collect pending items across categories
  const pendingQueue = [];
  const categories = ['Bollywood', 'Hollywood', 'South Hindi Dubbed'];
  const qualities = ['720p', '480p', '1080p']; // Prioritize 720p first

  for (const cat of categories) {
    if (!data[cat] || !data[cat].qualities) continue;
    for (const q of qualities) {
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

  console.log(`📊 Checkpoint: ${checkpoint.size} already uploaded.`);
  console.log(`📋 Total Pending Queue: ${pendingQueue.length} items waiting.`);

  if (pendingQueue.length === 0) {
    console.log('🎉 All items in queue have been uploaded!');
    return;
  }

  const currentBatch = pendingQueue.slice(0, BATCH_SIZE);
  console.log(`\n🚀 Starting upload for current batch of ${currentBatch.length} items...\n`);

  let successCount = 0;
  for (let i = 0; i < currentBatch.length; i++) {
    const item = currentBatch[i];
    console.log(`[${i + 1}/${currentBatch.length}] Processing: ${item.title}`);
    console.log(`    📁 Target: ${item.category} -> ${item.quality} (EarnVids fld_id: ${item.fldId})`);

    const directUrl = await resolveDirectGoogleCdnUrl(item.fastdlUrl);
    if (!directUrl) {
      console.log(`    ⚠️ Could not resolve direct Google CDN link, skipping for next pass.`);
      continue;
    }

    console.log(`    🔗 Direct Link: ${directUrl.substring(0, 60)}...`);

    // Remote upload to EarnVids
    try {
      const title = `${item.title} [${item.quality}]`;
      const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directUrl)}&fld_id=${item.fldId}&title=${encodeURIComponent(title)}`;
      const res = await fetch(pushUrl);
      const json = await res.json();

      if (json.status === 200 && json.result && json.result.filecode) {
        const filecode = json.result.filecode;
        console.log(`    ✅ PUSHED! EarnVids Filecode: ${filecode}`);
        console.log(`    🎬 Embed: https://morencius.com/embed/${filecode}`);

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
      } else {
        console.log(`    ❌ EarnVids API error:`, json);
      }
    } catch (err) {
      console.log(`    ❌ Network error pushing to EarnVids: ${err.message}`);
    }

    // Small courteous pause
    await new Promise(r => setTimeout(r, 1500));
  }

  // Save updated checkpoint & results
  fs.writeFileSync(checkpointPath, JSON.stringify(Array.from(checkpoint), null, 2), 'utf8');
  fs.writeFileSync(resultsPath, JSON.stringify(uploadedResults, null, 2), 'utf8');

  console.log('\n===============================================================');
  console.log(`✨ Batch Complete: ${successCount}/${currentBatch.length} pushed to EarnVids successfully.`);
  console.log(`💾 Checkpoint saved (${checkpoint.size} total uploaded).`);
  console.log('===============================================================');
}

run().catch(console.error);
