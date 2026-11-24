const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

const API_KEY = '48941hzj3ypnutkjvp4yn'; // Dev333 Account
const FOLDER_ID = '157436'; // South Hindi Dubbed folder on Dev333

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const RAMAYANA_FASTDL = 'https://dl.fastdlserver.site/?id=dXFtbS9IK1EzdnpleUh2N00rNXdheXlVT25WSEFUd0daM3lzMVhoUUpaV2FYOFZ5VUhQZkd0RlFPcFNkQVRNWg==&type=file';
const MOVIE_CLEAN_TITLE = 'Ramayana Rise Of A Legend (2026) [720p]';
const BUFFER_FILE = path.join(__dirname, 'ramayana_720p_buffer.mp4');

async function resolveDirect(startUrl) {
  if (!startUrl) return null;
  try {
    let curr = startUrl;
    for (let step = 0; step < 8; step++) {
      const res = await fetch(curr, { headers: { ...browserHeaders, Referer: curr }, redirect: 'manual' });
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
        const dlRes = await fetch(foundLink, { headers: { ...browserHeaders, Referer: curr }, redirect: 'manual' });
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
  } catch (e) {
    console.error('Resolve error:', e.message);
  }
  return null;
}

async function downloadBuffer() {
  if (fs.existsSync(BUFFER_FILE)) {
    const sz = fs.statSync(BUFFER_FILE).size;
    if (sz > 500 * 1024 * 1024) {
      console.log(`📦 Existing buffer found on disk: ${(sz / (1024 * 1024)).toFixed(1)} MB, skipping download.`);
      return true;
    }
  }

  console.log('Step 1: Resolving direct CDN download link for Ramayana...');
  const directUrl = await resolveDirect(RAMAYANA_FASTDL);
  if (!directUrl) {
    throw new Error('Failed to resolve direct Google CDN link.');
  }
  console.log(`  ✅ Direct Link: ${directUrl.slice(0, 70)}...`);

  console.log('Step 2: Downloading video to local high-speed buffer...');
  const dlRes = await fetch(directUrl);
  if (!dlRes.ok) throw new Error(`CDN HTTP status: ${dlRes.status}`);

  const totalBytes = parseInt(dlRes.headers.get('content-length') || '0', 10);
  console.log(`  📦 Total size: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`);

  const fileStream = fs.createWriteStream(BUFFER_FILE);
  let downloaded = 0;
  let lastReport = 0;
  const reader = dlRes.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(value);
    downloaded += value.length;
    const pct = totalBytes ? Math.floor((downloaded / totalBytes) * 100) : 0;
    if (pct >= lastReport + 20) {
      console.log(`  ⬇️ Progress: ${pct}% (${(downloaded / (1024 * 1024)).toFixed(1)} MB)`);
      lastReport = pct;
    }
  }
  await new Promise(r => fileStream.end(r));
  console.log(`  ✅ Download verified on disk: ${(fs.statSync(BUFFER_FILE).size / (1024 * 1024)).toFixed(1)} MB`);
  return true;
}

async function uploadToEarnVidsWithRetry() {
  console.log('\nStep 3: Uploading buffer directly to EarnVids using high-performance curl stream...');
  const filename = `${MOVIE_CLEAN_TITLE}.mp4`;

  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`\n--- Upload Attempt ${attempt}/5 ---`);
    try {
      // 1. Get fresh upload server node
      const sRes = await (await fetch(`https://earnvids.com/api/upload/server?key=${API_KEY}`)).json();
      const uploadUrl = sRes.result;
      console.log(`  🌐 Upload Server Node: ${uploadUrl}`);

      // 2. Run curl command with 60s connect timeout and 30min max time
      const curlCmd = `curl.exe -s --connect-timeout 60 --max-time 1800 -F "key=${API_KEY}" -F "fld_id=${FOLDER_ID}" -F "file=@${BUFFER_FILE};filename=${filename}" "${uploadUrl}"`;
      console.log(`  🚀 Initiating direct stream to EarnVids CDN...`);

      const output = execSync(curlCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      console.log(`  📥 EarnVids Server Response:`, output.trim());

      let json;
      try {
        json = JSON.parse(output);
      } catch (pe) {
        // Find JSON substring
        const match = output.match(/\{[\s\S]*\}/);
        if (match) json = JSON.parse(match[0]);
      }

      if (json && json.files && json.files[0]?.status === 'OK') {
        const filecode = json.files[0].filecode;
        console.log(`\n🎉🎉 RAMAYANA UPLOADED SUCCESSFULLY! 🎉🎉`);
        console.log(`   Filecode: ${filecode}`);
        console.log(`   Player URL: https://morencius.com/e/${filecode}`);
        return filecode;
      } else {
        console.warn(`  ⚠️ Server rejected upload:`, json || output);
      }
    } catch (err) {
      console.error(`  ❌ Attempt ${attempt} failed:`, err.message);
    }
    console.log('Waiting 8 seconds before retrying with fresh upload node...');
    await new Promise(r => setTimeout(r, 8000));
  }
  throw new Error('All 5 upload attempts failed.');
}

async function main() {
  console.log('===============================================================');
  console.log(`🚀 ROBUST UPLOADER: ${MOVIE_CLEAN_TITLE}`);
  console.log(`👤 Target: Dev333 (Folder: ${FOLDER_ID})`);
  console.log('===============================================================');

  await downloadBuffer();
  const filecode = await uploadToEarnVidsWithRetry();

  // Clean up buffer
  if (fs.existsSync(BUFFER_FILE)) {
    fs.unlinkSync(BUFFER_FILE);
    console.log('🧹 Cleaned up local buffer.');
  }

  // Trigger catalog sync
  console.log('\nStep 4: Running Multi-Account Catalog Sync...');
  execSync(`node "${path.join(__dirname, 'sync_multi_account_catalog.cjs')}"`, { stdio: 'inherit' });

  // Trigger site build
  console.log('\nStep 5: Building BollyHub Static Site...');
  execSync(`npx astro build`, { cwd: __dirname, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });

  // Git commit and push
  console.log('\nStep 6: Pushing update to GitHub...');
  execSync(`git add -A && git commit -m "feat: Add Ramayana Rise of a Legend 720p HDTC" && git push origin main`, { cwd: __dirname, stdio: 'inherit' });

  console.log('\n===============================================================');
  console.log('🎉 RAMAYANA IS NOW LIVE ON BOLLYHUB!');
  console.log('🌐 https://bollyhub.devendradubey61.workers.dev/');
  console.log('===============================================================');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
