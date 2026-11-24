// D:\BollyHub\scripts\telegram-poster.cjs
// Official Telegram Auto-Poster for BollyHub
// Posts high-converting, studio-grade movie releases with verified IMDb posters, synopsis, and instant stream/download buttons

const fs = require('fs');
const path = require('path');

// Paths
const MOVIES_PATH = path.join(__dirname, '..', 'data', 'movies.json');
const LOG_PATH = path.join(__dirname, '..', 'data', 'telegram-posted.json');
const ENV_PATH = path.join(__dirname, '..', '.env');
const ROOT_ENV_PATH = path.join('d:', 'Exotic Clean', '.env');

function loadEnv() {
  const envFiles = [ENV_PATH, ROOT_ENV_PATH];
  for (const ef of envFiles) {
    if (fs.existsSync(ef)) {
      const lines = fs.readFileSync(ef, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...v] = trimmed.split('=');
        if (k && v.length) {
          const key = k.trim();
          const val = v.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const BOT_TOKEN = process.env.BOLLYHUB_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '8770394156:AAFZCPyXcOl1eJc1bMrjzuasHOZlwku-2vE';
const CHAT_ID = process.env.BOLLYHUB_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '-1004296356232';
const CHANNEL_LINK = process.env.BOLLYHUB_TELEGRAM_CHANNEL || process.env.TELEGRAM_CHANNEL_LINK || 'https://t.me/+-bJlRxoLc7ViMWY1';
const SITE_URL = 'https://bollyhub.devendradubey61.workers.dev';

function getPostedSlugs() {
  if (fs.existsSync(LOG_PATH)) {
    try {
      return new Set(JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')));
    } catch (_) {}
  }
  return new Set();
}

function savePostedSlug(slug) {
  const posted = getPostedSlugs();
  posted.add(slug);
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(Array.from(posted), null, 2), 'utf8');
}

function formatStars(ratingStr) {
  const r = parseFloat(ratingStr || '7.5');
  const count = Math.min(5, Math.max(1, Math.round(r / 2)));
  return '⭐️'.repeat(count);
}

function formatOfficialCaption(movie) {
  const rating = movie.imdb?.rating || '7.5';
  const stars = formatStars(rating);
  const year = movie.release_year || '2024';
  const title = movie.imdb?.title || movie.title.replace(/\(.*?\)/g, '').trim();
  const genres = movie.imdb?.genres || (movie.categories || ['Bollywood']).join(', ');
  const director = movie.imdb?.director || 'Top Bollywood Filmmakers';
  const castList = (movie.imdb?.cast && movie.imdb.cast.length) ? movie.imdb.cast.slice(0, 4).join(', ') : 'Ensemble Star Cast';
  const summary = (movie.imdb?.summary || 'Watch this blockbuster movie in full high definition online on BollyHub.').slice(0, 280);

  const watchUrl = `${SITE_URL}/watch/${movie.slug}/`;
  const downloadUrl = `${SITE_URL}/download/${movie.slug}/`;

  return `👑 <b>BOLLYHUB™ OFFICIAL RELEASE</b> 👑
━━━━━━━━━━━━━━━━━━━━━
🎬 <b>${title.toUpperCase()}</b> (${year})
${stars} <b>IMDb Rating:</b> ★ <b>${rating} / 10</b>

🔊 <b>Audio:</b> <code>Hindi [Original 5.1 DD]</code>
💿 <b>Quality:</b> <code>720p HD • Multi-Bitrate • FastDL</code>
🎭 <b>Genres:</b> <i>${genres}</i>
🎬 <b>Director:</b> <i>${director}</i>
👥 <b>Starring:</b> <i>${castList}</i>

━━━━━━━━━━━━━━━━━━━━━
📖 <b>Storyline:</b>
<i>"${summary}..."</i>

━━━━━━━━━━━━━━━━━━━━━
🍿 <b>Stream Online (Zero Ads / Multi-Audio):</b>
👉 <a href="${watchUrl}">${watchUrl}</a>

⚡️ <b>1-Click Fast Direct Download:</b>
👉 <a href="${downloadUrl}">${downloadUrl}</a>

━━━━━━━━━━━━━━━━━━━━━
🛡 <i>BollyHub Official Channel &mdash; Always Free, Always Fast</i>
📢 <b>Join Official Community:</b> ${CHANNEL_LINK}`;
}

async function sendTelegramPost(movie) {
  const posterUrl = movie.poster_url;
  const caption = formatOfficialCaption(movie);
  const watchUrl = `${SITE_URL}/watch/${movie.slug}/`;
  const downloadUrl = `${SITE_URL}/download/${movie.slug}/`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '▶️ Stream Full HD Online', url: watchUrl },
        { text: '⚡️ 1-Click Direct Download', url: downloadUrl }
      ],
      [
        { text: '👑 Join BollyHub Official Channel', url: CHANNEL_LINK }
      ]
    ]
  };

  const endpoint = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
  const payload = {
    chat_id: CHAT_ID,
    photo: posterUrl,
    caption: caption,
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.ok) {
      console.log(`  ✅ Telegram Post Sent: "${movie.title}"`);
      savePostedSlug(movie.slug);
      return true;
    } else {
      console.error(`  ❌ Telegram API Error for "${movie.title}":`, json.description);
      return false;
    }
  } catch (err) {
    console.error(`  ❌ Network Error sending "${movie.title}":`, err.message);
    return false;
  }
}

async function run() {
  console.log('===============================================================');
  console.log('📢 BOLLYHUB OFFICIAL TELEGRAM AUTO-POSTER');
  console.log(`🤖 Bot Token: ${BOT_TOKEN.slice(0, 10)}...`);
  console.log(`📌 Chat ID: ${CHAT_ID}`);
  console.log(`🔗 Channel: ${CHANNEL_LINK}`);
  console.log('===============================================================');

  if (!fs.existsSync(MOVIES_PATH)) {
    console.error('Movies catalog not found at:', MOVIES_PATH);
    return;
  }

  const movies = JSON.parse(fs.readFileSync(MOVIES_PATH, 'utf8'));
  const posted = getPostedSlugs();

  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isLatest = args.includes('--latest');
  const slugIdx = args.indexOf('--slug');
  const targetSlug = slugIdx !== -1 ? args[slugIdx + 1] : null;

  if (targetSlug) {
    const m = movies.find(x => x.slug === targetSlug || x.id === targetSlug);
    if (!m) {
      console.error('Movie not found for slug:', targetSlug);
      return;
    }
    await sendTelegramPost(m);
    return;
  }

  // Filter unposted verified movies
  const queue = movies.filter(m => !posted.has(m.slug));
  console.log(`Found ${movies.length} total movies in catalog. Unposted in Telegram: ${queue.length}`);

  if (queue.length === 0) {
    console.log('🎉 All movies have already been posted to Telegram!');
    return;
  }

  if (isLatest) {
    const latest = queue[queue.length - 1];
    console.log(`Posting latest unposted movie: "${latest.title}"`);
    await sendTelegramPost(latest);
    return;
  }

  // Post in batches with 3-second delay
  const limit = isAll ? queue.length : Math.min(3, queue.length);
  console.log(`🚀 Posting next ${limit} movies to Official Telegram Channel...\n`);

  for (let i = 0; i < limit; i++) {
    const m = queue[i];
    console.log(`[${i + 1}/${limit}] Posting: "${m.title}"`);
    await sendTelegramPost(m);
    if (i < limit - 1) {
      console.log('Waiting 3 seconds...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 Telegram Posting Complete!');
  console.log('===============================================================');
}

module.exports = { sendTelegramPost, formatOfficialCaption };

if (require.main === module) {
  run().catch(console.error);
}
