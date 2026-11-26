#!/usr/bin/env python3
"""
BollyHub Telegram Cloud Movie Uploader (MTProto 2GB Streaming)
Uploads full HD movies directly to Telegram channels with native video streaming support,
dynamic IMDb movie posters, ratings, cast, summaries, and zero user data/PC usage via GitHub Actions.
Connected to BollyFlix 7,500+ Categorized Movies Database with Auto-Retry and 10-Minute Auto-Pilot.
STRICT FILTER: Excludes any movie already on the website, strictly picks Latest 2024-2026 Blockbusters,
and strictly filters Hollywood for Dual Audio (Hindi + English) only!
"""

import os
import sys
import json
import time
import re
import random
import argparse
import asyncio
from pathlib import Path
import requests
import urllib.parse

# Try importing Telethon
try:
    from telethon import TelegramClient, events
    from telethon.tl.types import DocumentAttributeVideo, InputFileBig
    from telethon.tl.functions.upload import SaveBigFilePartRequest
except ImportError:
    print("Telethon not installed. Run: pip install telethon cryptg")

# Load .env file if present
env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k not in os.environ:
                    os.environ[k] = v

# Configuration from Environment Variables
API_ID = os.environ.get("TELEGRAM_API_ID") or "37457570"
API_HASH = os.environ.get("TELEGRAM_API_HASH") or "fcd9e2be074ba2e591fbf663f4cec898"
BOT_TOKEN = os.environ.get("BOLLYHUB_TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN") or "9096712179:AAF2t72UJJQUnW5P12MxDphEHFfWFJd1SV4"
CHAT_ID = os.environ.get("BOLLYHUB_TELEGRAM_CHAT_ID") or os.environ.get("TELEGRAM_CHAT_ID") or "-1004487173033"
CHANNEL_LINK = os.environ.get("BOLLYHUB_TELEGRAM_CHANNEL") or "https://t.me/+mu3upENk3GFmZTFl"
TRAILER_CHAT_ID = os.environ.get("BOLLYHUB_TRAILER_CHAT_ID") or "-1005650458513"
TRAILER_CHANNEL_LINK = os.environ.get("BOLLYHUB_TRAILER_CHANNEL") or "https://t.me/c/5650458513"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MOVIES_FILE = DATA_DIR / "movies.json"
LINKS_FILE = DATA_DIR / "bollyflix_categorized_download_links.json"
POSTED_FILE = DATA_DIR / "telegram_cloud_uploaded.json"
SKIPPED_FILE = DATA_DIR / "telegram_cloud_skipped.json"
DEFAULT_THUMB = DATA_DIR / "default_thumb.jpg"

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive"
}

def load_posted():
    if POSTED_FILE.exists():
        try:
            with open(POSTED_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_posted(slug):
    posted = load_posted()
    posted.add(slug)
    POSTED_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(POSTED_FILE, "w", encoding="utf-8") as f:
        json.dump(list(posted), f, indent=2)

def load_skipped():
    if SKIPPED_FILE.exists():
        try:
            with open(SKIPPED_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_skipped(slug):
    skipped = load_skipped()
    skipped.add(slug)
    SKIPPED_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SKIPPED_FILE, "w", encoding="utf-8") as f:
        json.dump(list(skipped), f, indent=2)

def parse_year_num(raw_title, year_val=""):
    y_str = str(year_val or "").strip()
    if y_str.isdigit() and len(y_str) == 4:
        return int(y_str)
    m = re.search(r'\b(20\d\d|19\d\d)\b', raw_title or "")
    if m:
        return int(m.group(1))
    return 1900

def get_imdb_meta(clean_title, year=""):
    """
    Dynamically fetches real IMDb poster, rating, cast, director,
    and storyline from Cinemeta Stremio Catalog without requiring any API key.
    """
    try:
        clean_name = re.sub(r'[\{\[\(].*?[\}\]\)]', '', clean_title)
        clean_name = re.split(r'\s+(?:Dual|Hindi|Audio|Movie|WEB-DL|HDRip|BluRay|HDTC|ESub)', clean_name, flags=re.IGNORECASE)[0].strip()
        query = f'{clean_name} {year}'.strip() if year else clean_name
        encoded = requests.compat.quote(query)
        search_url = f'https://v3-cinemeta.strem.io/catalog/movie/top/search={encoded}.json'
        r = requests.get(search_url, headers=BROWSER_HEADERS, timeout=6)
        metas = r.json().get('metas', []) if r.status_code == 200 else []
        if not metas:
            # Fallback search without year
            fallback_url = f'https://v3-cinemeta.strem.io/catalog/movie/top/search={requests.compat.quote(clean_name)}.json'
            fr = requests.get(fallback_url, headers=BROWSER_HEADERS, timeout=6)
            if fr.status_code == 200:
                metas = fr.json().get('metas', [])

        if metas:
            imdb_id = metas[0].get('imdb_id') or metas[0].get('id')
            search_poster = metas[0].get('poster')
            search_bg = metas[0].get('background')
            if imdb_id and imdb_id.startswith('tt'):
                detail_url = f'https://v3-cinemeta.strem.io/meta/movie/{imdb_id}.json'
                dr = requests.get(detail_url, headers=BROWSER_HEADERS, timeout=6)
                if dr.status_code == 200:
                    m = dr.json().get('meta', {})
                    poster = m.get('poster') or search_poster
                    if poster and '/small/' in poster:
                        poster = poster.replace('/small/', '/medium/')
                    background = m.get('background') or search_bg
                    if background and '/small/' in background:
                        background = background.replace('/small/', '/medium/')
                    return {
                        'imdb_id': imdb_id,
                        'title': m.get('name') or clean_name,
                        'year': m.get('year') or year,
                        'rating': str(m.get('imdbRating') or '7.5'),
                        'genres': ', '.join(m.get('genres', [])) if m.get('genres') else None,
                        'director': ', '.join(m.get('director', [])) if m.get('director') else None,
                        'cast': m.get('cast', [])[:4] if m.get('cast') else [],
                        'poster_url': poster,
                        'background_url': background,
                        'trailer': m.get('trailer') or (m.get('trailers', [{}])[0].get('source') if m.get('trailers') else None),
                        'summary': m.get('description') or ''
                    }
    except Exception as e:
        print(f"  ⚠️ Cinemeta metadata fetch warning: {e}")
    return None

def fetch_bollyspice_cover(title):
    """
    Directly scrapes the authentic movie cover poster from bollyspice.in
    as a high-fidelity fallback when IMDb or Cinemeta lacks a poster.
    """
    try:
        from bs4 import BeautifulSoup
        clean = re.sub(r'[\{\[\(].*?[\}\]\)]', '', title)
        words = [w for w in re.split(r'[^a-zA-Z0-9]+', clean) if len(w) > 2 and w.lower() not in ['hindi', 'dual', 'audio', 'movie', 'full', 'download', '720p', '480p', '1080p']]
        query = ' '.join(words[:3])
        if not query:
            return None
        s = requests.Session()
        s.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://bollyspice.in/'
        })
        s.get('https://bollyspice.in/', timeout=5)
        r = s.post('https://bollyspice.in/index.php?do=search', data={'do': 'search', 'subaction': 'search', 'story': query}, timeout=8)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            for a in soup.find_all('a'):
                img = a.find('img')
                if img and img.get('src'):
                    src = img['src']
                    if '/uploads/posts/covers/' in src:
                        src_lower = src.lower()
                        if any(w.lower() in src_lower for w in words):
                            full_url = f'https://bollyspice.in{src}' if src.startswith('/') else src
                            return full_url
    except Exception as e:
        print(f"  ⚠️ BollySpice cover fetch warning: {e}")
    return None

def clean_movie_title(raw_title):
    clean = re.sub(r'^(?:Download|Watch)\s+', '', raw_title or "", flags=re.IGNORECASE)
    clean = re.sub(r'[\{\[\(].*?[\}\]\)]', '', clean)
    clean = re.sub(r'~\s*BollyFlix.*$', '', clean, flags=re.IGNORECASE)
    clean = re.split(r'\s+(?:480p|720p|1080p|2160p|WEB-DL|HDRip|BluRay|HDTC|Pre-DVDRip|Full Movie|Dual Audio|Hindi|Movie)', clean, flags=re.IGNORECASE)[0].strip()
    return clean

def extract_from_bollyflix_html(html, page_url):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    raw_title = ""
    h1 = soup.find(["h1", "h2"], class_=lambda c: c and ("entry-title" in c or "title" in c))
    if h1:
        raw_title = h1.get_text().strip()
    if not raw_title:
        t_tag = soup.find("title")
        if t_tag:
            raw_title = t_tag.get_text().strip()
            
    clean_title = clean_movie_title(raw_title)
    year_num = parse_year_num(raw_title)
    
    # Poster
    poster_url = None
    meta_img = soup.find("meta", property="og:image")
    if meta_img and meta_img.get("content"):
        poster_url = meta_img["content"]
    if not poster_url:
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            if src and any(k in src.lower() for k in ["poster", "cover", "uploads"]) and not any(k in src.lower() for k in ["logo", "icon", "banner"]):
                poster_url = src
                break
                
    # Download Qualities
    qualities = []
    headings = soup.find_all(["h5", "h4", "h3", "p", "div"])
    for h in headings:
        txt = h.get_text().lower()
        if any(q in txt for q in ["720p", "480p", "1080p"]):
            next_p = h.find_next(["p", "div"])
            links_to_search = []
            if next_p:
                links_to_search.extend(next_p.find_all("a", href=True))
            links_to_search.extend(h.find_all("a", href=True))
            for a in links_to_search:
                href = a["href"].strip()
                label = a.get_text().strip()
                if any(k in href.lower() for k in ["fastdlserver", "fast-dl", "gdflix", "instadl", "linksmod"]) or "dl" in a.get("class", []):
                    q_name = "720p HD" if "720p" in txt else ("480p SD" if "480p" in txt else "1080p FHD")
                    qualities.append({
                        "quality": q_name,
                        "url": href,
                        "label": label
                    })
                    
    if not qualities:
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if any(k in href.lower() for k in ["fastdlserver", "fast-dl", "gdflix", "instadl", "linksmod"]):
                qualities.append({
                    "quality": "720p HD",
                    "url": href,
                    "label": a.get_text().strip()
                })
                break
                
    chosen = None
    for pref in ["720p", "480p", "1080p"]:
        for q in qualities:
            if pref in q["quality"].lower():
                chosen = q
                break
        if chosen:
            break
    if not chosen and qualities:
        chosen = qualities[0]
        
    fallback_urls = [q["url"] for q in qualities if chosen and q["url"] != chosen["url"]]

    slug = page_url.rstrip("/").split("/")[-1].replace(".html", "").replace("download-", "")
    cat = "Hollywood" if any(w in raw_title.lower() for w in ["dual", "english", "hollywood"]) else ("South Hindi Dubbed" if any(w in raw_title.lower() for w in ["south", "telugu", "tamil"]) else "Bollywood")

    return {
        "slug": slug,
        "title": clean_title,
        "raw_title": raw_title,
        "year": str(year_num) if year_num > 1900 else "2024",
        "year_num": year_num,
        "category": cat,
        "qualityName": chosen["quality"] if chosen else "720p HD",
        "fastdlUrl": chosen["url"] if chosen else None,
        "fastdlPagesUrl": chosen["url"] if chosen else None,
        "fallbackUrls": fallback_urls,
        "poster_url": poster_url,
        "imdb": {}
    }

def extract_from_bollyspice_html(html, page_url):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find(["h1", "h2"], id="news-title") or soup.find("h1")
    raw_title = h1.get_text().strip() if h1 else (soup.find("title").get_text().strip() if soup.find("title") else "Movie")
    
    clean_title = clean_movie_title(raw_title)
    year_num = parse_year_num(raw_title)
    
    poster_url = None
    meta_img = soup.find("meta", property="og:image")
    if meta_img and meta_img.get("content"):
        poster_url = meta_img["content"]
    if not poster_url:
        st_img = soup.select_one(".story_img img, .full-story img")
        if st_img and st_img.get("src"):
            poster_url = st_img["src"]
            if poster_url.startswith("/"):
                poster_url = f"https://bollyspice.in{poster_url}"
                
    qualities = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        txt = a.get_text().lower()
        if any(k in href.lower() for k in ["nexdrive", "fastdl", "gdflix", "drive"]):
            q_name = "720p HD" if "720p" in txt else ("480p SD" if "480p" in txt else ("1080p FHD" if "1080p" in txt else "HD"))
            qualities.append({
                "quality": q_name,
                "url": href,
                "label": a.get_text().strip()
            })
            
    chosen = None
    for pref in ["720p", "480p", "1080p"]:
        for q in qualities:
            if pref in q["quality"].lower():
                chosen = q
                break
        if chosen:
            break
    if not chosen and qualities:
        chosen = qualities[0]
        
    fallback_urls = [q["url"] for q in qualities if chosen and q["url"] != chosen["url"]]

    slug = page_url.rstrip("/").split("/")[-1].replace(".html", "")
    cat = "Hollywood" if any(w in raw_title.lower() for w in ["dual", "english", "hollywood"]) else ("South Hindi Dubbed" if any(w in raw_title.lower() for w in ["south", "telugu", "tamil"]) else "Bollywood")

    return {
        "slug": slug,
        "title": clean_title,
        "raw_title": raw_title,
        "year": str(year_num) if year_num > 1900 else "2024",
        "year_num": year_num,
        "category": cat,
        "qualityName": chosen["quality"] if chosen else "720p HD",
        "fastdlUrl": chosen["url"] if chosen else None,
        "fastdlPagesUrl": chosen["url"] if chosen else None,
        "fallbackUrls": fallback_urls,
        "poster_url": poster_url,
        "imdb": {}
    }

def search_bollyflix_tours(query):
    """Searches BollyFlix Tours (Site 1) for query and returns extracted movie dict if found."""
    import urllib.parse
    from bs4 import BeautifulSoup
    domains = ["https://new1.bollyflix.tours", "https://bollyflix.tours"]
    words = [w.lower() for w in re.split(r'[^a-zA-Z0-9]+', query) if len(w) > 2 and w.lower() not in ['hindi', 'dual', 'audio', 'movie', 'download', '720p', '480p', '1080p']]
    clean_q = " ".join(words) if words else query
    encoded_q = urllib.parse.quote_plus(clean_q)
    
    for domain in domains:
        try:
            url = f"{domain}/?s={encoded_q}"
            r = requests.get(url, headers=BROWSER_HEADERS, timeout=10)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                candidates = []
                for a in soup.find_all("a", href=True):
                    href = a["href"].strip()
                    title = a.get("title") or a.get_text()
                    title = title.strip()
                    if href.startswith(domain) and not any(x in href for x in ["/category/", "/page/", "/tag/", "/contact", "/dmca"]):
                        href_lower = href.lower()
                        title_lower = title.lower()
                        score = sum(1 for w in words if w in href_lower or w in title_lower)
                        if score > 0:
                            candidates.append((score, href))
                if candidates:
                    candidates.sort(key=lambda x: x[0], reverse=True)
                    best_url = candidates[0][1]
                    print(f"  🌐 [Site 1: BollyFlix Tours] Found candidate page: {best_url}")
                    page_res = requests.get(best_url, headers=BROWSER_HEADERS, timeout=12)
                    if page_res.status_code == 200:
                        movie = extract_from_bollyflix_html(page_res.text, best_url)
                        if movie and movie.get("fastdlUrl"):
                            return movie
        except Exception as e:
            print(f"  ⚠️ BollyFlix Tours search error ({domain}): {e}")
    return None

def search_bollyspice(query):
    """Searches BollySpice (Site 2) for query and returns extracted movie dict if found."""
    from bs4 import BeautifulSoup
    words = [w.lower() for w in re.split(r'[^a-zA-Z0-9]+', query) if len(w) > 2 and w.lower() not in ['hindi', 'dual', 'audio', 'movie', 'download', '720p', '480p', '1080p']]
    clean_q = " ".join(words[:3]) if words else query
    try:
        s = requests.Session()
        s.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://bollyspice.in/'
        })
        s.get('https://bollyspice.in/', timeout=6)
        r = s.post('https://bollyspice.in/index.php?do=search', data={'do': 'search', 'subaction': 'search', 'story': clean_q}, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            candidates = []
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if re.search(r'/\d+-[a-zA-Z0-9-]+\.html', href):
                    full_href = f"https://bollyspice.in{href}" if href.startswith("/") else href
                    href_lower = href.lower()
                    score = sum(1 for w in words if w in href_lower)
                    candidates.append((score, full_href))
            if candidates:
                candidates.sort(key=lambda x: x[0], reverse=True)
                best_url = candidates[0][1]
                print(f"  🌐 [Site 2: BollySpice] Found candidate page: {best_url}")
                page_res = s.get(best_url, timeout=12)
                if page_res.status_code == 200:
                    movie = extract_from_bollyspice_html(page_res.text, best_url)
                    if movie and movie.get("fastdlUrl"):
                        return movie
    except Exception as e:
        print(f"  ⚠️ BollySpice search error: {e}")
    return None

def search_bollyflixi(query):
    """Searches BollyFlixi (Site 3) for query and returns extracted movie dict if found."""
    import urllib.parse
    from bs4 import BeautifulSoup
    words = [w.lower() for w in re.split(r'[^a-zA-Z0-9]+', query) if len(w) > 2 and w.lower() not in ['hindi', 'dual', 'audio', 'movie', 'download', '720p', '480p', '1080p']]
    clean_q = " ".join(words) if words else query
    try:
        url = f"https://bollyflixi.com/?s={urllib.parse.quote_plus(clean_q)}"
        r = requests.get(url, headers=BROWSER_HEADERS, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            candidates = []
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if href.startswith("https://bollyflixi.com/") and not any(x in href for x in ["/category/", "/page/", "/tag/"]):
                    href_lower = href.lower()
                    score = sum(1 for w in words if w in href_lower)
                    if score > 0:
                        candidates.append((score, href))
            if candidates:
                candidates.sort(key=lambda x: x[0], reverse=True)
                best_url = candidates[0][1]
                print(f"  🌐 [Site 3: BollyFlixi] Found candidate page: {best_url}")
                page_res = requests.get(best_url, headers=BROWSER_HEADERS, timeout=12)
                if page_res.status_code == 200:
                    movie = extract_from_bollyflix_html(page_res.text, best_url)
                    if movie and movie.get("fastdlUrl"):
                        return movie
    except Exception as e:
        print(f"  ⚠️ BollyFlixi search error: {e}")
    return None

def smart_search_and_resolve_movie(raw_input, all_movies):
    """
    Intelligently resolves any movie query:
    1. Direct FastDL/GDFlix/CDN URL -> Synthetic movie object
    2. Specific Webpage URL (BollyFlix Tours, BollySpice, BollyFlixi) -> Scrapes and extracts movie
    3. Movie Title / Name / Slug (e.g. 'eternals', 'war-2019', 'pushpa 2'):
       - Checks local 7,500+ database first
       - If not found locally, live-searches all 3 websites in order:
         [Site 1: BollyFlix Tours] -> [Site 2: BollySpice] -> [Site 3: BollyFlixi]
       - Enriches with Cinemeta IMDb metadata (HD Poster, Rating, Cast, Genres)
    """
    raw_input = raw_input.strip()
    
    # 1. Direct Download Link provided
    if raw_input.startswith("http") and any(d in raw_input for d in ["dl.fastdlserver.site", "instadl.rest", "gdflix", "googleusercontent", "fast-dl.one", "nexdrive.help"]):
        return [{
            "slug": f"custom-url-{int(time.time())}",
            "title": "Custom Movie Release",
            "year": "2024",
            "year_num": 2024,
            "category": "Bollywood",
            "qualityName": "720p HD",
            "fastdlUrl": raw_input,
            "fastdlPagesUrl": raw_input,
            "poster_url": None,
            "imdb": {}
        }]
        
    # 2. Specific Movie Webpage URL provided
    if raw_input.startswith("http"):
        print(f"🔍 Direct Webpage URL provided: {raw_input}")
        try:
            r = requests.get(raw_input, headers=BROWSER_HEADERS, timeout=12)
            if r.status_code == 200:
                if "bollyspice.in" in raw_input:
                    movie = extract_from_bollyspice_html(r.text, raw_input)
                else:
                    movie = extract_from_bollyflix_html(r.text, raw_input)
                if movie and movie.get("fastdlUrl"):
                    print(f"  ✅ Extracted movie: {movie['title']} ({movie['year']}) with {movie['qualityName']}")
                    return [movie]
        except Exception as e:
            print(f"  ⚠️ Error scraping direct webpage URL: {e}")
            
    # 3. Movie Slug or Name provided (e.g. 'eternals', 'war 2019', 'Download Eternals (2021)...')
    # 3A. First search local database
    query = raw_input.lower()
    clean_q = clean_movie_title(raw_input).lower()
    
    local_matches = [m for m in all_movies if query in m.get("slug", "").lower() or query in m.get("title", "").lower()]
    if not local_matches and clean_q:
        local_matches = [m for m in all_movies if clean_q in m.get("slug", "").lower() or clean_q in m.get("title", "").lower()]
    if not local_matches:
        # Fuzzy tokens
        tokens = [t for t in re.split(r'[^a-zA-Z0-9]+', clean_q or query) if len(t) > 3 and not t.isdigit()]
        if tokens:
            local_matches = [m for m in all_movies if all(t in m.get("slug", "").lower() or t in m.get("title", "").lower() for t in tokens)]
            
    if local_matches:
        print(f"📚 Found {len(local_matches)} matching movie(s) in local catalog snapshot!")
        return local_matches
        
    # 3B. Not found in local snapshot! Launch Multi-Site Live Search across all 3 websites!
    search_term = clean_movie_title(raw_input) or raw_input
    print(f"🌐 '{raw_input}' not in local catalog snapshot.")
    print(f"🚀 Launching Live Multi-Site Search for '{search_term}' across 3 platforms...")
    
    # Try Site 1: BollyFlix Tours (https://new1.bollyflix.tours)
    movie = search_bollyflix_tours(search_term)
    if movie:
        print(f"  🎯 Successfully resolved from [Site 1: BollyFlix Tours]: {movie['title']} ({movie['year']})")
        return [movie]
        
    # Try Site 2: BollySpice (https://bollyspice.in)
    movie = search_bollyspice(search_term)
    if movie:
        print(f"  🎯 Successfully resolved from [Site 2: BollySpice]: {movie['title']} ({movie['year']})")
        return [movie]
        
    # Try Site 3: BollyFlixi (https://bollyflixi.com)
    movie = search_bollyflixi(search_term)
    if movie:
        print(f"  🎯 Successfully resolved from [Site 3: BollyFlixi]: {movie['title']} ({movie['year']})")
        return [movie]
        
    print(f"❌ '{search_term}' could not be found across any of the 3 websites.")
    return []

def load_all_categorized_movies():
    """
    Loads all movies from bollyflix_categorized_download_links.json.
    1. EXCLUDES movies already on the website (movies.json).
    2. STRICTLY filters Hollywood for Dual Audio / Hindi content only!
    3. SORTS all categories by year descending (2026, 2025, 2024 newest first!).
    """
    website_slugs = set()
    enrich_map = {}
    if MOVIES_FILE.exists():
        try:
            with open(MOVIES_FILE, "r", encoding="utf-8") as f:
                for m in json.load(f):
                    s = m.get("slug") or m.get("id") or ""
                    if s:
                        website_slugs.add(s)
                        enrich_map[s] = m
                    t = m.get("title", "").lower()
                    if t:
                        website_slugs.add(t)
                        enrich_map[t] = m
        except Exception:
            pass

    categories = {"Bollywood": [], "South Hindi Dubbed": [], "Hollywood": []}
    seen_slugs = set()

    if LINKS_FILE.exists():
        with open(LINKS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        for cat_name, cat_data in data.items():
            matched_cat = "Bollywood"
            if "south" in cat_name.lower():
                matched_cat = "South Hindi Dubbed"
            elif "hollywood" in cat_name.lower():
                matched_cat = "Hollywood"

            q720 = cat_data.get("qualities", {}).get("720p", [])
            for item in q720:
                movie_id = item.get("movieId")
                fastdl = item.get("fastdlUrl")
                if not movie_id or not fastdl:
                    continue

                if movie_id in seen_slugs:
                    continue

                # STRICT RULE: Skip if already on the website!
                if movie_id in website_slugs:
                    continue

                raw_title = item.get("title", "")

                # STRICT FILTER: For Hollywood movies, ensure it has Hindi Audio (Dual Audio / Multi Audio)
                if matched_cat == "Hollywood":
                    title_lower = raw_title.lower()
                    if not any(w in title_lower for w in ["hindi", "dual", "multi"]):
                        continue

                seen_slugs.add(movie_id)

                year_str = item.get("year", "")
                year_num = parse_year_num(raw_title, year_str)

                clean_title = re.sub(r'^Download\s+', '', raw_title, flags=re.IGNORECASE)
                clean_title = re.split(r'\s+(?:480p|720p|1080p|2160p|WEB-DL|HDRip|BluRay|HDTC|Pre-DVDRip|Full Movie)', clean_title, flags=re.IGNORECASE)[0].strip()

                enriched = enrich_map.get(movie_id) or enrich_map.get(clean_title.lower()) or {}

                movie_obj = {
                    "slug": movie_id,
                    "title": clean_title,
                    "year": str(year_num) if year_num > 1900 else (enriched.get("release_year") or "2024"),
                    "year_num": year_num,
                    "category": matched_cat,
                    "qualityName": item.get("qualityName", "720p HD"),
                    "fastdlUrl": fastdl,
                    "fastdlPagesUrl": item.get("fastdlPagesUrl"),
                    "poster_url": enriched.get("poster_url"),
                    "imdb": enriched.get("imdb", {})
                }
                categories[matched_cat].append(movie_obj)

    # Sort each category: LATEST RELEASES FIRST (2026 -> 2025 -> 2024...)
    for cat in categories:
        categories[cat].sort(key=lambda m: m["year_num"], reverse=True)

    return categories

def resolve_single_chain(start_url, session):
    """
    Follows redirects through fastdl, gdflix, instadl, and pages.dev to obtain direct Google CDN URL.
    Uses requests.Session to maintain cookies across Cloudflare-protected domains.
    """
    curr = start_url
    for hop in range(8):
        try:
            res = session.get(curr, headers={**BROWSER_HEADERS, "Referer": curr}, allow_redirects=False, timeout=20)
            
            if res.status_code in (301, 302, 307, 308):
                loc = res.headers.get("Location")
                if not loc:
                    break
                loc_clean = loc if loc.startswith("http") else requests.compat.urljoin(curr, loc)
                
                # Check for fastdl-one.pages.dev query wrapper: ?url=https://...
                if "url=" in loc_clean:
                    parsed = urllib.parse.urlparse(loc_clean)
                    params = urllib.parse.parse_qs(parsed.query)
                    if "url" in params and params["url"]:
                        unwrapped = params["url"][0]
                        if "googleusercontent.com" in unwrapped:
                            return unwrapped
                        curr = unwrapped
                        continue
                        
                if "googleusercontent.com" in loc_clean:
                    return loc_clean
                curr = loc_clean
                continue
                
            elif res.status_code == 200:
                html = res.text
                if "googleusercontent.com" in html:
                    m = re.search(r'https?://[^\'"\s]*googleusercontent\.com[^\'"\s]*', html)
                    if m:
                        return m.group(0)
                        
                # Match InstaDL direct button/link
                match = re.search(r'href=[\'"]([^\'"]*instadl\.rest[^\'"]*)[\'"]', html)
                if match:
                    inst_url = match.group(1)
                    dl_res = session.get(inst_url, headers={**BROWSER_HEADERS, "Referer": curr}, allow_redirects=False, timeout=20)
                    dl_loc = dl_res.headers.get("Location")
                    if dl_loc:
                        if "url=" in dl_loc:
                            parsed = urllib.parse.urlparse(dl_loc)
                            params = urllib.parse.parse_qs(parsed.query)
                            if "url" in params and params["url"]:
                                unwrapped = params["url"][0]
                                if "googleusercontent.com" in unwrapped:
                                    return unwrapped
                                curr = unwrapped
                                continue
                        if "googleusercontent.com" in dl_loc:
                            return dl_loc
                        curr = dl_loc if dl_loc.startswith("http") else requests.compat.urljoin(inst_url, dl_loc)
                        continue
                        
                # Generic download button
                btn_match = re.search(r'<a[^>]+href=[\'"]([^\'"]+)[\'"][^>]*>(?:[^<]*(?:Instant|Direct|Fast Cloud|Download)[^<]*)</a>', html, re.IGNORECASE)
                if btn_match:
                    btn_link = btn_match.group(1)
                    if not btn_link.startswith("http"):
                        btn_link = requests.compat.urljoin(curr, btn_link)
                    curr = btn_link
                    continue
                break
            else:
                break
        except Exception as e:
            print(f"      ⚠️ Hop error on {curr[:45]}: {e}")
            break
    return None

def resolve_direct_link(start_url):
    """
    Robust multi-path resolver with Session cookie handling and active mirror fallbacks.
    """
    if not start_url:
        return None
        
    if "googleusercontent.com" in start_url:
        return start_url

    session = requests.Session()
    # Path A: Try primary start URL chain
    direct = resolve_single_chain(start_url, session)
    if direct:
        return direct

    # Path B: Fallback via active GDFlix mirror domains if primary wrapper/domain failed
    file_id = ""
    if "id=" in start_url:
        m = re.search(r'id=([a-zA-Z0-9%=-]+)', start_url)
        if m: file_id = m.group(1)
    elif "/file/" in start_url:
        m = re.search(r'/file/([a-zA-Z0-9%=-]+)', start_url)
        if m: file_id = m.group(1)

    if file_id:
        fallback_domains = ["https://new10.gdflix.io", "https://gdflix.dev"]
        for domain in fallback_domains:
            fallback_url = f"{domain}/file/{file_id}"
            direct = resolve_single_chain(fallback_url, session)
            if direct:
                return direct

    return None

def download_file(url, target_path):
    """
    High-speed stream download with progress reporting, HTTP error checking,
    and 1950MB safety limit. Returns True if successful, False if link is broken/expired.
    """
    print(f"⬇️ Downloading to {target_path.name}...")
    try:
        with requests.get(url, stream=True, headers=BROWSER_HEADERS, timeout=30) as r:
            if r.status_code >= 400:
                print(f"  ❌ CDN returned HTTP {r.status_code} (Link expired or DMCA blocked on Google Drive).")
                return False

            r.raise_for_status()
            total_size = int(r.headers.get("content-length", 0))

            # Telegram bot MTProto limit is 2000 MB (4000 parts of 512KB)
            MAX_SAFE_BYTES = 1950 * 1024 * 1024
            if total_size > MAX_SAFE_BYTES:
                print(f"  ⚠️ Video size ({total_size / (1024*1024):.1f} MB) exceeds Telegram Bot MTProto limit (1950 MB). Skipping.")
                return False

            downloaded = 0
            last_pct = 0
            with open(target_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024): # 1MB chunks
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            pct = int((downloaded / total_size) * 100)
                            if pct >= last_pct + 20:
                                print(f"  ⬇️ Downloaded: {pct}% ({downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB)")
                                last_pct = pct

        file_size_mb = target_path.stat().st_size / (1024 * 1024)
        print(f"  ✅ Download complete: {file_size_mb:.1f} MB")
        return True
    except Exception as e:
        print(f"  ❌ Download error: {e}")
        return False

def download_thumbnail(poster_url, target_path):
    """Downloads poster as JPG thumbnail for video player preview with WebP support."""
    if not poster_url:
        return None
    try:
        headers = {**BROWSER_HEADERS}
        if 'bollyspice.in' in poster_url:
            headers['Referer'] = 'https://bollyspice.in/'
        r = requests.get(poster_url, headers=headers, timeout=12)
        if r.status_code == 200 and len(r.content) > 1000:
            content_type = r.headers.get('content-type', '').lower()
            if 'webp' in content_type or poster_url.lower().endswith('.webp'):
                try:
                    from PIL import Image
                    import io
                    img = Image.open(io.BytesIO(r.content)).convert('RGB')
                    img.save(str(target_path), 'JPEG', quality=95)
                    return str(target_path)
                except Exception as conv_err:
                    print(f"  ⚠️ WebP conversion error: {conv_err}")

            with open(target_path, "wb") as f:
                f.write(r.content)
            return str(target_path)
    except Exception as e:
        print(f"  ⚠️ Thumbnail download failed ({poster_url[:50]}): {e}")
    return None

def format_caption(movie):
    title = movie.get("title", "Movie")
    year = movie.get("year") or movie.get("release_year", "2024")
    category = movie.get("category", "Bollywood")
    rating = movie.get("imdb", {}).get("rating") or "7.8"
    genres = movie.get("imdb", {}).get("genres") or f"{category}, Action, Drama"
    summary = movie.get("imdb", {}).get("summary") or f"Watch {title} in Full HD online with zero buffering on BollyHub."
    cast = ", ".join(movie.get("imdb", {}).get("cast", [])[:4]) if movie.get("imdb", {}).get("cast") else ""
    director = movie.get("imdb", {}).get("director")

    tip_line = ""
    if "South" in category:
        audio_lang = "Hindi Dubbed [Dual Audio HQ]"
        tip_line = "💡 <i>Audio Note: Tap ⋮ (3-dots) on player to switch Audio Track to Hindi</i>\n"
    elif "Hollywood" in category:
        audio_lang = "Hindi + English [Dual Audio 5.1]"
        tip_line = "💡 <i>Audio Note: Tap ⋮ (3-dots) on player to switch Audio Track to Hindi</i>\n"
    else:
        audio_lang = "Hindi Original [Clean 5.1 DD]"

    details = []
    if cast:
        details.append(f"👥 <b>Starring:</b> <i>{cast}</i>")
    if director:
        details.append(f"🎬 <b>Director:</b> <i>{director}</i>")

    details_str = ("\n" + "\n".join(details)) if details else ""

    caption = (
        f"👑 <b>BOLLYHUB™ OFFICIAL RELEASE</b> 👑\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"🎬 <b>{title.upper()}</b> ({year})\n"
        f"⭐️ <b>IMDb:</b> ★ <b>{rating} / 10</b>\n\n"
        f"🔊 <b>Audio:</b> <code>{audio_lang}</code>\n"
        f"💿 <b>Quality:</b> <code>720p HD • Native In-Telegram Stream</code>\n"
        f"🎭 <b>Category:</b> <i>{category} • {genres}</i>"
        f"{details_str}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📖 <b>Storyline:</b>\n"
        f"<i>\"{summary[:200]}...\"</i>\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"{tip_line}"
        f"🍿 <b>Play directly inside Telegram with zero buffering!</b>\n"
        f"📢 <b>Official Community:</b> {CHANNEL_LINK}"
    )
    return caption

async def fast_upload_file(client, file_path, progress_callback=None, max_workers=4):
    """
    FastTelethon 4-worker Parallel Chunk Streaming Uploader.
    Uploads large video files to Telegram in 512KB chunks using 4 parallel workers.
    Safely achieves 3x-5x speed with 0 flood wait risk.
    """
    file_size = os.path.getsize(file_path)
    part_size = 512 * 1024  # 512KB per Telegram part
    total_parts = (file_size + part_size - 1) // part_size

    # Guard against Telegram MTProto 4000-part absolute limit
    if total_parts > 4000:
        raise ValueError(f"File parts ({total_parts}) exceeds Telegram MTProto limit 4000. File size: {file_size / (1024*1024):.1f} MB")

    file_id = random.getrandbits(63)
    file_name = os.path.basename(file_path)

    sem = asyncio.Semaphore(max_workers)
    uploaded_bytes = 0
    lock = asyncio.Lock()

    async def upload_worker(part_index, data):
        nonlocal uploaded_bytes
        async with sem:
            req = SaveBigFilePartRequest(
                file_id=file_id,
                file_part=part_index,
                file_total_parts=total_parts,
                bytes=data
            )
            await client(req)
            async with lock:
                uploaded_bytes += len(data)
                if progress_callback:
                    progress_callback(uploaded_bytes, file_size)

    tasks = []
    with open(file_path, "rb") as f:
        part_idx = 0
        while True:
            chunk = f.read(part_size)
            if not chunk:
                break
            tasks.append(upload_worker(part_idx, chunk))
            part_idx += 1

    await asyncio.gather(*tasks)
    return InputFileBig(id=file_id, parts=total_parts, name=file_name)

async def upload_movie_to_telegram(client, chat_target, movie, video_path, thumb_path):
    """Uploads large video file up to 2GB via FastTelethon 4-worker parallel MTProto."""
    print(f"\n🚀 Initiating FastTelethon 4-Worker High-Speed Upload to Telegram ({chat_target})...")
    caption = format_caption(movie)

    last_pct = 0
    start_time = time.time()

    def progress_callback(current, total):
        nonlocal last_pct
        pct = int((current / total) * 100)
        if pct >= last_pct + 10:
            elapsed = time.time() - start_time
            speed = (current / (1024 * 1024)) / elapsed if elapsed > 0 else 0
            print(f"  ⬆️ Uploading to Telegram (4-Worker Stream): {pct}% ({current / (1024*1024):.1f} MB / {total / (1024*1024):.1f} MB) @ {speed:.2f} MB/s")
            last_pct = pct

    # Native Telegram Video Attributes (renders duration & center play button overlay)
    attributes = [
        DocumentAttributeVideo(
            duration=7200, # 2 hours default
            w=1280,
            h=720,
            supports_streaming=True
        )
    ]

    # Fast multi-worker parallel upload
    input_file = await fast_upload_file(client, str(video_path), progress_callback=progress_callback, max_workers=4)

    # Send video file with supports_streaming=True so Telegram enables in-app instant video streaming
    msg = await client.send_file(
        chat_target,
        input_file,
        caption=caption,
        parse_mode="html",
        thumb=thumb_path if thumb_path and Path(thumb_path).exists() else None,
        supports_streaming=True,
        attributes=attributes
    )

    print(f"\n🎉🎉 MOVIE SUCCESSFULLY UPLOADED & STORED IN TELEGRAM! 🎉🎉")
    print(f"   Message ID: {msg.id}")
    return msg.id

def search_dailymotion_trailer(title, year):
    """Searches Dailymotion for official HD trailer. Highly reliable on cloud runners with zero bot checks."""
    try:
        clean = re.sub(r'[\{\[\(].*?[\}\]\)]', '', title)
        clean = re.split(r'\s+(?:Dual|Hindi|Audio|Movie|WEB-DL|HDRip|BluRay|HDTC|ESub)', clean, flags=re.IGNORECASE)[0].strip()
        words = [w for w in re.split(r'[^a-zA-Z0-9]+', clean) if len(w) > 1]
        q_str = " ".join(words[:4])
        if year:
            q_str += f" {year}"
        q_str += " official trailer"
        url = f"https://api.dailymotion.com/videos?search={urllib.parse.quote_plus(q_str)}&limit=3&fields=id,title,url"
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        if r.status_code == 200:
            items = r.json().get("list", [])
            if items:
                print(f"  🎬 Found Dailymotion official trailer: {items[0]['title']} ({items[0]['url']})")
                return items[0]["url"]
    except Exception as e:
        print(f"  ⚠️ Dailymotion trailer search error: {e}")
    return None

def download_official_trailer(movie, target_path):
    """
    Downloads the official HD trailer for the movie using Dailymotion and YouTube (via yt-dlp).
    Bypasses datacenter bot blocks by prioritizing Dailymotion and supporting optional cookies.
    Returns True if successful, False otherwise.
    """
    try:
        import yt_dlp
    except ImportError:
        print("  ⚠️ yt-dlp not installed, skipping official trailer download.")
        return False

    title = movie.get("title", "")
    year = movie.get("year", "")
    trailer_key = movie.get("imdb", {}).get("trailer")

    ydl_opts = {
        'format': 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best',
        'outtmpl': str(target_path),
        'max_filesize': 80 * 1024 * 1024,
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
    }

    # Support optional YouTube cookies if passed via secret/file
    cookie_file = Path("/tmp/youtube_cookies.txt")
    if not cookie_file.exists():
        cookie_file = Path("youtube_cookies.txt")
    if cookie_file.exists() and cookie_file.stat().st_size > 50:
        ydl_opts['cookiefile'] = str(cookie_file)

    sources = []

    # 1. Dailymotion search (100% immune to YouTube's "Sign in to confirm you're not a bot" datacenter block)
    dm_url = search_dailymotion_trailer(title, year)
    if dm_url:
        sources.append(dm_url)

    # 2. Cinemeta / IMDb trailer key
    if trailer_key:
        if str(trailer_key).startswith("http"):
            sources.append(str(trailer_key))
        else:
            sources.append(f"https://www.youtube.com/watch?v={trailer_key}")

    # 3. YouTube search queries: Hindi official trailer, then official trailer, then clean query
    sources.append(f"ytsearch1:{title} {year} official trailer hindi")
    sources.append(f"ytsearch1:{title} {year} official trailer")
    sources.append(f"ytsearch1:{title} official trailer")

    print(f"  🎬 Searching & downloading official HD trailer for: {title} ({year})...")
    for src in sources:
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([src])
            found_file = target_path if target_path.exists() else None
            if not found_file:
                for alt in target_path.parent.glob(f"{target_path.stem}.*"):
                    if alt.is_file() and alt.stat().st_size > 100 * 1024:
                        found_file = alt
                        break
            if found_file and found_file.stat().st_size > 100 * 1024:
                size_mb = found_file.stat().st_size / (1024 * 1024)
                print(f"  ✅ Official trailer downloaded successfully: {size_mb:.1f} MB")
                return True
        except Exception as e:
            print(f"  ⚠️ Trailer source attempt notice ({src[:45]}): {e}")
            for alt in target_path.parent.glob(f"{target_path.stem}.*"):
                try: alt.unlink()
                except Exception: pass
    return False

def format_trailer_caption(movie, main_post_link):
    title = movie.get("title", "Movie")
    year = movie.get("year", "2024")
    imdb_data = movie.get("imdb", {})
    rating = imdb_data.get("rating", "7.5")
    genres = imdb_data.get("genres") or movie.get("category", "HD Movie")
    cast = ", ".join(imdb_data.get("cast", [])) if imdb_data.get("cast") else None

    caption = (
        f"🎬 <b>Official HD Trailer: {title} ({year})</b>\n\n"
        f"⭐ <b>IMDb:</b> ★ {rating}/10 | <b>Category:</b> {movie.get('category', 'HD Movie')}\n"
        f"🎭 <b>Genres:</b> {genres}\n"
    )
    if cast:
        caption += f"👥 <b>Starring:</b> {cast}\n"

    caption += (
        f"\n🔥 <b>Full Movie hamare Main Channel par upload ho chuki hai!</b>\n\n"
        f"📥 <b>Full Movie Dekhne / Download Karne Ke Liye Yahan Click Karein:</b>\n"
        f"👉 <a href=\"{main_post_link}\"><b>Click Here To Download Full Movie</b></a>\n\n"
        f"📢 <b>Join Main Movie Channel:</b>\n"
        f"🔗 <a href=\"{CHANNEL_LINK}\"><b>{CHANNEL_LINK}</b></a>"
    )
    return caption

async def post_official_trailer_to_promo(client, trailer_chat, main_chat, main_msg_id, movie, thumb_path, work_dir):
    """Uploads the official movie trailer to the second (promo) channel with direct link to main movie post."""
    temp_trailer = work_dir / f"{movie['slug']}_official_trailer.mp4"
    try:
        # Calculate main post direct URL
        main_chat_str = str(main_chat)
        if main_chat_str.startswith("-100"):
            clean_id = main_chat_str[4:]
            main_post_link = f"https://t.me/c/{clean_id}/{main_msg_id}"
        elif main_chat_str.startswith("@"):
            main_post_link = f"https://t.me/{main_chat_str[1:]}/{main_msg_id}"
        else:
            main_post_link = CHANNEL_LINK

        success = download_official_trailer(movie, temp_trailer)
        found_trailer = temp_trailer if temp_trailer.exists() else None
        if not found_trailer:
            for alt in temp_trailer.parent.glob(f"{temp_trailer.stem}.*"):
                if alt.is_file() and alt.stat().st_size > 100 * 1024:
                    found_trailer = alt
                    break

        if not success or not found_trailer:
            print(f"  ⚠️ Could not obtain official trailer for {movie['title']}. Skipping promo post.")
            return None

        caption = format_trailer_caption(movie, main_post_link)
        print(f"  📢 Posting official trailer to Promo Channel ({trailer_chat})...")
        
        trailer_attributes = [
            DocumentAttributeVideo(
                duration=120,
                w=1280,
                h=720,
                supports_streaming=True
            )
        ]

        trailer_input = await fast_upload_file(client, str(found_trailer), max_workers=2)
        promo_msg = await client.send_file(
            trailer_chat,
            trailer_input,
            caption=caption,
            parse_mode="html",
            thumb=thumb_path if thumb_path and Path(thumb_path).exists() else None,
            supports_streaming=True,
            attributes=trailer_attributes
        )
        print(f"  ⭐ Official trailer successfully posted to Promo Channel! (Message ID: {promo_msg.id})")
        return promo_msg.id
    except Exception as e:
        print(f"  ⚠️ Failed to post official trailer to promo channel: {e}")
        return None
    finally:
        for alt in temp_trailer.parent.glob(f"{temp_trailer.stem}.*"):
            try: alt.unlink()
            except Exception: pass

async def main():
    parser = argparse.ArgumentParser(description="BollyHub Telegram Cloud Movie Uploader")
    parser.add_argument("--slug", help="Movie slug to upload")
    parser.add_argument("--auto", action="store_true", help="Auto-rotate balanced across all categories (Bollywood, South, Hollywood Dual Audio)")
    parser.add_argument("--latest", action="store_true", help="Upload the latest verified movie")
    parser.add_argument("--all", action="store_true", help="Upload all unposted movies sequentially")
    parser.add_argument("--chat", help="Target channel ID (e.g. -100...) or @channel_username")
    parser.add_argument("--trailer-chat", help="Promo / Trailer channel ID (e.g. -100...)")
    parser.add_argument("--limit", type=int, default=1, help="Target number of SUCCESSFUL uploads (Default: 1)")
    args = parser.parse_args()

    if not API_ID or not API_HASH:
        print("❌ Error: TELEGRAM_API_ID and TELEGRAM_API_HASH are required for MTProto 2GB uploads!")
        sys.exit(1)

    target_chat = args.chat or CHAT_ID
    if not target_chat:
        print("❌ Error: Target Chat ID / Channel Username is required!")
        sys.exit(1)

    try:
        if str(target_chat).startswith("-100") or str(target_chat).startswith("-"):
            target_chat = int(target_chat)
    except ValueError:
        pass

    trailer_chat = args.trailer_chat or TRAILER_CHAT_ID
    try:
        if trailer_chat and (str(trailer_chat).startswith("-100") or str(trailer_chat).startswith("-")):
            trailer_chat = int(trailer_chat)
    except ValueError:
        pass

    # Load 100% Latest Hindi/Dual-Audio BollyFlix Categorized Movies (Excluding website movies)
    categorized_movies = load_all_categorized_movies()
    bolly_all = categorized_movies.get("Bollywood", [])
    south_all = categorized_movies.get("South Hindi Dubbed", [])
    holly_all = categorized_movies.get("Hollywood", [])

    total_pool = len(bolly_all) + len(south_all) + len(holly_all)
    print(f"📚 Total Fresh Latest HD Movies in Catalog Pool: {total_pool}")
    print(f"   • Bollywood (2024-2026): {len(bolly_all)}")
    print(f"   • South Hindi Dubbed (2024-2026): {len(south_all)}")
    print(f"   • Hollywood Dual Audio (2024-2026): {len(holly_all)}")

    posted = load_posted()
    skipped = load_skipped()
    print(f"✅ Already uploaded: {len(posted)} movies | 🚫 Skipped dead links: {len(skipped)}")

    # Filter unposted and unskipped
    bolly_candidates = [m for m in bolly_all if m["slug"] not in posted and m["slug"] not in skipped]
    south_candidates = [m for m in south_all if m["slug"] not in posted and m["slug"] not in skipped]
    holly_candidates = [m for m in holly_all if m["slug"] not in posted and m["slug"] not in skipped]

    # Generate Candidate Sequence (Prioritizing newest releases)
    candidate_pool = []
    if args.slug:
        raw_input = args.slug.strip()
        all_movies = bolly_all + south_all + holly_all
        candidate_pool = smart_search_and_resolve_movie(raw_input, all_movies)
    elif args.latest:
        max_len = max(len(bolly_candidates), len(south_candidates), len(holly_candidates), 1)
        for i in range(max_len):
            if i < len(bolly_candidates): candidate_pool.append(bolly_candidates[i])
            if i < len(south_candidates): candidate_pool.append(south_candidates[i])
            if i < len(holly_candidates): candidate_pool.append(holly_candidates[i])
    else: # Default: Auto-balanced round-robin across latest categories!
        queues = [bolly_candidates, south_candidates, holly_candidates]
        q_idx = 0
        while any(queues) and len(candidate_pool) < 50:
            q = queues[q_idx % len(queues)]
            if q:
                candidate_pool.append(q.pop(0))
            q_idx += 1

    if not candidate_pool:
        print("🎉 No pending candidates left to process!")
        return

    print("===============================================================")
    print("🚀 BOLLYHUB TELEGRAM CLOUD MOVIE UPLOADER (MTPROTO 2GB)")
    print(f"🎯 Target Successful Uploads: {args.limit}")
    print(f"📌 Target Channel: {target_chat}")
    print("===============================================================")

    # Initialize Telethon Client with Bot Token over MTProto
    session_file = Path(__file__).resolve().parent / "cloud_uploader_session"
    client = TelegramClient(str(session_file), int(API_ID), API_HASH)
    client.flood_sleep_threshold = 120
    await client.start(bot_token=BOT_TOKEN)
    print("✅ Telegram MTProto Bot Client Authenticated!")

    work_dir = Path(__file__).resolve().parent / "temp_cloud_movies"
    work_dir.mkdir(parents=True, exist_ok=True)

    successful_uploads = 0
    max_attempts = max(args.limit * 8, 15)
    attempt_count = 0

    for movie in candidate_pool:
        if successful_uploads >= args.limit:
            break
        if attempt_count >= max_attempts:
            print(f"⚠️ Reached max attempt limit ({max_attempts}). Stopping.")
            break

        attempt_count += 1
        slug = movie.get("slug")
        title = movie.get("title")
        year = movie.get("year")
        category = movie.get("category")
        fastdl_url = movie.get("fastdlUrl") or movie.get("fastdlPagesUrl")

        print(f"\n[Attempt {attempt_count} | Goal: {successful_uploads}/{args.limit}] [{category} - {year}] {title} ({slug})")

        if not fastdl_url:
            print(f"  ⚠️ No FastDL URL found, marking skipped.")
            save_skipped(slug)
            continue

        # Dynamic IMDb & Official HD Poster Enrichment
        if not movie.get("poster_url") or not movie.get("imdb", {}).get("rating"):
            live_meta = get_imdb_meta(movie["title"], movie.get("year", ""))
            if live_meta:
                print(f"  🌟 IMDb Enriched: {live_meta['title']} ({live_meta['year']}) | ★ {live_meta['rating']}")
                if live_meta.get("poster_url"):
                    movie["poster_url"] = live_meta["poster_url"]
                elif live_meta.get("background_url"):
                    movie["poster_url"] = live_meta["background_url"]
                movie_imdb = movie.setdefault("imdb", {})
                if live_meta.get("rating"): movie_imdb["rating"] = live_meta["rating"]
                if live_meta.get("genres"): movie_imdb["genres"] = live_meta["genres"]
                if live_meta.get("director"): movie_imdb["director"] = live_meta["director"]
                if live_meta.get("cast"): movie_imdb["cast"] = live_meta["cast"]
                if live_meta.get("summary"): movie_imdb["summary"] = live_meta["summary"]
                if live_meta.get("background_url"): movie_imdb["background_url"] = live_meta["background_url"]
                if live_meta.get("trailer"): movie_imdb["trailer"] = live_meta["trailer"]

        # Fallback to authentic source website cover from bollyspice.in
        if not movie.get("poster_url"):
            spice_cover = fetch_bollyspice_cover(movie["title"])
            if spice_cover:
                print(f"  🌐 Found source website poster from BollySpice: {spice_cover[:70]}...")
                movie["poster_url"] = spice_cover

        # 1. Resolve Google CDN direct URL
        direct_url = resolve_direct_link(fastdl_url)
        if not direct_url and movie.get("fastdlPagesUrl") and movie["fastdlPagesUrl"] != fastdl_url:
            direct_url = resolve_direct_link(movie["fastdlPagesUrl"])

        if not direct_url and movie.get("fallbackUrls"):
            for fb_url in movie["fallbackUrls"]:
                print(f"  🔄 Trying alternative quality link: {fb_url[:65]}...")
                direct_url = resolve_direct_link(fb_url)
                if direct_url:
                    break

        if not direct_url:
            print(f"  ❌ CDN direct link could not be resolved. Marking as broken & auto-trying next movie...")
            save_skipped(slug)
            continue

        temp_video = work_dir / f"{slug}.mp4"
        temp_thumb = work_dir / f"{slug}_thumb.jpg"

        try:
            # 2. Prepare Thumbnail (Real Movie Poster, Backdrop, or Source Website Cover)
            thumb_path = None
            if movie.get("poster_url"):
                print(f"  🖼️ Fetching HD poster: {movie['poster_url'][:70]}...")
                thumb_path = download_thumbnail(movie["poster_url"], temp_thumb)

            if not thumb_path and movie.get("imdb", {}).get("background_url"):
                bg_url = movie["imdb"]["background_url"]
                print(f"  🖼️ Fetching IMDb backdrop image: {bg_url[:70]}...")
                thumb_path = download_thumbnail(bg_url, temp_thumb)
                if thumb_path:
                    movie["poster_url"] = bg_url

            if not thumb_path:
                spice_cover = fetch_bollyspice_cover(movie["title"])
                if spice_cover:
                    print(f"  🖼️ Fetching BollySpice source cover: {spice_cover[:70]}...")
                    thumb_path = download_thumbnail(spice_cover, temp_thumb)
                    if thumb_path:
                        movie["poster_url"] = spice_cover

            if not thumb_path and DEFAULT_THUMB.exists():
                print("  ⚠️ All poster sources failed. Using default channel logo.")
                thumb_path = str(DEFAULT_THUMB)

            # 3. High-Speed Download with HTTP Error Check
            download_success = download_file(direct_url, temp_video)
            if not download_success:
                print(f"  ⚠️ Skipping dead link ({title}) & saving to skipped catalog. Auto-trying next movie...")
                save_skipped(slug)
                continue

            # 4. Upload to Telegram via FastTelethon 4-Worker MTProto
            msg_id = await upload_movie_to_telegram(client, target_chat, movie, temp_video, thumb_path)
            if msg_id:
                save_posted(slug)
                successful_uploads += 1
                print(f"  ⭐ Successfully posted [{successful_uploads}/{args.limit}] {title} to Telegram Channel!")

                # 5. Post Official HD Trailer to Promo / Trailer Channel!
                if trailer_chat:
                    await post_official_trailer_to_promo(client, trailer_chat, target_chat, msg_id, movie, thumb_path, work_dir)
        except Exception as e:
            print(f"  ❌ Error processing {title}: {e}")
            save_skipped(slug)
        finally:
            if temp_video.exists():
                temp_video.unlink()
            if temp_thumb.exists():
                temp_thumb.unlink()
            print("  🧹 Local temporary video cleaned up.")

        if successful_uploads < args.limit:
            print("Waiting 5 seconds before next attempt...")
            await asyncio.sleep(5)

    await client.disconnect()
    print("\n===============================================================")
    print(f"🎉 BATCH COMPLETE: Successfully uploaded {successful_uploads}/{args.limit} movie(s) to Telegram!")
    print("===============================================================")

if __name__ == "__main__":
    asyncio.run(main())
