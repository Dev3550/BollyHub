// D:\BollyHub\scripts\telegram-poster.cjs
// Official Telegram Mini App Auto-Poster for BollyHub
// Posts movies with verified IMDb posters, synopsis, and In-Telegram Mini App Player buttons (Zero Strikes, Pure Traffic)

const fs = require('fs');
const path = require('path');

// Paths
const MOVIES_PATH = path.join(__dirname, '..', 'data', 'movies.json');
const LOG_PATH = path.join(__dirname, '..', 'data', 'telegram-posted.json');
const ENV_PATH = path.join(__dirname, '..', '.env');

function loadEnv() {
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      if (k && v.length) {
        const key = k.trim();
        const val = v.join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
  }
}
loadEnv();

const BOT_TOKEN = process.env.BOLLYHUB_TELEGRAM_BOT_TOKEN || '9096712179:AAF2t72UJJQUnW5P12MxDphEHFfWFJd1SV4';
const CHAT_ID = process.env.BOLLYHUB_TELEGRAM_CHAT_ID || '';
const CHANNEL_LINK = process.env.BOLLYHUB_TELEGRAM_CHANNEL || 'https://t.me/+mu3upENk3GFmZTFl';
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
  const director = movie.imdb?.director || 'Top Filmmakers';
  const castList = (movie.imdb?.cast && movie.imdb.cast.length) ? movie.imdb.cast.slice(0, 4).join(', ') : 'Popular Cast';
  const summary = (movie.imdb?.summary || 'Watch this blockbuster movie in full high definition inside Telegram with zero buffering.').slice(0, 260);

  const watchUrl = `${SITE_URL}/watch/${movie.slug}/`;

  return `👑 <b>BOLLYHUB™ OFFICIAL RELEASE</b> 👑
━━━━━━━━━━━━━━━━━━━━━
🎬 <b>${title.toUpperCase()}</b> (${year})
${stars} <b>IMDb:</b> ★ <b>${rating} / 10</b>

🔊 <b>Audio:</b> <code>Hindi Original 5.1 DD</code>
💿 <b>Quality:</b> <code>720p HD • Web-DL / BluRay</code>
🎭 <b>Genres:</b> <i>${genres}</i>
🎬 <b>Director:</b> <i>${director}</i>
👥 <b>Starring:</b> <i>${castList}</i>

━━━━━━━━━━━━━━━━━━━━━
📖 <b>Storyline:</b>
<i>"${summary}..."</i>

━━━━━━━━━━━━━━━━━━━━━
🍿 <b>Tap below to Play Movie directly inside Telegram!</b>
🛡 <i>100% Ad-Free • Zero Buffering • Fast Cloud Streaming</i>
📢 <b>Official Channel:</b> ${CHANNEL_LINK}`;
}

async function sendTelegramPost(movie, targetChatId = CHAT_ID) {
  if (!targetChatId) {
    console.error('❌ CHAT_ID is missing! Please set BOLLYHUB_TELEGRAM_CHAT_ID in .env or pass as argument.');
    return false;
  }

  const posterUrl = movie.poster_url;
  const caption = formatOfficialCaption(movie);
  const watchUrl = `${SITE_URL}/watch/${movie.slug}/`;
  const downloadUrl = `${SITE_URL}/download/${movie.slug}/`;

  // Telegram In-App Mini App Web Player Button
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '▶️ 🍿 Watch in Telegram Player',
          web_app: { url: watchUrl }
        }
      ],
      [
        { text: '⚡️ 1-Click Fast Download', url: downloadUrl },
        { text: '👑 Join Channel', url: CHANNEL_LINK }
      ]
    ]
  };

  const endpoint = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
  const payload = {
    chat_id: targetChatId,
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
  console.log('📢 BOLLYHUB TELEGRAM MINI APP AUTO-POSTER');
  console.log(`🤖 Bot Token: ${BOT_TOKEN.slice(0, 10)}...`);
  console.log(`📌 Chat ID: ${CHAT_ID || 'NOT SET YET'}`);
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
  const chatArgIdx = args.indexOf('--chat');
  const customChat = chatArgIdx !== -1 ? args[chatArgIdx + 1] : CHAT_ID;
  const slugIdx = args.indexOf('--slug');
  const targetSlug = slugIdx !== -1 ? args[slugIdx + 1] : null;

  if (targetSlug) {
    const m = movies.find(x => x.slug === targetSlug || x.id === targetSlug);
    if (!m) {
      console.error('Movie not found for slug:', targetSlug);
      return;
    }
    await sendTelegramPost(m, customChat);
    return;
  }

  const queue = movies.filter(m => !posted.has(m.slug));
  console.log(`Found ${movies.length} total movies in catalog. Unposted: ${queue.length}`);

  if (queue.length === 0) {
    console.log('🎉 All movies have already been posted to Telegram!');
    return;
  }

  if (isLatest) {
    const latest = queue[queue.length - 1];
    console.log(`Posting latest movie: "${latest.title}"`);
    await sendTelegramPost(latest, customChat);
    return;
  }

  const limit = isAll ? queue.length : Math.min(3, queue.length);
  console.log(`🚀 Posting next ${limit} movies to Official Telegram Channel...\n`);

  for (let i = 0; i < limit; i++) {
    const m = queue[i];
    console.log(`[${i + 1}/${limit}] Posting: "${m.title}"`);
    await sendTelegramPost(m, customChat);
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
