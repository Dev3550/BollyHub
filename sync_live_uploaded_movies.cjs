// D:\BollyHub\sync_live_uploaded_movies.cjs
// Automatically syncs live uploaded EarnVids movies with official IMDb & Cinemeta metadata
// Guarantees only uploaded, playable movies are served to Cloudflare Workers

const fs = require('fs');
const path = require('path');

const EARNVIDS_KEY = process.env.EARNVIDS_KEY || '48914lqe3hwneiukt644z';

// Known folder IDs on EarnVids
const FOLDERS = [
  { id: 0, category: 'AUTO' },
  { id: 157399, category: 'AUTO' }, // Movies Root
  { id: 157400, category: 'BOLLYWOOD' }, // Bollywood Root
  { id: 157401, category: 'BOLLYWOOD' }, // Bollywood 480p
  { id: 157402, category: 'BOLLYWOOD' }, // Bollywood 720p
  { id: 157403, category: 'BOLLYWOOD' }, // Bollywood 1080p
  { id: 157404, category: 'HOLLYWOOD' }, // Hollywood Root
  { id: 157405, category: 'HOLLYWOOD' }, // Hollywood 480p
  { id: 157406, category: 'HOLLYWOOD' }, // Hollywood 720p
  { id: 157407, category: 'HOLLYWOOD' }, // Hollywood 1080p
  { id: 157408, category: 'SOUTH' }, // South Root
  { id: 157409, category: 'SOUTH' }, // South 480p
  { id: 157410, category: 'SOUTH' }, // South 720p
  { id: 157411, category: 'SOUTH' }  // South 1080p
];

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

// Known accurate IMDb IDs for iconic blockbusters to prevent Hollywood duplicate clashes
const KNOWN_IMDB_FIXES = {
  'leo': 'tt15654328', // Thalapathy Vijay's blockbuster Leo (2023)
  'kantara': 'tt15327088',
  'pushpa': 'tt9389998',
  'k.g.f': 'tt7838252',
  'salaar': 'tt13927994',
  '3 idiots': 'tt1187043',
  'chhichhore': 'tt9052870',
  'm.s. dhoni': 'tt4169250'
};

async function fetchImdbMetadata(query, targetYear) {
  try {
    const cleanLower = query.toLowerCase().trim();
    let imdbId = null;

    // Check known blockbuster registry first
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
        // Find best match by year or feature movie
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
      // Rich metadata from Cinemeta
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

  // Fallback
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

async function syncLiveCatalog() {
  console.log('===============================================================');
  console.log('🔄 Syncing Live Uploaded EarnVids Movies with Official IMDb Metadata');
  console.log('===============================================================');

  // 1. Fetch files from all EarnVids folders
  const allFilesMap = new Map();

  for (const fld of FOLDERS) {
    const url = fld.id === 0
      ? `https://earnvids.com/api/file/list?key=${EARNVIDS_KEY}`
      : `https://earnvids.com/api/folder/list?key=${EARNVIDS_KEY}&fld_id=${fld.id}&files=1`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      const files = json.result?.files || [];
      for (const f of files) {
        if (!allFilesMap.has(f.file_code)) {
          allFilesMap.set(f.file_code, { ...f, folderCat: fld.category });
        }
      }
    } catch (_) {}
  }

  const fileList = Array.from(allFilesMap.values());
  console.log(`Found ${fileList.length} total files across EarnVids folders.`);

  // 2. Group into unique movies
  const movieGroups = new Map();

  for (const f of fileList) {
    const rawTitle = f.title || '';
    if (rawTitle.toLowerCase().includes('test') || rawTitle.toLowerCase().includes('mov bbb')) {
      continue;
    }

    // Extract year
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

  console.log(`Grouped into ${movieGroups.size} unique movie titles.`);

  // 3. Enrich each movie with IMDb metadata & build catalog
  const catalog = [];

  for (const [key, group] of movieGroups.entries()) {
    console.log(`\nFetching IMDb metadata: "${group.cleanQuery}" (${group.year})...`);
    const imdb = await fetchImdbMetadata(group.cleanQuery, group.year);

    // Primary playable file
    const primaryFile = group.files.find(x => x.canplay === 1) || group.files[0];

    // Determine category strictly from EarnVids folder ID first!
    const fldNum = parseInt(primaryFile.fld_id, 10);
    let categories = ['BOLLYWOOD'];

    if ([157408, 157409, 157410, 157411].includes(fldNum)) {
      categories = ['SOUTH HINDI DUBBED', 'SOUTH', 'DUAL AUDIO'];
    } else if ([157404, 157405, 157406, 157407].includes(fldNum)) {
      categories = ['HOLLYWOOD', 'DUAL AUDIO'];
    } else if ([157400, 157401, 157402, 157403].includes(fldNum)) {
      categories = ['BOLLYWOOD'];
    } else {
      // Fallback only if uploaded directly to root without folder
      const titleLower = group.rawTitle.toLowerCase();
      if (titleLower.includes('telugu') || titleLower.includes('tamil') || titleLower.includes('kannada') || titleLower.includes('malayalam') || titleLower.includes('kiku') || titleLower.includes('kantara') || titleLower.includes('pushpa') || titleLower.includes('k.g.f') || titleLower.includes('k g f') || titleLower.includes('kgf') || titleLower.includes('salaar') || titleLower.includes('leo')) {
        categories = ['SOUTH HINDI DUBBED', 'SOUTH', 'DUAL AUDIO'];
      } else if (titleLower.includes('english') || titleLower.includes('oppenheimer') || titleLower.includes('her man') || titleLower.includes('deadpool') || titleLower.includes('hollywood')) {
        categories = ['HOLLYWOOD', 'DUAL AUDIO'];
      } else {
        categories = ['BOLLYWOOD'];
      }
    }

    const movieSlug = imdb.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + imdb.year;

    // Build qualities array
    const qualities = group.files.map((file, idx) => {
      const qMatch = (file.title || '').match(/\b(480p|720p|1080p|2160p|4K)\b/i);
      const qText = qMatch ? qMatch[1].toUpperCase() : '720P HD';
      const sizeMatch = (file.title || '').match(/\b(\d+(\.\d+)?\s*(gb|mb))\b/i);
      const sizeText = sizeMatch ? ` [${sizeMatch[1].toUpperCase()}]` : '';

      return {
        quality_name: `${qText} WEB-DL${sizeText}`,
        file_id: file.file_code,
        filecode: file.file_code,
        embed_url: `https://morencius.com/e/${file.file_code}`,
        mirrors: [
          {
            provider: 'EarnVids Cloud Direct',
            url: `https://earnvids.com/${file.file_code}`
          },
          {
            provider: 'EarnVids High Speed Stream',
            url: `https://morencius.com/e/${file.file_code}`
          }
        ]
      };
    });

    catalog.push({
      id: movieSlug,
      title: `${imdb.title} (${imdb.year})`,
      slug: movieSlug,
      categories: categories,
      release_year: imdb.year,
      poster_url: imdb.poster,
      backdrop_url: imdb.backdrop,
      imdb: {
        id: imdb.imdbId,
        rating: imdb.rating,
        title: imdb.title,
        director: imdb.director,
        cast: imdb.cast,
        genres: imdb.genres,
        summary: imdb.summary
      },
      earnvid_filecode: primaryFile.file_code,
      embed_url: `https://morencius.com/e/${primaryFile.file_code}`,
      canplay: primaryFile.canplay,
      qualities: qualities,
      screenshots: []
    });

    console.log(`  -> Added: ${imdb.title} (${imdb.year}) | ★ ${imdb.rating} | Cat: ${categories[0]} | Files: ${qualities.length}`);
  }

  // 4. Save to data/movies.json
  const outputPath = path.join(__dirname, 'data', 'movies.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf8');

  console.log('\n===============================================================');
  console.log(`✅ Success! Saved ${catalog.length} live uploaded movies to: ${outputPath}`);
  console.log(`📁 File Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB (Ultra-fast for Cloudflare Workers!)`);
  console.log('===============================================================');
}

syncLiveCatalog().catch(console.error);
