// D:\BollyHub\earnvid-uploader.mjs
// BollyHub Automated BollyFlix -> EarnVids Cloud Stream & Download Uploader
// Resolves BollyFlix FastDL / Google Drive redirects automatically into direct Google CDN video URLs
// and pushes them directly into your EarnVids monetization account.

import * as cheerio from 'cheerio';

const EARNVIDS_KEY = process.env.EARNVIDS_KEY || '48914lqe3hwneiukt644z';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

/**
 * 1. Automatically resolve FastDL / GDFlix link into direct Google CDN stream URL
 * FastDL -> gdflix.dev -> new10.gdflix.io -> Instant DL -> fastdl-one.pages.dev/?url=...
 */
export async function resolveDirectGoogleCdnUrl(fastDlServerUrl) {
  try {
    let currentUrl = fastDlServerUrl;
    let stepCount = 0;
    while (stepCount < 6) {
      stepCount++;
      const res = await fetch(currentUrl, { headers, redirect: 'manual' });
      if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
        const loc = res.headers.get('location');
        if (!loc) break;
        currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href;
      } else if (res.status === 200) {
        const html = await res.text();
        const $ = cheerio.load(html);
        let instadlLink = '';
        $('a').each((_, a) => {
          const txt = $(a).text().trim();
          const href = $(a).attr('href');
          if (href && (txt.includes('Instant DL') || href.includes('instadl.rest'))) {
            instadlLink = href;
          }
        });

        if (!instadlLink) return null;

        const dlRes = await fetch(instadlLink, {
          headers: { ...headers, Referer: currentUrl },
          redirect: 'manual'
        });
        const dlLoc = dlRes.headers.get('location');
        if (dlLoc) {
          const u = new URL(dlLoc);
          return u.searchParams.get('url') || dlLoc;
        }
        return null;
      } else {
        break;
      }
    }
    return null;
  } catch (err) {
    console.error('Resolver error:', err.message);
    return null;
  }
}

/**
 * 2. Upload Direct Remote URL to EarnVids
 */
export async function uploadRemoteUrl(directVideoUrl, title = '') {
  const url = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directVideoUrl)}` + 
    (title ? `&title=${encodeURIComponent(title)}` : '');

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 200 && data.result) {
      console.log(`✅ Upload Queued: "${title || directVideoUrl}"`);
      console.log(`📁 Filecode: ${data.result.filecode}`);
      console.log(`🎬 Embed URL: https://morencius.com/e/${data.result.filecode}`);
      return data.result.filecode;
    } else {
      console.error(`❌ EarnVids Error for "${title}":`, data.msg || data);
      return null;
    }
  } catch (err) {
    console.error(`❌ Network error:`, err.message);
    return null;
  }
}

/**
 * 3. Check Queue Status of active URL uploads
 */
export async function checkUploadQueue() {
  try {
    const res = await fetch(`https://earnvids.com/api/file/url_uploads?key=${EARNVIDS_KEY}`);
    const data = await res.json();
    return data.result || [];
  } catch (err) {
    console.error('Queue check error:', err.message);
    return [];
  }
}

/**
 * 4. List all processed files in EarnVids account
 */
export async function listAccountFiles() {
  try {
    const res = await fetch(`https://earnvids.com/api/file/list?key=${EARNVIDS_KEY}`);
    const data = await res.json();
    return data.result?.files || [];
  } catch (err) {
    console.error('List files error:', err.message);
    return [];
  }
}

/**
 * 5. Clear failed items in upload queue
 */
export async function deleteQueueErrors() {
  try {
    const res = await fetch(`https://earnvids.com/api/file/url_actions?key=${EARNVIDS_KEY}&delete_errors=1`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Delete queue errors failed:', err.message);
    return null;
  }
}

// Check status if executed directly
if (process.argv[1]?.endsWith('earnvid-uploader.mjs')) {
  console.log('📊 Fetching current EarnVids status...');
  Promise.all([checkUploadQueue(), listAccountFiles()]).then(([queue, files]) => {
    console.log(`\nActive Queue (${queue.length}):`, queue);
    console.log(`\nAccount Files (${files.length}):`, files.map(f => ({
      file_code: f.file_code,
      title: f.title,
      canplay: f.canplay,
      link: f.link
    })));
  });
}
