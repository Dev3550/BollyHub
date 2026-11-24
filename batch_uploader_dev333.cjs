const fs = require('fs');
const path = require('path');
const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

const API_KEY = '48941hzj3ypnutkjvp4yn'; // Dev333 Account

const FOLDERS = {
  Bollywood: '157435',
  South: '157436',
  Hollywood: '157437'
};

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

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

async function uploadSingleMovie(movie, index, total) {
  console.log(`\n===============================================================`);
  console.log(`🎬 [${index}/${total}] Starting: ${movie.title} [720p]`);
  console.log(`📁 Target Category: ${movie.category} (Folder: ${movie.fldId})`);
  console.log(`===============================================================`);

  console.log('Step 1: Resolving direct CDN download link...');
  const directUrl = await resolveDirect(movie.fastdlUrl);
  if (!directUrl) {
    console.log(`  ❌ Failed to resolve link for ${movie.title}, skipping.`);
    return null;
  }
  console.log(`  ✅ Direct link acquired!`);

  const tempFile = path.join(__dirname, `temp_upload_${Date.now()}.mp4`);
  console.log(`Step 2: Downloading video to high-speed local buffer...`);
  const dlRes = await fetch(directUrl);
  if (!dlRes.ok) {
    console.log(`  ❌ CDN error: ${dlRes.status}`);
    return null;
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
    if (pct >= lastReport + 25) {
      console.log(`  ⬇️ Downloaded: ${pct}% (${(downloaded / (1024 * 1024)).toFixed(1)} MB)`);
      lastReport = pct;
    }
  }
  await new Promise(r => fileStream.end(r));
  console.log(`  ✅ Buffer verified on disk: ${(fs.statSync(tempFile).size / (1024 * 1024)).toFixed(1)} MB`);

  try {
    console.log(`Step 3: Getting active EarnVids upload node...`);
    const sRes = await (await fetch(`https://earnvids.com/api/upload/server?key=${API_KEY}`)).json();
    const uploadUrl = sRes.result;

    console.log(`Step 4: Uploading directly to EarnVids CDN node...`);
    const blob = await fs.openAsBlob(tempFile);
    const form = new FormData();
    form.append('key', API_KEY);
    form.append('fld_id', movie.fldId);
    form.append('file', blob, `${movie.cleanTitle}.mp4`);

    const upRes = await fetch(uploadUrl, { method: 'POST', body: form });
    const upJson = await upRes.json();
    console.log(`  📥 EarnVids Server Response:`, upJson);

    if (upJson.files && upJson.files[0]?.status === 'OK') {
      const filecode = upJson.files[0].filecode;
      console.log(`\n🎉 SUCCESS! Uploaded [${index}/${total}] to Dev333!`);
      console.log(`   Filecode: ${filecode}`);
      console.log(`   Player: https://morencius.com/e/${filecode}`);

      return {
        title: movie.cleanTitle,
        category: movie.category,
        filecode,
        embedUrl: `https://morencius.com/e/${filecode}`,
        uploadedAt: new Date().toISOString()
      };
    } else {
      console.log(`  ⚠️ Upload rejected:`, upJson);
      return null;
    }
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log('  🧹 Cleaned up local buffer.');
    }
  }
}

async function run() {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'bollyflix_categorized_download_links.json'), 'utf8'));

  // Target 20 high-demand movies in 720p
  const targets = [];

  // Bollywood 720p
  const bList = d['Bollywood'].qualities['720p'] || [];
  const bItems = [
    { idx: 7, title: 'Shagird (2011)' },
    { idx: 8, title: 'Uri The Surgical Strike (2019)' },
    { idx: 9, title: 'Laal Kaptaan (2019)' },
    { idx: 10, title: 'Sadak (1991)' },
    { idx: 11, title: 'The Sky Is Pink (2019)' },
    { idx: 12, title: 'Dream Girl (2019)' },
    { idx: 14, title: 'Batla House (2019)' },
    { idx: 17, title: 'Bhaiaji Superhit (2018)' },
    { idx: 19, title: 'Housefull 4 (2019)' }
  ];
  for (const b of bItems) {
    if (bList[b.idx]) {
      targets.push({
        title: b.title,
        cleanTitle: `${b.title} [720p]`,
        category: 'BOLLYWOOD',
        fldId: FOLDERS.Bollywood,
        fastdlUrl: bList[b.idx].fastdlUrl
      });
    }
  }

  // South Hindi Dubbed 720p (including Ramayana)
  const sList = d['South Hindi Dubbed'].qualities['720p'] || [];
  const sItems = [
    { title: 'Ramayana: Rise of a Legend (2026)', item: sList.find(m => m.title.includes('Ramayana')) },
    { idx: 1, title: 'Anbil Avan (2026)' },
    { idx: 3, title: '#Cult (2026)' },
    { idx: 5, title: 'Bhoomi (2021)' },
    { idx: 7, title: 'Enemy (2021)' },
    { idx: 9, title: 'Don (2022)' },
    { idx: 11, title: 'Beast (2022)' }
  ];
  for (const s of sItems) {
    const it = s.item || sList[s.idx];
    if (it) {
      targets.push({
        title: s.title,
        cleanTitle: `${s.title} [720p]`,
        category: 'SOUTH HINDI DUBBED',
        fldId: FOLDERS.South,
        fastdlUrl: it.fastdlUrl
      });
    }
  }

  // Hollywood 720p
  const hList = d['Hollywood'].qualities['720p'] || [];
  const hItems = [
    { idx: 2, title: 'Interstellar (2014)' },
    { idx: 4, title: 'Inception (2010)' },
    { idx: 6, title: 'The Dark Knight (2008)' },
    { idx: 8, title: 'Gladiator (2000)' }
  ];
  for (const h of hItems) {
    if (hList[h.idx]) {
      targets.push({
        title: h.title,
        cleanTitle: `${h.title} [720p]`,
        category: 'HOLLYWOOD',
        fldId: FOLDERS.Hollywood,
        fastdlUrl: hList[h.idx].fastdlUrl
      });
    }
  }

  console.log(`===============================================================`);
  console.log(`🚀 BATCH UPLOADER: Queueing ${targets.length} Verified 720p Movies to Dev333`);
  console.log(`👤 Target Account: Dev333 (API: ${API_KEY})`);
  console.log(`===============================================================`);

  const results = [];
  const checkpointPath = path.join(__dirname, 'data', 'dev333_uploaded_movies.json');

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      const res = await uploadSingleMovie(t, i + 1, targets.length);
      if (res) {
        results.push(res);
        fs.writeFileSync(checkpointPath, JSON.stringify(results, null, 2));
      }
    } catch (e) {
      console.error(`❌ Error on ${t.title}:`, e.message);
    }
    console.log(`Waiting 4 seconds before next movie...`);
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log(`\n===============================================================`);
  console.log(`🎉 ALL DONE! Uploaded ${results.length}/${targets.length} Movies to Dev333!`);
  console.log(`===============================================================`);
  for (const r of results) {
    console.log(`🎬 ${r.title} -> ${r.embedUrl}`);
  }
}

run().catch(console.error);
