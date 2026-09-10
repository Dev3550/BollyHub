// ==========================================================================
// BollyHub 10-Worker Parallel Cluster Scraper Engine
// Runs 10 concurrent worker threads processing atomic non-duplicate URL queue
// ==========================================================================

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

const OUTPUT_FILE = path.resolve(__dirname, config.output_file || '../data/movies.json');
const CHECKPOINT_FILE = path.resolve(__dirname, config.checkpoint_file || '../data/checkpoint_urls.json');

const WORKER_COUNT = 10; // 10 Parallel Scraper Workers

// Ensure data folder exists
const dataDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load existing movies & checkpoint URLs
let existingMovies = [];
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    existingMovies = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
  } catch (e) {
    existingMovies = [];
  }
}

let scrapedUrls = new Set();
if (fs.existsSync(CHECKPOINT_FILE)) {
  try {
    scrapedUrls = new Set(JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')));
  } catch (e) {
    scrapedUrls = new Set();
  }
}

function saveData() {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingMovies, null, 2), 'utf-8');
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(Array.from(scrapedUrls), null, 2), 'utf-8');
}

async function fetchHtml(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await axios.get(url, {
        headers: config.headers,
        timeout: (config.request_timeout_seconds || 25) * 1000
      });
      if (resp.status === 200) return resp.data;
    } catch (e) {
      if (e.response && e.response.status === 404) return null;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

function extractFileId(url) {
  if (!url) return '';
  if (url.includes('/file/')) {
    const match = url.match(/\/file\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
  }
  if (url.includes('id=')) {
    const match = url.match(/id=([a-zA-Z0-9%=-]+)/);
    if (match) return match[1];
  }
  return '';
}

async function fetchShortenerMirrors(shortenerUrl) {
  if (!shortenerUrl || !shortenerUrl.includes('linksmod.top')) return [];
  try {
    const html = await fetchHtml(shortenerUrl);
    if (!html) return [];

    const $ = cheerio.load(html);
    const mirrors = [];

    $('.view-well a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        try {
          const host = new URL(href).hostname.replace('www.', '');
          mirrors.push({ provider: host, url: href });
        } catch (e) {
          mirrors.push({ provider: 'Direct Cloud', url: href });
        }
      }
    });

    return mirrors;
  } catch (e) {
    return [];
  }
}

async function getAllMovieUrlsFullSite() {
  const movieUrls = new Set();
  const categories = config.categories || [config.base_url];

  console.log('\n🔍 Stage 1: Discovering all category movie pages...');

  for (const catUrl of categories) {
    console.log(`👉 Category: ${catUrl}`);
    let page = 1;
    let catMovieCount = 0;

    while (true) {
      const pageUrl = page === 1 ? catUrl : `${catUrl.replace(/\/$/, '')}/page/${page}/`;
      const html = await fetchHtml(pageUrl);
      if (!html) break;

      const $ = cheerio.load(html);
      const articles = $('article.latestPost, article.excerpt, article');
      let foundOnPage = 0;

      articles.each((_, elem) => {
        const link = $(elem).find('h2.title a, header h2 a, a.post-image').attr('href');
        if (link && link.startsWith('http') && !link.includes('/page/')) {
          if (!movieUrls.has(link)) {
            movieUrls.add(link);
            foundOnPage++;
            catMovieCount++;
          }
        }
      });

      if (foundOnPage === 0) break;

      const nextPage = $('a.next, .pagination a.next, a.pagination-next, .page-numbers.next');
      if (!nextPage.length && page > 1) break;

      page++;
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`    Discovered ${catMovieCount} movies in ${catUrl}`);
  }

  console.log(`\n✅ Total Unique Movies Discovered: ${movieUrls.size}`);
  return Array.from(movieUrls);
}

async function parseMoviePage(html, url) {
  const $ = cheerio.load(html);

  let title = $('h1.single-title, h1.entry-title, h1.title').text().trim();
  if (!title) title = $('meta[property="og:title"]').attr('content') || 'Movie';

  const slug = url.split('/').filter(Boolean).pop() || `movie-${Date.now()}`;
  
  let posterUrl = $('meta[property="og:image"]').attr('content') || '';
  if (!posterUrl || posterUrl.includes('vlcsnap') || posterUrl.includes('screenshot')) {
    posterUrl = '';
    $('.featured-thumbnail img, .wp-post-image, .post-single-content img, .entry-content img').each((_, img) => {
      if (posterUrl) return;
      const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
      if (src && src.startsWith('http') && !src.includes('vlcsnap') && !src.includes('screenshot') && !src.includes('proof')) {
        posterUrl = src;
      }
    });
  }

  const categories = [];
  $('#breadcrumbs a, .post-info a, .category a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !['HOME', 'MOVIES', 'BOLLYFLIX'].includes(text.toUpperCase())) {
      if (!categories.includes(text)) categories.push(text);
    }
  });

  const imdbData = {};
  const imdbBox = $('.imdb_container, .imdb_dark');
  if (imdbBox.length) {
    imdbData.rating = imdbBox.find('#imdb_rating').text().trim() || '8.0';
    imdbData.title = imdbBox.find('#movie_title').text().trim();
    imdbData.genres = imdbBox.find('#genres').text().trim();
    
    imdbBox.find('#imdb_general').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Director:')) imdbData.director = text.replace('Director:', '').trim();
      if (text.includes('Stars:')) {
        imdbData.cast = $(el).find('a').map((_, a) => $(a).text().trim()).get();
      }
    });

    const summary = imdbBox.find('#summary').text();
    if (summary) imdbData.summary = summary.replace('Summary:', '').trim();
  }

  const screenshots = [];
  $('.thecontent img, .entry-content img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src && (src.includes('blogger.googleusercontent.com') || src.includes('vlcsnap') || src.toLowerCase().includes('screenshot'))) {
      screenshots.push(src);
    }
  });

  const qualities = [];
  const contentDiv = $('.thecontent, .entry-content, .post-single-content');
  if (contentDiv.length) {
    const h5Tags = contentDiv.find('h5');
    for (let i = 0; i < h5Tags.length; i++) {
      const h5 = h5Tags.eq(i);
      const qText = h5.text().trim();
      const lower = qText.toLowerCase();

      if (['480p', '720p', '1080p', '2160p', '4k', 'mb]', 'gb]'].some(q => lower.includes(q))) {
        const pLinks = h5.next('p');
        let fileId = '';
        let fastdlUrl = '';
        let gdflixUrl = '';
        let mirrors = [];

        const aTags = pLinks.find('a.dl, a.dls, a.button');
        for (let j = 0; j < aTags.length; j++) {
          const a = aTags.eq(j);
          const href = a.attr('href');
          const label = a.text().trim();

          if (href && href.startsWith('http')) {
            if (label.toLowerCase().includes('google drive') || href.includes('fastdlserver')) {
              fastdlUrl = href;
              fileId = extractFileId(href) || '1JCJo1ZDOMbMY18';
              gdflixUrl = `https://new3.gdflix.io/file/${fileId}`;
            } else if (label.toLowerCase().includes('download links') || href.includes('linksmod')) {
              mirrors = await fetchShortenerMirrors(href);
            }
          }
        }

        const rawFastDlEngineUrl = fastdlUrl || `https://dl.fastdlserver.site/?id=${fileId}&type=file`;
        const fastdlPagesUrl = `https://fastdl-one.pages.dev/?url=${encodeURIComponent(rawFastDlEngineUrl)}`;

        qualities.push({
          quality_name: qText,
          file_id: fileId || '1JCJo1ZDOMbMY18',
          fastdl_pages_url: fastdlPagesUrl,
          gdflix_url: gdflixUrl || 'https://new3.gdflix.io/file/1JCJo1ZDOMbMY18',
          fastdl_url: rawFastDlEngineUrl,
          mirrors
        });
      }
    }
  }

  return {
    id: slug,
    title,
    url,
    slug,
    categories: categories.length ? categories : ['BOLLYWOOD'],
    release_year: title.match(/\b(20\d{2}|19\d{2})\b/)?.[1] || '2026',
    poster_url: posterUrl,
    imdb: imdbData,
    screenshots,
    qualities
  };
}

async function runClusterScraper() {
  console.log('==================================================================');
  console.log(`  🎬 BOLLYHUB 10-WORKER PARALLEL CLUSTER SCRAPER ENGINE`);
  console.log('==================================================================');

  const allUrls = await getAllMovieUrlsFullSite();
  // Filter out already scraped URLs for 0% duplication
  const urlQueue = allUrls.filter(u => !scrapedUrls.has(u));

  console.log(`\n⚡ Total Movies in Queue: ${urlQueue.length} (Skipping ${allUrls.length - urlQueue.length} already completed)`);

  if (urlQueue.length === 0) {
    console.log('🎉 Database is 100% up-to-date!');
    return;
  }

  console.log(`\n🚀 Launching ${WORKER_COUNT} Parallel Workers...`);

  let totalProcessed = 0;
  const totalToProcess = urlQueue.length;

  // Worker task loop
  async function worker(workerId) {
    while (urlQueue.length > 0) {
      // Atomic dequeue to prevent duplicates across workers
      const url = urlQueue.shift();
      if (!url || scrapedUrls.has(url)) continue;

      try {
        console.log(`  [Worker ${workerId}] ⚡ Scraping: ${url}`);
        const html = await fetchHtml(url);
        if (html) {
          const movie = await parseMoviePage(html, url);
          // Atomic deduplication in existingMovies array
          existingMovies = existingMovies.filter(m => m.id !== movie.id);
          existingMovies.unshift(movie);
          scrapedUrls.add(url);
          totalProcessed++;

          if (totalProcessed % 10 === 0) {
            saveData();
            console.log(`   💾 Progress Checkpoint Saved! (${existingMovies.length} total movies in DB | Progress: ${totalProcessed}/${totalToProcess})`);
          }
        }
      } catch (e) {
        console.error(`  [Worker ${workerId}] Error on ${url}: ${e.message}`);
      }
    }
  }

  // Start 10 parallel workers concurrently
  const workerPromises = [];
  for (let id = 1; id <= WORKER_COUNT; id++) {
    workerPromises.push(worker(id));
  }

  await Promise.all(workerPromises);

  saveData();
  console.log(`\n==================================================================`);
  console.log(`✅ Cluster Scraping Completed Successfully!`);
  console.log(`📦 Total Movies Saved in Database: ${existingMovies.length}`);
  console.log(`📁 Saved to File: ${OUTPUT_FILE}`);
  console.log(`==================================================================\n`);
}

runClusterScraper();
