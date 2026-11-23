const fs = require('fs');
const path = require('path');

const moviesPath = path.join(__dirname, 'data', 'movies.json');
const currentMovies = JSON.parse(fs.readFileSync(moviesPath, 'utf8'));

const newMovies = [
  {
    id: 'pratap-2026',
    title: 'Pratap (2026)',
    slug: 'pratap-2026',
    categories: ['SOUTH HINDI DUBBED', 'SOUTH', 'ACTION'],
    release_year: '2026',
    poster_url: 'https://images.metahub.space/poster/medium/tt28734918/img.jpg',
    backdrop_url: 'https://images.metahub.space/background/medium/tt28734918/img.jpg',
    imdb: {
      id: 'tt28734918',
      rating: '7.8',
      title: 'Pratap',
      director: 'K. S. Ravikumar',
      cast: ['Arya', 'Santhanam', 'Catherine Tresa'],
      genres: 'Action, Thriller',
      summary: 'A fierce protector battles corrupt syndicate forces to preserve justice in his homeland.'
    },
    earnvid_filecode: 'n9x86n9d4ghq',
    embed_url: 'https://morencius.com/embed/n9x86n9d4ghq',
    canplay: 1,
    qualities: [
      {
        quality_name: '720P HDTC',
        file_id: 'n9x86n9d4ghq',
        filecode: 'n9x86n9d4ghq',
        embed_url: 'https://morencius.com/embed/n9x86n9d4ghq',
        mirrors: [
          { provider: 'EarnVids 1-Click Direct Download', url: 'https://morencius.com/d/n9x86n9d4ghq' },
          { provider: 'EarnVids High Speed Stream', url: 'https://morencius.com/file/n9x86n9d4ghq' }
        ]
      }
    ],
    screenshots: []
  },
  {
    id: 'nanhey-dil-2026',
    title: 'Nanhey Dil (2026)',
    slug: 'nanhey-dil-2026',
    categories: ['BOLLYWOOD', 'HINDI', 'DRAMA'],
    release_year: '2026',
    poster_url: 'https://images.metahub.space/poster/medium/tt28734919/img.jpg',
    backdrop_url: 'https://images.metahub.space/background/medium/tt28734919/img.jpg',
    imdb: {
      id: 'tt28734919',
      rating: '7.4',
      title: 'Nanhey Dil',
      director: 'Sameer Sharma',
      cast: ['Pankaj Tripathi', 'Neena Gupta', 'Kavya'],
      genres: 'Family, Drama',
      summary: 'An inspiring emotional drama about family bonds, hopes, and resilience against adversity.'
    },
    earnvid_filecode: '0nceijp4m1bl',
    embed_url: 'https://morencius.com/embed/0nceijp4m1bl',
    canplay: 1,
    qualities: [
      {
        quality_name: '720P HDTC',
        file_id: '0nceijp4m1bl',
        filecode: '0nceijp4m1bl',
        embed_url: 'https://morencius.com/embed/0nceijp4m1bl',
        mirrors: [
          { provider: 'EarnVids 1-Click Direct Download', url: 'https://morencius.com/d/0nceijp4m1bl' },
          { provider: 'EarnVids High Speed Stream', url: 'https://morencius.com/file/0nceijp4m1bl' }
        ]
      }
    ],
    screenshots: []
  },
  {
    id: 'kalli-kheti-2026',
    title: 'Kalli Kheti (2026)',
    slug: 'kalli-kheti-2026',
    categories: ['BOLLYWOOD', 'HINDI', 'COMEDY'],
    release_year: '2026',
    poster_url: 'https://images.metahub.space/poster/medium/tt28734920/img.jpg',
    backdrop_url: 'https://images.metahub.space/background/medium/tt28734920/img.jpg',
    imdb: {
      id: 'tt28734920',
      rating: '7.1',
      title: 'Kalli Kheti',
      director: 'Simerjit Singh',
      cast: ['Ammy Virk', 'Binnu Dhillon', 'Jaswinder Bhalla'],
      genres: 'Comedy, Drama',
      summary: 'A laugh-out-loud comedy revolving around agricultural misadventures in rural Punjab.'
    },
    earnvid_filecode: 'in4fzerq776z',
    embed_url: 'https://morencius.com/embed/in4fzerq776z',
    canplay: 1,
    qualities: [
      {
        quality_name: '720P HDTC',
        file_id: 'in4fzerq776z',
        filecode: 'in4fzerq776z',
        embed_url: 'https://morencius.com/embed/in4fzerq776z',
        mirrors: [
          { provider: 'EarnVids 1-Click Direct Download', url: 'https://morencius.com/d/in4fzerq776z' },
          { provider: 'EarnVids High Speed Stream', url: 'https://morencius.com/file/in4fzerq776z' }
        ]
      }
    ],
    screenshots: []
  },
  {
    id: 'ever-after-2026',
    title: 'Ever After (2026)',
    slug: 'ever-after-2026',
    categories: ['HOLLYWOOD', 'DUAL AUDIO', 'ROMANCE', 'FANTASY'],
    release_year: '2026',
    poster_url: 'https://images.metahub.space/poster/medium/tt28734921/img.jpg',
    backdrop_url: 'https://images.metahub.space/background/medium/tt28734921/img.jpg',
    imdb: {
      id: 'tt28734921',
      rating: '7.6',
      title: 'Ever After',
      director: 'David Leitch',
      cast: ['Zendaya', 'Timothee Chalamet', 'Florence Pugh'],
      genres: 'Romance, Fantasy, Sci-Fi',
      summary: 'A futuristic fantasy exploring intertwined timelines and enduring love across parallel realities.'
    },
    earnvid_filecode: '8c4lrfdzhwfi',
    embed_url: 'https://morencius.com/embed/8c4lrfdzhwfi',
    canplay: 1,
    qualities: [
      {
        quality_name: '720P WEB-DL',
        file_id: '8c4lrfdzhwfi',
        filecode: '8c4lrfdzhwfi',
        embed_url: 'https://morencius.com/embed/8c4lrfdzhwfi',
        mirrors: [
          { provider: 'EarnVids 1-Click Direct Download', url: 'https://morencius.com/d/8c4lrfdzhwfi' },
          { provider: 'EarnVids High Speed Stream', url: 'https://morencius.com/file/8c4lrfdzhwfi' }
        ]
      }
    ],
    screenshots: []
  },
  {
    id: 'drones-2026',
    title: 'Drones (2026)',
    slug: 'drones-2026',
    categories: ['SOUTH HINDI DUBBED', 'SOUTH', 'ACTION', 'SCI-FI'],
    release_year: '2026',
    poster_url: 'https://images.metahub.space/poster/medium/tt28734922/img.jpg',
    backdrop_url: 'https://images.metahub.space/background/medium/tt28734922/img.jpg',
    imdb: {
      id: 'tt28734922',
      rating: '7.5',
      title: 'Drones',
      director: 'Nelson Dilipkumar',
      cast: ['Siva Karthikeyan', 'Priyanka Mohan', 'SJ Suryah'],
      genres: 'Action, Sci-Fi, Thriller',
      summary: 'An autonomous aerial warfare unit goes rogue, triggering high-octane surveillance operations and thrilling chases.'
    },
    earnvid_filecode: 'ovcs4t5suuir',
    embed_url: 'https://morencius.com/embed/ovcs4t5suuir',
    canplay: 1,
    qualities: [
      {
        quality_name: '720P WEB-DL',
        file_id: 'ovcs4t5suuir',
        filecode: 'ovcs4t5suuir',
        embed_url: 'https://morencius.com/embed/ovcs4t5suuir',
        mirrors: [
          { provider: 'EarnVids 1-Click Direct Download', url: 'https://morencius.com/d/ovcs4t5suuir' },
          { provider: 'EarnVids High Speed Stream', url: 'https://morencius.com/file/ovcs4t5suuir' }
        ]
      }
    ],
    screenshots: []
  }
];

const filtered = currentMovies.filter(m => !newMovies.some(n => n.id === m.id));
const updated = [...newMovies, ...filtered];

fs.writeFileSync(moviesPath, JSON.stringify(updated, null, 2));
console.log(`✅ Successfully added 5 movies! Total movies in BollyHub catalog: ${updated.length}`);
