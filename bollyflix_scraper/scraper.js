const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

const OUTPUT_FILE = path.resolve(__dirname, config.output_file || '../data/movies.json');
const CHECKPOINT_FILE = path.resolve(__dirname, config.checkpoint_file || '../data/checkpoint_urls.json');

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
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

// Extract permanent GDFlix File ID from FastDL URL
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
          mirrors.push({ provider: 'Mirror Link', url: href });
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

  console.log('\n🔍 Stage 1: Crawling categories & pagination pages...');

  for (const catUrl of categories) {
    console.log(`👉 Crawling Category: ${catUrl}`);
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
      if (!nextPage.length && page > 1) {
        break;
      }

      page++;
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`    Total movies found in ${catUrl}: ${catMovieCount}`);
  }

  console.log(`\n✅ Total Unique Movies Discovered: ${movieUrls.size}`);
  return Array.from(movieUrls);
}

async function parseMoviePage(html, url) {
  const $ = cheerio.load(html);

  let title = $('h1.single-title, h1.entry-title, h1.title').text().trim();
  if (!title) title = $('meta[property="og:title"]').attr('content') || 'Movie';

  const slug = url.split('/').filter(Boolean).pop() || `movie-${Date.now()}`;
  
  // Extract real poster URL (Filter out vlcsnap screenshots)
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

        qualities.push({
          quality_name: qText,
          file_id: fileId || '1JCJo1ZDOMbMY18',
          gdflix_url: gdflixUrl || 'https://new3.gdflix.io/file/1JCJo1ZDOMbMY18',
          fastdl_url: fastdlUrl,
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

async function runScraper() {
  console.log('======================================================');
  console.log('  🎬 BOLLYHUB AUTOMATED CLOUD SCRAPER STARTING');
  console.log('======================================================');

  const allUrls = await getAllMovieUrlsFullSite();
  const toScrape = allUrls.filter(u => !scrapedUrls.has(u));

  console.log(`\n⚡ Total to scrape: ${toScrape.length} (Skipping ${allUrls.length - toScrape.length} already scraped)`);

  if (toScrape.length === 0) {
    console.log('🎉 All discovered movies across the site are up-to-date!');
    return;
  }

  console.log(`\n🚀 Stage 2: Extracting ${toScrape.length} new/updated movies...`);

  let addedCount = 0;
  for (let i = 0; i < toScrape.length; i++) {
    const url = toScrape[i];
    if (scrapedUrls.has(url)) continue;

    console.log(`   ⚡ [${i + 1}/${toScrape.length}] Scraping Movie: ${url}`);
    const html = await fetchHtml(url);
    if (html) {
      const movie = await parseMoviePage(html, url);
      // Remove any existing movie with same ID to avoid duplicates
      existingMovies = existingMovies.filter(m => m.id !== movie.id);
      existingMovies.unshift(movie);
      scrapedUrls.add(url);
      addedCount++;
    }

    if (addedCount % 10 === 0) {
      saveData();
      console.log(`   💾 Progress Checkpoint Saved! (${existingMovies.length} total movies in database)`);
    }
  }

  saveData();
  console.log(`\n✅ Scraping Finished Successfully!`);
  console.log(`📦 Total Movies in Database: ${existingMovies.length}`);
  console.log(`📁 Saved to: ${OUTPUT_FILE}`);
}

runScraper();
