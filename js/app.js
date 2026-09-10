// ==========================================================================
// BollyHub Portal Frontend Core Application Logic
// Handles movie catalog rendering, search, category filtering, responsive
// pagination (10 mobile / 20 desktop), and 1-click direct storage routing.
// ==========================================================================

let moviesCache = null;
let currentFilteredMovies = [];
let currentPage = 1;

// Clean text strings helper
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/BollyFlix/gi, 'BollyHub')
    .replace(/bollyflix/gi, 'bollyhub')
    .trim();
}

// Fallback poster generator if poster is missing or invalid
function getFastPosterUrl(posterUrl) {
  if (posterUrl && posterUrl.startsWith('http') && !posterUrl.includes('vlcsnap') && !posterUrl.includes('screenshot')) {
    return posterUrl;
  }
  return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
}

// Fetch movies database
async function loadMoviesData() {
  if (moviesCache) return moviesCache;
  try {
    const resp = await fetch('data/movies.json');
    if (!resp.ok) throw new Error('Failed to load movies');
    moviesCache = await resp.json();
    return moviesCache;
  } catch (e) {
    console.error('[BollyHub] Error loading movies data:', e);
    return [];
  }
}

// Get Page Size dynamically based on screen width (10 on Mobile <= 768px, 20 on Desktop)
function getPageSize() {
  return window.innerWidth <= 768 ? 10 : 20;
}

// 1. Home Page & Catalog Logic (index.html)
async function initHomePage() {
  const gridContainer = document.getElementById('movies-grid');
  if (!gridContainer) return;

  const movies = await loadMoviesData();
  currentFilteredMovies = movies;

  renderMovieGrid(currentFilteredMovies, 1);

  // Search Listener
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        currentFilteredMovies = movies;
      } else {
        currentFilteredMovies = movies.filter(m => 
          (m.title && m.title.toLowerCase().includes(q)) ||
          (m.categories && m.categories.some(c => c.toLowerCase().includes(q))) ||
          (m.release_year && m.release_year.includes(q))
        );
      }
      renderMovieGrid(currentFilteredMovies, 1);
    });
  }

  // Category Filter Listener
  const catButtons = document.querySelectorAll('.cat-btn');
  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cat = btn.getAttribute('data-cat');
      if (!cat || cat === 'ALL') {
        currentFilteredMovies = movies;
      } else {
        currentFilteredMovies = movies.filter(m => 
          m.categories && m.categories.some(c => c.toUpperCase().includes(cat.toUpperCase()))
        );
      }
      renderMovieGrid(currentFilteredMovies, 1);
    });
  });

  // Handle Window Resize to adjust page size dynamically
  window.addEventListener('resize', () => {
    renderMovieGrid(currentFilteredMovies, currentPage);
  });
}

// Render Movie Cards & Single-Row Pagination Bar
function renderMovieGrid(moviesList, page = 1) {
  const gridContainer = document.getElementById('movies-grid');
  const paginationContainer = document.getElementById('pagination-container');
  if (!gridContainer) return;

  const pageSize = getPageSize();
  const totalItems = moviesList.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  currentPage = Math.min(Math.max(1, page), totalPages);

  if (totalItems === 0) {
    gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#94a3b8;">No titles found matching your criteria.</div>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  const startIdx = (currentPage - 1) * pageSize;
  const pageMovies = moviesList.slice(startIdx, startIdx + pageSize);

  gridContainer.innerHTML = pageMovies.map(m => {
    const cleanMovieTitle = cleanText(m.title);
    const poster = getFastPosterUrl(m.poster_url);
    const categoryTag = (m.categories && m.categories[0]) ? m.categories[0] : 'HD';

    return `
      <a href="movie.html?id=${encodeURIComponent(m.id)}" class="movie-card">
        <div class="card-poster">
          <img src="${poster}" alt="${cleanMovieTitle}" loading="lazy" decoding="async" />
          <span class="card-badge">${categoryTag}</span>
        </div>
        <div class="card-info">
          <div class="card-title">${cleanMovieTitle}</div>
          <div class="card-meta">
            <span>📅 ${m.release_year || '2026'}</span>
            <span>⭐ ${m.imdb?.rating || '8.0'}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');

  if (paginationContainer) {
    renderPaginationControls(paginationContainer, currentPage, totalPages);
  }
}

// Render Single Row Horizontal Pagination Bar
function renderPaginationControls(container, activePage, totalPages) {
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Prev Button
  if (activePage > 1) {
    html += `<button class="page-btn" onclick="goToPage(${activePage - 1})">« Prev</button>`;
  } else {
    html += `<button class="page-btn disabled">« Prev</button>`;
  }

  const maxButtons = 5;
  let startPage = Math.max(1, activePage - Math.floor(maxButtons / 2));
  let endPage = startPage + maxButtons - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) html += `<span class="page-dots">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    if (i === activePage) {
      html += `<button class="page-btn active">${i}</button>`;
    } else {
      html += `<button class="page-btn" onclick="goToPage(${i})">${i}</button>`;
    }
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="page-dots">...</span>`;
    html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  // Next Button
  if (activePage < totalPages) {
    html += `<button class="page-btn" onclick="goToPage(${activePage + 1})">Next »</button>`;
  } else {
    html += `<button class="page-btn disabled">Next »</button>`;
  }

  container.innerHTML = html;
}

window.goToPage = function(targetPage) {
  renderMovieGrid(currentFilteredMovies, targetPage);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 2. Movie Detail Page Logic (movie.html)
async function initDetailPage() {
  const detailBox = document.getElementById('movie-detail-box');
  if (!detailBox) return;

  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id');

  const movies = await loadMoviesData();
  const movie = movies.find(m => m.id === movieId) || movies[0];

  if (!movie) return;

  const cleanMovieTitle = cleanText(movie.title);
  const fastPoster = getFastPosterUrl(movie.poster_url);
  document.title = `${cleanMovieTitle} - BollyHub`;

  const categoriesTags = (movie.categories || []).map(c => `<span class="tag highlight">${c}</span>`).join(' ');

  const qualitiesHtml = (movie.qualities || []).map((q, qIndex) => {
    const cleanQName = cleanText(q.quality_name);
    return `
      <div class="quality-box">
        <div class="quality-title">${cleanQName}</div>
        <div class="btn-group">
          <a href="download.html?id=${encodeURIComponent(movie.id)}&qid=${qIndex}" class="btn-dl">
            🚀 Direct 1-Click FastDL
          </a>
          <a href="download.html?id=${encodeURIComponent(movie.id)}&qid=${qIndex}" class="btn-dl secondary">
            🔗 All Download Links
          </a>
        </div>
      </div>
    `;
  }).join('');

  const screenshotsHtml = (movie.screenshots || []).map(img => {
    const fastScreenshot = getFastPosterUrl(img);
    return `<img src="${fastScreenshot}" alt="Screenshot" loading="lazy" decoding="async" />`;
  }).join('');

  detailBox.innerHTML = `
    <div class="detail-container">
      <div class="detail-poster">
        <img src="${fastPoster}" alt="${cleanMovieTitle}" />
      </div>
      <div class="detail-info">
        <h1>${cleanMovieTitle}</h1>
        <div class="meta-tags">
          <span class="tag">📅 ${movie.release_year || '2026'}</span>
          ${categoriesTags}
        </div>

        <div class="imdb-box">
          <div class="imdb-title">⭐ IMDb Rating: ${movie.imdb?.rating || '8.2'} / 10</div>
          <div><strong>Director:</strong> ${movie.imdb?.director || 'N/A'}</div>
          <div><strong>Cast:</strong> ${(movie.imdb?.cast || []).join(', ')}</div>
          <div><strong>Genres:</strong> ${movie.imdb?.genres || 'Action, Thriller'}</div>
        </div>

        <div class="storyline">
          <strong>Storyline:</strong> ${cleanText(movie.imdb?.summary) || 'No storyline summary available.'}
        </div>

        <div class="download-section">
          <h3 style="margin-bottom:16px;">📥 Download Options (~ BollyHub)</h3>
          ${qualitiesHtml || '<div style="color:#94a3b8;">No download qualities available for this title.</div>'}
        </div>

        ${screenshotsHtml ? `<div style="margin-top:28px;"><h3>📸 Screenshots</h3><div class="screenshots-grid">${screenshotsHtml}</div></div>` : ''}
      </div>
    </div>
  `;
}

// 3. Download Hub Page Logic (download.html)
async function initDownloadHubPage() {
  const hubContainer = document.getElementById('download-hub-box');
  if (!hubContainer) return;

  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id');
  const qid = parseInt(urlParams.get('qid') || '0', 10);

  const movies = await loadMoviesData();
  const movie = movies.find(m => m.id === movieId) || movies[0];

  if (!movie) return;

  const qualityObj = (movie.qualities && movie.qualities[qid]) ? movie.qualities[qid] : (movie.qualities ? movie.qualities[0] : {});
  const cleanMovieTitle = cleanText(movie.title);
  const cleanQName = cleanText(qualityObj.quality_name || 'WEB-DL HD');
  const fileId = qualityObj.file_id || '1JCJo1ZDOMbMY18';

  const mirrors = qualityObj.mirrors || [];

  // Filter out any gdflix / fastdlserver URLs from mirrors to ensure 100% clean direct locker URLs
  const cleanMirrors = mirrors.filter(m => m.url && !m.url.includes('gdflix') && !m.url.includes('fastdlserver'));

  const primaryCleanMirror = cleanMirrors.find(m => m.url.includes('gofile') || m.url.includes('vikingfile') || m.url.includes('megaup') || m.url.includes('mixdrop')) || cleanMirrors[0];
  const secondaryCleanMirror = cleanMirrors.find(m => m !== primaryCleanMirror) || cleanMirrors[1] || cleanMirrors[0];
  
  // Instant DL Button: Uses 1-click clean storage locker (GoFile / VikingFile / MegaUp) to guarantee NO GDFlix redirect, else fastDlPagesLink
  const instantDlUrl = primaryCleanMirror ? primaryCleanMirror.url : fastDlPagesLink;
  
  // Fast Cloud Button: Uses secondary clean storage locker if available, else primary clean mirror
  const cloudUrl = secondaryCleanMirror ? secondaryCleanMirror.url : (primaryCleanMirror ? primaryCleanMirror.url : fastDlPagesLink);

  let mirrorsHtml = '';
  if (mirrors.length > 0) {
    mirrorsHtml = `
      <div style="margin-top:24px; text-align:left;">
        <h3 style="font-size:14px; margin-bottom:12px; color:#cbd5e1;">⚡ Direct Storage Mirrors (~ BollyHub)</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${mirrors.map(m => `
            <a href="${m.url}" target="_blank" class="btn-cloud" style="background: linear-gradient(135deg, #1e293b, #334155); border: 1px solid #475569; padding: 12px 16px; font-size:13px; display:flex; align-items:center; justify-content:space-between;">
              <span>⚡ Download via <strong>${(m.provider || 'Direct Cloud').toUpperCase()}</strong></span>
              <span style="font-size:11px; opacity:0.8; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:4px;">1-CLICK DIRECT</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  const fileName = `${cleanMovieTitle.split(' ')[0]}_${cleanQName.replace(/[^a-zA-Z0-9]/g, '_')}.mkv`;
  document.title = `Download ${fileName} - BollyHub Fast Engine`;

  hubContainer.innerHTML = `
    <div class="download-hub">
      <h2>📁 File Information (~ BollyHub Engine)</h2>
      
      <div class="file-info-card">
        <h3>${cleanMovieTitle}</h3>
        <div class="file-info-item">
          <span>Quality:</span>
          <span>${cleanQName}</span>
        </div>
        <div class="file-info-item">
          <span>File ID:</span>
          <span>${fileId.length > 28 ? fileId.substring(0, 25) + '...' : fileId}</span>
        </div>
        <div class="file-info-item">
          <span>Shared By:</span>
          <span>BollyHub Engine</span>
        </div>
      </div>

      <!-- Top Ad Container (YOUR MONETAG / ADSTERRA ADS) -->
      <div id="ad-download-slot" class="ad-slot">
        📢 [YOUR TOP AD SLOT: Place your Monetag / Adsterra Banner Script here]
      </div>

      <div class="hub-actions">
        <a href="${instantDlUrl}" target="_blank" class="btn-instant" id="instant-btn">
          ⚡ INSTANT DIRECT DL [1-CLICK NO ADS]
        </a>
        <a href="${cloudUrl}" target="_blank" class="btn-cloud">
          ☁️ BOLLYHUB FAST CLOUD SERVER
        </a>
        <a href="https://filesgram.xyz/?start=8_2220y1v8" target="_blank" class="btn-tele">
          ✈️ TELEGRAM FILE DOWNLOAD
        </a>
      </div>

      ${mirrorsHtml}

      <!-- Bottom Ad Container (YOUR MONETAG / ADSTERRA ADS) -->
      <div id="ad-bottom-slot" class="ad-slot" style="margin-top:20px;">
        📢 [YOUR BOTTOM AD SLOT: Place your Monetag / Adsterra Pop-under / Native Script here]
      </div>

      <p style="font-size:12px; color:#64748b; margin-top:16px; text-align:center;">
        Note: Click "INSTANT DIRECT DL" or any of the Direct Storage Mirrors above for 1-Click Fast Downloads (~ BollyHub Engine).
      </p>
    </div>
  `;
}

// Auto init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initHomePage();
  initDetailPage();
  initDownloadHubPage();
});
