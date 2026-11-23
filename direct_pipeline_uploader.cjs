const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

const EARNVIDS_KEY = '48914lqe3hwneiukt644z';

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function resolveDirect(startUrl) {
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
      let foundLink = '';
      $('a').each((_, a) => {
        const txt = $(a).text().trim();
        const href = $(a).attr('href');
        if (href && (txt.includes('Instant DL') || href.includes('instadl.rest') || href.includes('googleusercontent.com'))) {
          foundLink = href;
        }
      });

      if (!foundLink) return null;
      if (foundLink.includes('googleusercontent.com')) return foundLink;

      const dlRes = await fetch(foundLink, {
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
  return null;
}

async function uploadOneMovie(movie) {
  console.log(`\n===============================================================`);
  console.log(`🎬 Processing: ${movie.title}`);
  console.log(`📁 Target Folder: ${movie.fldId}`);
  console.log(`===============================================================`);

  console.log(`Step 1: Resolving direct Google CDN download link...`);
  const directUrl = await resolveDirect(movie.fastdlUrl);
  if (!directUrl) {
    throw new Error(`Failed to resolve direct download link for ${movie.title}`);
  }
  console.log(`  ✅ Direct link acquired!`);

  const tempFilePath = path.join(__dirname, `temp_upload_${Date.now()}.mp4`);
  console.log(`Step 2: Downloading video to local high-speed buffer...`);
  const dlRes = await fetch(directUrl);
  if (!dlRes.ok) throw new Error(`Google CDN HTTP error: ${dlRes.status}`);

  const totalBytes = parseInt(dlRes.headers.get('content-length') || '0', 10);
  console.log(`  📦 Total file size: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`);

  const fileStream = fs.createWriteStream(tempFilePath);
  let downloadedBytes = 0;
  let lastReport = 0;

  const reader = dlRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(value);
    downloadedBytes += value.length;
    const pct = totalBytes ? Math.floor((downloadedBytes / totalBytes) * 100) : 0;
    if (pct >= lastReport + 25) {
      console.log(`  ⬇️ Downloaded: ${pct}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB)`);
      lastReport = pct;
    }
  }
  await new Promise(r => fileStream.end(r));
  console.log(`  ✅ Download complete! Verified on disk: ${(fs.statSync(tempFilePath).size / (1024 * 1024)).toFixed(1)} MB`);

  try {
    console.log(`Step 3: Fetching active EarnVids upload node...`);
    const sRes = await (await fetch(`https://earnvids.com/api/upload/server?key=${EARNVIDS_KEY}`)).json();
    const uploadUrl = sRes.result;
    console.log(`  🌐 Upload Server: ${uploadUrl}`);

    console.log(`Step 4: Uploading video directly to EarnVids CDN...`);
    const blob = await fs.openAsBlob(tempFilePath);
    const filename = `${movie.cleanTitle}.mp4`;

    const form = new FormData();
    form.append('key', EARNVIDS_KEY);
    form.append('fld_id', movie.fldId.toString());
    form.append('file', blob, filename);

    const upRes = await fetch(uploadUrl, {
      method: 'POST',
      body: form
    });

    const upJson = await upRes.json();
    console.log(`  📥 EarnVids Server Response:`, upJson);

    if (upJson.status === 200 && upJson.files && upJson.files.length > 0) {
      const fileInfo = upJson.files[0];
      if (fileInfo.status === 'OK' && fileInfo.filecode) {
        const filecode = fileInfo.filecode;
        console.log(`\n🎉 SUCCESS! Uploaded to EarnVids!`);
        console.log(`   Filecode: ${filecode}`);
        console.log(`   Embed Player: https://morencius.com/e/${filecode}`);
        console.log(`   EarnVids Watch: https://earnvids.com/e/${filecode}`);
        return {
          title: movie.title,
          cleanTitle: movie.cleanTitle,
          filecode: filecode,
          embedUrl: `https://morencius.com/e/${filecode}`
        };
      } else {
        throw new Error(`EarnVids rejected file: ${fileInfo.status}`);
      }
    } else {
      throw new Error(`Upload failed: ${JSON.stringify(upJson)}`);
    }
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`  🧹 Cleaned up temporary buffer.`);
    }
  }
}

async function run() {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'bollyflix_categorized_download_links.json'), 'utf8'));

  // Let's upload 2 movies: Shagird (2011) and Uri The Surgical Strike (2019)
  const movies = [
    {
      title: 'Shagird (2011)',
      cleanTitle: 'Shagird (2011) [720p]',
      fastdlUrl: d['Bollywood'].qualities['720p'][7].fastdlUrl,
      fldId: 157402
    },
    {
      title: 'Uri: The Surgical Strike (2019)',
      cleanTitle: 'Uri The Surgical Strike (2019) [720p]',
      fastdlUrl: d['Bollywood'].qualities['720p'][8].fastdlUrl,
      fldId: 157402
    }
  ];

  const uploaded = [];
  for (const m of movies) {
    try {
      const res = await uploadOneMovie(m);
      uploaded.push(res);
    } catch (e) {
      console.error(`❌ Error uploading ${m.title}:`, e.message);
    }
  }

  console.log(`\n===============================================================`);
  console.log(`🎉 COMPLETED BATCH SUMMARY (${uploaded.length}/2):`);
  for (const u of uploaded) {
    console.log(`🎬 ${u.title}`);
    console.log(`   Embed: ${u.embedUrl}`);
  }
  console.log(`===============================================================`);
}

run().catch(console.error);
