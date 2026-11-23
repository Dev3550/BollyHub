// D:\BollyHub\bollyflix_bulk_pipeline.cjs
// Automated BollyFlix Category & Quality Extractor & LuluStream Uploader

const fs = require('fs');
const path = require('path');
const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

const LULU_KEY = '351753b6x5xkpcevzzblno';

// Folder Mapping on LuluStream
const FOLDER_MAP = {
  'Bollywood': {
    parent: 115891,
    '480p': 115894,
    '720p': 115895,
    '1080p': 115896
  },
  'Hollywood': {
    parent: 115892,
    '480p': 115897,
    '720p': 115898,
    '1080p': 115899
  },
  'South Hindi Dubbed': {
    parent: 115893,
    '480p': 115900,
    '720p': 115901,
    '1080p': 115902
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

async function runPipeline() {
  console.log('===============================================================');
  console.log('🚀 BollyFlix Category & Quality Pipeline Initialized');
  console.log('📁 Target LuluStream Account: Dev3550');
  console.log('===============================================================');

  const moviesPath = path.join(__dirname, 'data', 'movies.json');
  if (!fs.existsSync(moviesPath)) {
    console.error('Movies database not found at:', moviesPath);
    return;
  }

  console.log('Reading movies database (103 MB)...');
  const movies = JSON.parse(fs.readFileSync(moviesPath, 'utf8'));
  console.log(`Loaded ${movies.length} total titles.`);

  // 1. Group movies by category
  const categories = {
    'Bollywood': [],
    'Hollywood': [],
    'South Hindi Dubbed': []
  };

  for (const m of movies) {
    if (!m.qualities || m.qualities.length === 0) continue;
    const cats = m.categories || [];
    
    if (cats.includes('BOLLYWOOD')) {
      categories['Bollywood'].push(m);
    } else if (cats.includes('HOLLYWOOD')) {
      categories['Hollywood'].push(m);
    } else if (cats.includes('SOUTH HINDI DUBBED')) {
      categories['South Hindi Dubbed'].push(m);
    }
  }

  console.log(`\nFiltered Movies by Target Categories:`);
  console.log(`- Bollywood: ${categories['Bollywood'].length} titles`);
  console.log(`- Hollywood: ${categories['Hollywood'].length} titles`);
  console.log(`- South Hindi Dubbed: ${categories['South Hindi Dubbed'].length} titles`);

  // 2. Extract quality download links
  const structuredData = {};

  for (const [catName, catMovies] of Object.entries(categories)) {
    structuredData[catName] = {
      count: catMovies.length,
      qualities: {
        '480p': [],
        '720p': [],
        '1080p': []
      }
    };

    for (const m of catMovies) {
      for (const q of m.qualities) {
        const qName = (q.quality_name || '').toLowerCase();
        let targetQ = null;
        if (qName.includes('480p')) targetQ = '480p';
        else if (qName.includes('720p')) targetQ = '720p';
        else if (qName.includes('1080p')) targetQ = '1080p';

        if (targetQ) {
          structuredData[catName].qualities[targetQ].push({
            movieId: m.id,
            title: m.title,
            year: m.release_year,
            qualityName: q.quality_name,
            fastdlUrl: q.fastdl_url,
            fastdlPagesUrl: q.fastdl_pages_url,
            gdflixUrl: q.gdflix_url,
            mirrors: q.mirrors || [],
            luluFolderId: FOLDER_MAP[catName][targetQ]
          });
        }
      }
    }

    console.log(`\nCategory [${catName}] Quality breakdown:`);
    console.log(`  480p:  ${structuredData[catName].qualities['480p'].length} links`);
    console.log(`  720p:  ${structuredData[catName].qualities['720p'].length} links`);
    console.log(`  1080p: ${structuredData[catName].qualities['1080p'].length} links`);
  }

  // 3. Save Structured Export
  const exportPath = path.join(__dirname, 'data', 'bollyflix_categorized_download_links.json');
  fs.writeFileSync(exportPath, JSON.stringify(structuredData, null, 2), 'utf8');
  console.log(`\n✅ Structured download links saved to: ${exportPath}`);

  // 4. Test resolving and pushing first 5 links to verify
  console.log('\n--- Test Resolving First 3 Bollywood 720p Links ---');
  const testBatch = structuredData['Bollywood'].qualities['720p'].slice(0, 3);
  for (const item of testBatch) {
    console.log(`Resolving: ${item.title} (${item.qualityName})`);
    const directUrl = await resolveDirectGoogleCdnUrl(item.fastdlUrl);
    if (directUrl) {
      console.log(`  -> Direct Link: ${directUrl.substring(0, 80)}...`);
      item.resolvedDirectGoogleUrl = directUrl;

      // Remote upload to LuluStream folder
      const pushUrl = `https://lulustream.com/api/upload/url?key=${LULU_KEY}&url=${encodeURIComponent(directUrl)}&fld_id=${item.luluFolderId}`;
      const pushRes = await fetch(pushUrl);
      const pushJson = await pushRes.json();
      console.log(`  -> LuluStream Push Response:`, pushJson);
    } else {
      console.log(`  -> Could not resolve direct link`);
    }
  }
}

runPipeline().catch(console.error);
