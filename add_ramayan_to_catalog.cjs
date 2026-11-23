const fs = require('fs');
const path = require('path');

const moviesPath = path.join(__dirname, 'data', 'movies.json');
const currentMovies = JSON.parse(fs.readFileSync(moviesPath, 'utf8'));

const newRamayanEntries = [
  {
    id: 'ramayana-rise-of-a-legend-2026',
    title: 'Ramayana: Rise of a Legend (2026)',
    slug: 'ramayana-rise-of-a-legend-2026',
    categories: ['SOUTH HINDI DUBBED', 'SOUTH', 'ACTION', 'MYTHOLOGY'],
    release_year: '2026',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMjA4NzUyMzYtNDU0Mi00OGYwLTgwOWItYmM4MjNmYWI5M2EwXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    backdrop_url: 'https://m.media-amazon.com/images/M/MV5BMjA4NzUyMzYtNDU0Mi00OGYwLTgwOWItYmM4MjNmYWI5M2EwXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    imdb: {
      id: 'tt31845892',
      rating: '8.4',
      title: 'Ramayana: Rise of a Legend',
      director: 'Nitesh Tiwari',
      cast: ['Ranbir Kapoor', 'Sai Pallavi', 'Yash', 'Sunny Deol'],
      genres: 'Action, Adventure, Drama, Fantasy',
      summary: 'The epic mythological journey of Lord Rama, his devotion, righteousness, and the ultimate battle against the demon king Ravana.'
    },
    earnvid_filecode: 'd7p0z2uc1zm8',
    embed_url: 'https://morencius.com/embed/d7p0z2uc1zm8',
    canplay: 1,
    qualities: [
      {
        quality_name: '720P HDTC',
        file_id: 'd7p0z2uc1zm8',
        filecode: 'd7p0z2uc1zm8',
        embed_url: 'https://morencius.com/embed/d7p0z2uc1zm8',
        mirrors: [
          { provider: 'EarnVids 1-Click Direct Download', url: 'https://morencius.com/d/d7p0z2uc1zm8' },
          { provider: 'EarnVids High Speed Stream', url: 'https://morencius.com/file/d7p0z2uc1zm8' }
        ]
      }
    ],
    screenshots: []
  },
  {
    id: 'mahakavya-shri-ramayan-katha-2026',
    title: 'Mahakavya Shri Ramayan Katha (2026)',
    slug: 'mahakavya-shri-ramayan-katha-2026',
    categories: ['BOLLYWOOD', 'HINDI', 'DEVOTIONAL', 'MYTHOLOGY'],
    release_year: '2026',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BYzA2ZDk3OTctZjU5MS00NzAwLWEwOGMtMGQwNTllODQ5MDljXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    backdrop_url: 'https://m.media-amazon.com/images/M/MV5BYzA2ZDk3OTctZjU5MS00NzAwLWEwOGMtMGQwNTllODQ5MDljXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    imdb: {
      id: 'tt31845893',
      rating: '8.1',
      title: 'Mahakavya Shri Ramayan Katha – Shri Ram Ki',
      director: 'Ramanand Sagar Productions',
      cast: ['Arun Govil', 'Sunil Lahri', 'Dipika Chikhlia'],
      genres: 'Devotional, Drama, History',
      summary: 'The holy narrative depicting the divine life, ideals, and supreme glory of Maryada Purushottam Bhagwan Shri Ram.'
    },
    earnvid_filecode: '0vldfxak184b',
    embed_url: 'https://morencius.com/embed/0vldfxak184b',
    canplay: 1,
    qualities: [
      {
        quality_name: '720P HDTC',
        file_id: '0vldfxak184b',
        filecode: '0vldfxak184b',
        embed_url: 'https://morencius.com/embed/0vldfxak184b',
        mirrors: [
          { provider: 'EarnVids 1-Click Direct Download', url: 'https://morencius.com/d/0vldfxak184b' },
          { provider: 'EarnVids High Speed Stream', url: 'https://morencius.com/file/0vldfxak184b' }
        ]
      }
    ],
    screenshots: []
  },
  {
    id: 'adipurush-2023',
    title: 'Adipurush (2023)',
    slug: 'adipurush-2023',
    categories: ['BOLLYWOOD', 'HINDI', 'ACTION', 'MYTHOLOGY'],
    release_year: '2023',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BNmU1NTE3OGQtYzAzMS00ODU4LTk2YmQtOGIzNDBhNjVhNTUyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    backdrop_url: 'https://m.media-amazon.com/images/M/MV5BNmU1NTE3OGQtYzAzMS00ODU4LTk2YmQtOGIzNDBhNjVhNTUyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    imdb: {
      id: 'tt13008546',
      rating: '7.0',
      title: 'Adipurush',
      director: 'Om Raut',
      cast: ['Prabhas', 'Kriti Sanon', 'Saif Ali Khan', 'Sunny Singh'],
      genres: 'Action, Adventure, Drama',
      summary: 'A visual spectacle chronicling Raghav, the prince of Ayodhya, who embarks on a quest to Lanka to rescue his wife Janaki.'
    },
    earnvid_filecode: 'nmrk3a7pk8n9',
    embed_url: 'https://morencius.com/embed/nmrk3a7pk8n9',
    canplay: 1,
    qualities: [
      {
        quality_name: '720P WEB-DL',
        file_id: 'nmrk3a7pk8n9',
        filecode: 'nmrk3a7pk8n9',
        embed_url: 'https://morencius.com/embed/nmrk3a7pk8n9',
        mirrors: [
          { provider: 'EarnVids 1-Click Direct Download', url: 'https://morencius.com/d/nmrk3a7pk8n9' },
          { provider: 'EarnVids High Speed Stream', url: 'https://morencius.com/file/nmrk3a7pk8n9' }
        ]
      }
    ],
    screenshots: []
  }
];

// Add the 3 Ramayan movies at the FRONT so they appear prominently on the Home Page!
const filtered = currentMovies.filter(m => !newRamayanEntries.some(n => n.id === m.id));
const updatedCatalog = [...newRamayanEntries, ...filtered];

fs.writeFileSync(moviesPath, JSON.stringify(updatedCatalog, null, 2));
console.log(`✅ Added 3 Ramayan movies to movies.json! Total movies now: ${updatedCatalog.length}`);
console.log('Top 5 titles on Home Page:');
for (const m of updatedCatalog.slice(0, 5)) {
  console.log(` - ${m.title} [${m.earnvid_filecode}]`);
}
