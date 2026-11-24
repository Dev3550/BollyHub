const fs = require('fs');
const path = require('path');
const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

const API_KEY = '48941hzj3ypnutkjvp4yn'; // Dev333
const FOLDER_ID = '157436'; // South Hindi Dubbed folder on Dev333

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const RAMAYANA_FASTDL = 'https://dl.fastdlserver.site/?id=dXFtbS9IK1EzdnpleUh2N00rNXdheXlVT25WSEFUd0daM3lzMVhoUUpaV2FYOFZ5VUhQZkd0RlFPcFNkQVRNWg==&type=file';
const MOVIE_TITLE = 'Ramayana Rise Of A Legend (2026) [720p]';

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

async function uploadRamayana() {
  console.log('===============================================================');
  console.log(`🎬 UPLOADING: ${MOVIE_TITLE}`);
  console.log(`👤 Target: Dev333 (Folder: ${FOLDER_ID})`);
  console.log('===============================================================');

  console.log('Step 1: Resolving working direct Google CDN link...');
  const directUrl = await resolveDirect(RAMAYANA_FASTDL);
  if (!directUrl) {
    console.error('❌ Failed to resolve direct CDN link.');
    process.exit(1);
  }
  console.log(`  ✅ Direct link: ${directUrl.slice(0, 70)}...`);

  const tempFile = path.join(__dirname, `temp_ramayana_${Date.now()}.mp4`);
  console.log('Step 2: Downloading video to local buffer...');
  const dlRes = await fetch(directUrl);
  if (!dlRes.ok) {
    console.error(`❌ Download failed with status ${dlRes.status}`);
    process.exit(1);
  }

  const totalBytes = parseInt(dlRes.headers.get('content-length') || '0', 10);
  console.log(`  📦 Total size: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`);

  const fileStream = fs.createWriteStream(tempFile);
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
  console.log(`  ✅ Download complete: ${(fs.statSync(tempFile).size / (1024 * 1024)).toFixed(1)} MB`);

  try {
    console.log('Step 3: Getting active EarnVids upload node...');
    const sRes = await (await fetch(`https://earnvids.com/api/upload/server?key=${API_KEY}`)).json();
    const uploadUrl = sRes.result;
    console.log(`  🌐 Upload Server: ${uploadUrl}`);

    console.log('Step 4: Uploading directly to EarnVids CDN node...');
    const blob = await fs.openAsBlob(tempFile);
    const form = new FormData();
    form.append('key', API_KEY);
    form.append('fld_id', FOLDER_ID);
    form.append('file', blob, `${MOVIE_TITLE}.mp4`);

    const upRes = await fetch(uploadUrl, { method: 'POST', body: form });
    const upJson = await upRes.json();
    console.log('  📥 Server Response:', upJson);

    if (upJson.files && upJson.files[0]?.status === 'OK') {
      const filecode = upJson.files[0].filecode;
      console.log('\n🎉 RAMAYANA UPLOAD SUCCESSFUL!');
      console.log(`   Filecode: ${filecode}`);
      console.log(`   Player URL: https://morencius.com/e/${filecode}`);
      return filecode;
    } else {
      console.error('❌ Upload was not accepted:', upJson);
      process.exit(1);
    }
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log('  🧹 Cleaned up temporary buffer.');
    }
  }
}

uploadRamayana().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
