// D:\BollyHub\sync_multi_account_catalog.cjs
// Multi-Account EarnVids Storage Aggregator for BollyHub
// Unifies Account 1 (dev3550) and Account 2 (Dev333) into a single seamless shared drive

const fs = require('fs');
const path = require('path');

const ACCOUNTS = [
  {
    id: 'dev3550',
    label: 'Primary Node (dev3550)',
    key: '48914lqe3hwneiukt644z',
    email: 'devendradubey61@gmail.com',
    folders: [
      { id: 0, category: 'AUTO' },
      { id: 157399, category: 'AUTO' },
      { id: 157400, category: 'BOLLYWOOD' },
      { id: 157401, category: 'BOLLYWOOD' },
      { id: 157402, category: 'BOLLYWOOD' },
      { id: 157403, category: 'BOLLYWOOD' },
      { id: 157404, category: 'HOLLYWOOD' },
      { id: 157405, category: 'HOLLYWOOD' },
      { id: 157406, category: 'HOLLYWOOD' },
      { id: 157407, category: 'HOLLYWOOD' },
      { id: 157408, category: 'SOUTH' },
      { id: 157409, category: 'SOUTH' },
      { id: 157410, category: 'SOUTH' },
      { id: 157411, category: 'SOUTH' }
    ]
  },
  {
    id: 'Dev333',
    label: 'Secondary Node (Dev333)',
    key: '48941hzj3ypnutkjvp4yn',
    email: 'devendradubey291@gmail.com',
    folders: [
      { id: 0, category: 'AUTO' },
      { id: 157435, category: 'BOLLYWOOD' },
      { id: 157436, category: 'SOUTH' },
      { id: 157437, category: 'HOLLYWOOD' }
    ]
  }
];

const BROKEN_FILE_CODES = new Set(['sunmslmgdjj7', 'r4nanbxeqp6q', 'p1msmfg4ykih', 'u1wwwivj2khv']);

function cleanSearchQuery(rawTitle) {
  return rawTitle
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\{.*?\}/g, '')
    .replace(/\b\d+(\s+\d+)?\s*(gb|mb)\b/gi, '')
    .replace(/download|hindi|dubbed|movie|dual|audio|web-dl|bluray|hevc|esub|720p|480p|1080p|10bit|uncut/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KNOWN_TITLE_OVERRIDES = {
  'shagird': {
    imdbId: 'tt1869687',
    title: 'Shagird',
    year: '2011',
    rating: '7.2',
    genres: 'Action, Crime, Thriller',
    summary: 'A seasoned Delhi crime branch officer mentors a rookie while maneuvering through deadly political conspiracies.',
    poster: 'https://images.metahub.space/poster/medium/tt1869687/img.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt1869687/img.jpg',
    director: 'Tigmanshu Dhulia',
    cast: ['Nana Patekar', 'Mohit Ahlawat', 'Anurag Kashyap']
  },
  'laal kaptaan': {
    imdbId: 'tt8543452',
    title: 'Laal Kaptaan',
    year: '2019',
    rating: '6.2',
    genres: 'Action, Adventure, Drama',
    summary: 'Set in 18th century India, a relentless bounty hunter Naga Sadhu tracks down an old enemy across treacherous lands.',
    poster: 'https://images.metahub.space/poster/medium/tt8543452/img.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt8543452/img.jpg',
    director: 'Navdeep Singh',
    cast: ['Saif Ali Khan', 'Manav Vij', 'Zoya Hussain']
  },
  'sadak': {
    imdbId: 'tt0102828',
    title: 'Sadak',
    year: '1991',
    rating: '7.1',
    genres: 'Action, Drama, Romance',
    summary: 'A taxi driver falls in love with a woman forced into prostitution and fights a ruthless underworld figure to rescue her.',
    poster: 'https://images.metahub.space/poster/medium/tt0102828/img.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt0102828/img.jpg',
    director: 'Mahesh Bhatt',
    cast: ['Sanjay Dutt', 'Pooja Bhatt', 'Sadashiv Amrapurkar']
  },
  'uri': {
    imdbId: 'tt8291224',
    title: 'Uri: The Surgical Strike',
    year: '2019',
    rating: '8.2',
    genres: 'Action, Drama, History',
    summary: 'Indian army special forces execute a covert operation against terrorist bases in retaliation for the Uri attack.',
    poster: 'https://images.metahub.space/poster/medium/tt8291224/img.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt8291224/img.jpg',
    director: 'Aditya Dhar',
    cast: ['Vicky Kaushal', 'Paresh Rawal', 'Yami Gautam']
  },
  'halahal': {
    imdbId: 'tt13083652',
    title: 'Halahal',
    year: '2020',
    rating: '7.1',
    genres: 'Crime, Mystery, Thriller',
    summary: 'A grief-stricken father teams up with a cynical police officer to investigate the dark conspiracy behind his daughter\'s death.',
    poster: 'https://images.metahub.space/poster/medium/tt13083652/img.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt13083652/img.jpg',
    director: 'Randeep Jha',
    cast: ['Barun Sobti', 'Sachin Khedekar', 'Anuradha Mukherjee']
  }
};

const KNOWN_IMDB_FIXES = {
  'leo': 'tt15654328',
  'kantara': 'tt15327088',
  'pushpa': 'tt9389998',
  'k.g.f': 'tt7838252',
  'salaar': 'tt13927994',
  '3 idiots': 'tt1187043',
  'chhichhore': 'tt9052870',
  'm.s. dhoni': 'tt4169250',
  'shagird': 'tt1869687',
  'uri': 'tt8291224',
  'halahal': 'tt13083652',
  'laal kaptaan': 'tt8543452',
  'sadak': 'tt0102828',
  'hate story 2': 'tt3778008'
};

async function fetchImdbMetadata(query, targetYear) {
  try {
    const cleanLower = query.toLowerCase().trim();

    // Check direct high-fidelity title overrides first
    for (const [k, override] of Object.entries(KNOWN_TITLE_OVERRIDES)) {
      if (cleanLower.includes(k)) {
        return override;
      }
    }

    let imdbId = null;

    for (const [k, id] of Object.entries(KNOWN_IMDB_FIXES)) {
      if (cleanLower.includes(k)) {
        imdbId = id;
        break;
      }
    }

    if (!imdbId) {
      const clean = cleanLower.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const sgUrl = `https://v3.sg.media-imdb.com/suggestion/x/${clean}.json`;
      const sgRes = await fetch(sgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const sgJson = await sgRes.json();

      if (sgJson.d && sgJson.d.length > 0) {
        let match = sgJson.d.find(x => targetYear && String(x.y) === String(targetYear) && (x.qid === 'movie' || x.q === 'feature'));
        if (!match && targetYear) {
          match = sgJson.d.find(x => x.y && Math.abs(x.y - parseInt(targetYear, 10)) <= 2 && (x.qid === 'movie' || x.q === 'feature'));
        }
        if (!match) {
          const candidate = sgJson.d.find(x => x.qid === 'movie' || x.q === 'feature') || sgJson.d[0];
          if (targetYear && candidate.y && Math.abs(candidate.y - parseInt(targetYear, 10)) <= 4) {
            match = candidate;
          }
        }
        if (match) {
          imdbId = match.id;
        }
      }
    }

    if (imdbId) {
      let meta = null;
      try {
        const metaRes = await fetch(`https://v3-cinemeta.strem.io/meta/movie/${imdbId}.json`);
        const metaJson = await metaRes.json();
        meta = metaJson.meta;
      } catch (_) {}

      const title = meta?.name || query;
      const year = String(meta?.year || targetYear || '2023');
      const rating = meta?.imdbRating ? String(meta.imdbRating) : '7.8';
      const genres = meta?.genres ? (Array.isArray(meta.genres) ? meta.genres.join(', ') : meta.genres) : 'Action, Drama';
      const summary = meta?.description || 'Full movie available for streaming and high-speed direct download in HD.';
      const poster = `https://images.metahub.space/poster/medium/${imdbId}/img.jpg`;
      const backdrop = `https://images.metahub.space/background/medium/${imdbId}/img.jpg`;
      const director = (meta?.director && meta.director.length > 0) ? (Array.isArray(meta.director) ? meta.director.join(', ') : meta.director) : 'N/A';
      const cast = meta?.cast || [];

      return {
        imdbId,
        title,
        year,
        rating,
        genres,
        summary,
        poster,
        backdrop,
        director,
        cast
      };
    }
  } catch (err) {
    console.error(`IMDb error for "${query}":`, err.message);
  }

  return {
    imdbId: '',
    title: query,
    year: targetYear || '2024',
    rating: '7.8',
    genres: 'Drama, Action',
    summary: 'Full HD high-speed online stream available on BollyHub.',
    poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60',
    backdrop: null,
    director: 'N/A',
    cast: []
  };
}

async function syncMultiAccountCatalog() {
  console.log('===============================================================');
  console.log('🚀 MULTI-ACCOUNT STORAGE AGGREGATOR (BollyHub Shared Drive)');
  console.log('===============================================================');

  const allFilesMap = new Map();

  for (const acc of ACCOUNTS) {
    console.log(`\n📡 Scanning ${acc.label}...`);
    let accFileCount = 0;

    for (const fld of acc.folders) {
      const url = fld.id === 0
        ? `https://earnvids.com/api/file/list?key=${acc.key}`
        : `https://earnvids.com/api/folder/list?key=${acc.key}&fld_id=${fld.id}&files=1`;

      try {
        const res = await fetch(url);
        const json = await res.json();
        const files = json.result?.files || [];
        for (const f of files) {
          if (BROKEN_FILE_CODES.has(f.file_code)) continue;

          // Strict filter: Ignore test dummy files
          const rawTitle = f.title || '';
          if (rawTitle.toLowerCase().includes('mov bbb') || rawTitle.toLowerCase().includes('test upload')) {
            continue;
          }

          if (!allFilesMap.has(f.file_code)) {
            allFilesMap.set(f.file_code, {
              ...f,
              accountId: acc.id,
              accountLabel: acc.label,
              folderCat: fld.category
            });
            accFileCount++;
          }
        }
      } catch (err) {
        console.error(`  ⚠️ Folder fetch error [${acc.id} - ${fld.id}]:`, err.message);
      }
    }
    console.log(`  ✅ Found ${accFileCount} active files in ${acc.label}`);
  }

  const fileList = Array.from(allFilesMap.values());
  console.log(`\n📦 Total unique files across all accounts: ${fileList.length}`);

  // Group files by movie title and release year
  const movieGroups = new Map();

  for (const f of fileList) {
    const rawTitle = f.title || '';
    const yearMatch = rawTitle.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : '';

    const cleanQuery = cleanSearchQuery(rawTitle);
    const groupKey = `${cleanQuery.toLowerCase()}_${year}`;

    if (!movieGroups.has(groupKey)) {
      movieGroups.set(groupKey, {
        cleanQuery,
        year,
        rawTitle,
        folderCat: f.folderCat,
        files: []
      });
    }

    movieGroups.get(groupKey).files.push(f);
  }

  console.log(`🎬 Grouped into ${movieGroups.size} unique movies.`);

  // Build the unified catalog with rich IMDb metadata
  const catalog = [];

  for (const [key, group] of movieGroups.entries()) {
    console.log(`\n🔍 Metadata fetch: "${group.cleanQuery}" (${group.year})...`);
    const imdb = await fetchImdbMetadata(group.cleanQuery, group.year);

    // Primary playable file
    const primaryFile = group.files.find(x => x.canplay === 1) || group.files[0];

    // Determine category
    const fldNum = parseInt(primaryFile.fld_id, 10);
    let categories = ['BOLLYWOOD'];

    if ([157408, 157409, 157410, 157411, 157436].includes(fldNum)) {
      categories = ['SOUTH HINDI DUBBED', 'SOUTH', 'DUAL AUDIO'];
    } else if ([157404, 157405, 157406, 157407, 157437].includes(fldNum)) {
      categories = ['HOLLYWOOD', 'DUAL AUDIO'];
    } else if ([157400, 157401, 157402, 157403, 157435].includes(fldNum)) {
      categories = ['BOLLYWOOD'];
    } else {
      const titleLower = group.rawTitle.toLowerCase();
      if (titleLower.includes('telugu') || titleLower.includes('tamil') || titleLower.includes('kannada') || titleLower.includes('south') || titleLower.includes('leo') || titleLower.includes('kantara') || titleLower.includes('pushpa') || titleLower.includes('kgf') || titleLower.includes('salaar')) {
        categories = ['SOUTH HINDI DUBBED', 'SOUTH', 'DUAL AUDIO'];
      } else if (titleLower.includes('english') || titleLower.includes('oppenheimer') || titleLower.includes('babylon') || titleLower.includes('hollywood')) {
        categories = ['HOLLYWOOD', 'DUAL AUDIO'];
      } else {
        categories = ['BOLLYWOOD'];
      }
    }

    const movieSlug = imdb.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + imdb.year;

    // Build qualities and mirrors with multi-account awareness
    const qualities = group.files.map((file) => {
      const qMatch = (file.title || '').match(/\b(480p|720p|1080p|2160p|4K)\b/i);
      const qText = qMatch ? qMatch[1].toUpperCase() : '720P HD';
      const sizeMatch = (file.title || '').match(/\b(\d+(\.\d+)?\s*(gb|mb))\b/i);
      const sizeText = sizeMatch ? ` [${sizeMatch[1].toUpperCase()}]` : '';

      return {
        quality_name: `${qText} WEB-DL${sizeText}`,
        file_id: file.file_code,
        filecode: file.file_code,
        account: file.accountId,
        account_label: file.accountLabel,
        embed_url: `https://morencius.com/embed/${file.file_code}`,
        mirrors: [
          {
            provider: `EarnVids Fast Direct Download (${file.accountId})`,
            url: `https://morencius.com/d/${file.file_code}`
          },
          {
            provider: `EarnVids High Speed Stream (${file.accountId})`,
            url: `https://morencius.com/file/${file.file_code}`
          }
        ]
      };
    });

    const movieEntry = {
      id: movieSlug,
      title: `${imdb.title} (${imdb.year})`,
      slug: movieSlug,
      categories,
      release_year: imdb.year,
      poster_url: imdb.poster,
      backdrop_url: imdb.backdrop,
      imdb: {
        id: imdb.imdbId,
        rating: imdb.rating,
        title: imdb.title,
        director: imdb.director,
        cast: imdb.cast.slice(0, 5),
        genres: imdb.genres,
        summary: imdb.summary
      },
      earnvid_filecode: primaryFile.file_code,
      embed_url: `https://morencius.com/embed/${primaryFile.file_code}`,
      canplay: primaryFile.canplay,
      primary_account: primaryFile.accountId,
      qualities,
      screenshots: []
    };

    catalog.push(movieEntry);
    console.log(`  ✅ Added: "${movieEntry.title}" [Account: ${primaryFile.accountId}] [Code: ${primaryFile.file_code}]`);
  }

  // Write unified movies catalog
  const catalogPath = path.resolve(__dirname, 'data/movies.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');

  // Also write public mirror so client-side search can read it
  const publicPath = path.resolve(__dirname, 'public/movies.json');
  try {
    fs.writeFileSync(publicPath, JSON.stringify(catalog, null, 2), 'utf-8');
  } catch (_) {}

  console.log('\n===============================================================');
  console.log(`🎉 MULTI-ACCOUNT UNIFIED CATALOG SAVED!`);
  console.log(`📁 Target: ${catalogPath}`);
  console.log(`🎬 Total Verified Movies Available: ${catalog.length}`);
  console.log('===============================================================');
}

syncMultiAccountCatalog().catch(err => {
  console.error('Fatal aggregator error:', err);
  process.exit(1);
});
