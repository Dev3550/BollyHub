// D:\BollyHub\bot.mjs
// BollyHub Official Telegram Movie Engine Bot (@BollyHubOfficial_bot)
// Features: Dynamic 16,000+ movie search, instant poster previews, streaming & download links

import fs from 'fs';
import path from 'path';

const BOT_TOKEN = '9096712179:AAF2t72UJJQUnW5P12MxDphEHFfWFJd1SV4';
const BASE_SITE_URL = process.env.BASE_SITE_URL || 'http://localhost:3000';
const MOVIES_PATH = 'D:/BollyHub/data/movies.json';

let moviesData = [];

try {
  moviesData = JSON.parse(fs.readFileSync(MOVIES_PATH, 'utf-8'));
  console.log(`🎬 [BollyHub Bot] Successfully loaded ${moviesData.length} movies from catalog.`);
} catch (err) {
  console.error('❌ [BollyHub Bot] Error loading movies.json:', err.message);
  process.exit(1);
}

// Telegram API Request Helper
async function tgCall(method, payload) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    console.error(`Telegram API (${method}) error:`, e.message);
    return { ok: false, error: e.message };
  }
}

// Clean title helper
function cleanMovieTitle(raw) {
  if (!raw) return 'Movie';
  return raw
    .replace(/^Download\s+/i, '')
    .replace(/\[18\+\]/gi, '')
    .replace(/\{.*?\}/g, '')
    .replace(/\|.*/, '')
    .split(/\b(480p|720p|1080p|2160p|WEB-DL|BluRay|HDTC|ESub)\b/i)[0]
    .trim();
}

// Message handler
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userText = (msg.text || '').trim();

  if (!userText) return;

  console.log(`📩 [Msg from ${msg.chat.first_name || 'User'} (${chatId})]: ${userText}`);

  // 1. /start command
  if (userText === '/start') {
    const welcomeText = 
      `👋 <b>Welcome to BollyHub Movies Bot!</b> (@BollyHubOfficial_bot)\n\n` +
      `⚡ Aap yahan se <b>16,000+ Bollywood aur Hollywood</b> movies search karke direct <b>Online Stream</b> ya <b>Fast Download</b> kar sakte hain.\n\n` +
      `🔍 <b>Kaise use karein?</b>\n` +
      `• Kisi bhi movie ka naam likh kar bhejiye (jaise: <code>Stree 2</code> ya <code>Shaitaan</code> ya <code>Salaar</code>).\n` +
      `• Ya command use karein: <code>/search movie_name</code>\n\n` +
      `🌐 <b>Official Website:</b> ${BASE_SITE_URL}`;

    const startKeyboard = {
      inline_keyboard: [
        [
          { text: '👻 Search Stree 2', callback_data: 'search_stree2' },
          { text: '👹 Search Shaitaan', callback_data: 'search_shaitaan' }
        ],
        [
          { text: '⚔️ Search Salaar', callback_data: 'search_salaar' },
          { text: '💥 Search Deadpool 2', callback_data: 'search_deadpool2' }
        ],
        [
          { text: '🌐 Open BollyHub Web Catalog', url: BASE_SITE_URL }
        ]
      ]
    };

    return tgCall('sendMessage', {
      chat_id: chatId,
      text: welcomeText,
      parse_mode: 'HTML',
      reply_markup: startKeyboard
    });
  }

  // 2. Movie Search (/search <name> or plain text like "Stree 2")
  let query = userText;
  if (userText.startsWith('/search')) {
    query = userText.replace('/search', '').trim();
  }

  if (!query) {
    return tgCall('sendMessage', {
      chat_id: chatId,
      text: '⚠️ <b>Please provide a movie name!</b>\nExample: <code>Stree 2</code> ya <code>/search Salaar</code>',
      parse_mode: 'HTML'
    });
  }

  const queryLower = query.toLowerCase();
  
  // Search in title, slug, and id
  const matches = moviesData.filter(m => {
    const titleMatch = m.title && m.title.toLowerCase().includes(queryLower);
    const idMatch = m.id && m.id.toLowerCase().includes(queryLower.replace(/\s+/g, '-'));
    const imdbTitle = m.imdb?.title && m.imdb.title.toLowerCase().includes(queryLower);
    return titleMatch || idMatch || imdbTitle;
  }).slice(0, 3);

  if (matches.length === 0) {
    return tgCall('sendMessage', {
      chat_id: chatId,
      text: `❌ <b>"${query}"</b> ke liye koi movie nahi mili.\n\n💡 <i>Spelling check karke doosra naam try karein.</i>`,
      parse_mode: 'HTML'
    });
  }

  for (const movie of matches) {
    const displayTitle = cleanMovieTitle(movie.title);
    const watchUrl = `${BASE_SITE_URL}/watch.html?id=${encodeURIComponent(movie.id)}`;
    const downloadUrl = `${BASE_SITE_URL}/download.html?id=${encodeURIComponent(movie.id)}`;

    const caption = 
      `🎬 <b>${displayTitle}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 <b>Release Year:</b> ${movie.release_year || '2024'}\n` +
      `⭐ <b>IMDb Rating:</b> ${movie.imdb?.rating || '7.5'} / 10\n` +
      `🎭 <b>Genres:</b> ${movie.imdb?.genres || 'Action, Thriller'}\n` +
      `🎬 <b>Director:</b> ${movie.imdb?.director || 'Popular Director'}\n\n` +
      `📖 <b>Storyline:</b>\n<i>${(movie.imdb?.summary || 'Enjoy high-speed streaming on BollyHub without any buffer.').substring(0, 180)}...</i>`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '▶️ Watch Online [Full HD]', url: watchUrl },
          { text: '📥 Fast Download Links', url: downloadUrl }
        ],
        [
          { text: '🌐 Open BollyHub Portal', url: BASE_SITE_URL }
        ]
      ]
    };

    if (movie.poster_url && movie.poster_url.startsWith('http')) {
      const sendPhotoRes = await tgCall('sendPhoto', {
        chat_id: chatId,
        photo: movie.poster_url,
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      });

      // Fallback to text message if photo URL has expired or fails
      if (!sendPhotoRes.ok) {
        await tgCall('sendMessage', {
          chat_id: chatId,
          text: caption,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard
        });
      }
    } else {
      await tgCall('sendMessage', {
        chat_id: chatId,
        text: caption,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      });
    }
  }
}

// Callback Query Handler (for inline buttons click)
async function handleCallbackQuery(cb) {
  const data = cb.data;
  const chatId = cb.message.chat.id;

  if (data.startsWith('search_')) {
    const movieKey = data.replace('search_', '');
    const dummyMsg = {
      chat: { id: chatId, first_name: cb.from?.first_name },
      text: movieKey
    };
    await tgCall('answerCallbackQuery', { callback_query_id: cb.id });
    return handleMessage(dummyMsg);
  }
  await tgCall('answerCallbackQuery', { callback_query_id: cb.id });
}

// Long Polling Engine
let offset = 0;
async function startPolling() {
  console.log('🤖 [BollyHub Bot] Engine is LIVE and polling for user requests...');
  
  while (true) {
    try {
      const res = await tgCall('getUpdates', {
        offset: offset + 1,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      });

      if (res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = update.update_id;

          if (update.message) {
            handleMessage(update.message).catch(e => console.error('Error handling message:', e));
          } else if (update.callback_query) {
            handleCallbackQuery(update.callback_query).catch(e => console.error('Error handling callback:', e));
          }
        }
      }
    } catch (err) {
      console.error('⚠️ [Polling loop exception]:', err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// Start Bot
startPolling();
