// D:\BollyHub\batch_dual_account_uploader.cjs
// Automated Dual-Account Sequential Uploader for BollyHub
// Balances fresh blockbuster uploads across Account 1 (dev3550) and Account 2 (Dev333)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

const ACCOUNTS = {
  dev3550: {
    key: '48914lqe3hwneiukt644z',
    fldId: '157400' // Bollywood
  },
  Dev333: {
    key: '48941hzj3ypnutkjvp4yn',
    fldId: '157435' // Bollywood
  }
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
        $('a').each((_, el) => {
          const txt = $(el).text().trim();
          const href = $(el).attr('href');
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
            } catch (_) { return dlLoc; }
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

async function uploadMovie(item, index, total) {
  console.log(`\n===============================================================`);
  console.log(`🎬 [${index}/${total}] Starting: ${item.title} [720p]`);
  console.log(`👤 Target Account: ${item.account} (Folder: ${item.fldId})`);
  console.log(`===============================================================`);

  console.log('Step 1: Resolving direct Google CDN download link...');
  const directUrl = await resolveDirect(item.fastdlUrl);
  if (!directUrl) {
    console.error(`  ❌ Failed to resolve link for ${item.title}`);
    return null;
  }
  console.log(`  ✅ Direct link acquired!`);

  const tempFile = path.join(__dirname, `temp_upload_${Date.now()}.mp4`);
  console.log(`Step 2: Downloading video to local buffer...`);
  const dlRes = await fetch(directUrl);
  if (!dlRes.ok) {
    console.error(`  ❌ CDN error: ${dlRes.status}`);
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
      console.log(`  ⬇️ Progress: ${pct}% (${(downloaded / (1024 * 1024)).toFixed(1)} MB)`);
      lastReport = pct;
    }
  }
  await new Promise(r => fileStream.end(r));
  console.log(`  ✅ Download verified: ${(fs.statSync(tempFile).size / (1024 * 1024)).toFixed(1)} MB`);

  try {
    const filename = `${item.title} [720p].mp4`;
    const acc = ACCOUNTS[item.account];

    console.log(`Step 3: Uploading buffer via high-performance curl stream...`);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const sRes = await (await fetch(`https://earnvids.com/api/upload/server?key=${acc.key}`)).json();
        const uploadUrl = sRes.result;
        console.log(`  🌐 Upload Server: ${uploadUrl}`);

        const curlCmd = `curl.exe -s --connect-timeout 60 --max-time 1800 -F "key=${acc.key}" -F "fld_id=${item.fldId}" -F "file=@${tempFile};filename=${filename}" "${uploadUrl}"`;
        const output = execSync(curlCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        console.log(`  📥 Server Response:`, output.trim());

        let json;
        try {
          json = JSON.parse(output);
        } catch (_) {
          const match = output.match(/\{[\s\S]*\}/);
          if (match) json = JSON.parse(match[0]);
        }

        if (json && json.files && json.files[0]?.status === 'OK') {
          const filecode = json.files[0].filecode;
          console.log(`\n🎉 SUCCESS! Uploaded [${index}/${total}] to ${item.account}!`);
          console.log(`   Filecode: ${filecode}`);
          console.log(`   Player: https://morencius.com/e/${filecode}`);
          return { ...item, filecode };
        }
      } catch (err) {
        console.warn(`  ⚠️ Attempt ${attempt} error:`, err.message);
      }
      console.log('Waiting 6 seconds before retrying...');
      await new Promise(r => setTimeout(r, 6000));
    }
    return null;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log('  🧹 Cleaned up local buffer.');
    }
  }
}

async function run() {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'bollyflix_categorized_download_links.json'), 'utf8'));
  const bList = d['Bollywood'].qualities['720p'] || [];

  const targets = [
    // Account 1 (dev3550)
    {
      title: 'Section 375 (2019)',
      account: 'dev3550',
      fldId: ACCOUNTS.dev3550.fldId,
      fastdlUrl: bList[22].fastdlUrl
    },
    {
      title: 'Marjaavaan (2019)',
      account: 'dev3550',
      fldId: ACCOUNTS.dev3550.fldId,
      fastdlUrl: bList[26].fastdlUrl
    },
    // Account 2 (Dev333)
    {
      title: 'Made in China (2019)',
      account: 'Dev333',
      fldId: ACCOUNTS.Dev333.fldId,
      fastdlUrl: bList[28].fastdlUrl
    },
    {
      title: 'Ujda Chaman (2019)',
      account: 'Dev333',
      fldId: ACCOUNTS.Dev333.fldId,
      fastdlUrl: bList[23].fastdlUrl
    }
  ];

  console.log(`===============================================================`);
  console.log(`🚀 DUAL ACCOUNT UPLOADER: Starting ${targets.length} Blockbusters`);
  console.log(`===============================================================`);

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const res = await uploadMovie(targets[i], i + 1, targets.length);
    if (res) results.push(res);
    console.log(`Waiting 5 seconds before next movie...`);
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('\n===============================================================');
  console.log(`🎉 UPLOAD SUMMARY: ${results.length}/${targets.length} Uploaded!`);
  console.log('===============================================================');

  // Sync catalog & rebuild
  console.log('\nSyncing multi-account catalog...');
  execSync(`node sync_multi_account_catalog.cjs`, { cwd: __dirname, stdio: 'inherit' });

  console.log('\nRebuilding BollyHub...');
  execSync(`npx astro build`, { cwd: __dirname, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });

  console.log('\nPushing changes to GitHub...');
  execSync(`git add -A && git commit -m "feat: Add Section 375, Marjaavaan, Made in China, Ujda Chaman" && git push origin main`, { cwd: __dirname, stdio: 'inherit' });

  console.log('\n✅ All new movies are live on BollyHub!');
}

run().catch(console.error);
