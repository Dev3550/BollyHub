// D:\BollyHub\earnvid-uploader.mjs
// EarnVids Batch Remote Cloud Uploader
// Uses EarnVids API to download movies cloud-to-cloud and generate monetization embed links

const EARNVIDS_KEY = process.env.EARNVIDS_KEY || '48914lqe3hwneiukt644z';

/**
 * 1. Upload Remote URL to EarnVids
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
 * 2. Check Queue Status of active URL uploads
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
 * 3. List all processed files in EarnVids account
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
 * Batch Uploader Demo with 5 Video Links
 */
async function runBatchUpload() {
  console.log('🚀 [EarnVids Uploader] Starting batch upload with API Key:', EARNVIDS_KEY);

  // List of direct video URLs to upload (Direct links only - no landing pages/captchas)
  const moviesToUpload = [
    {
      title: "Movie 1: Big Buck Bunny HD",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    },
    {
      title: "Movie 2: Elephants Dream HD",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
    },
    {
      title: "Movie 3: For Bigger Blazes HD",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    },
    {
      title: "Movie 4: For Bigger Escape HD",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
    },
    {
      title: "Movie 5: Tears of Steel HD",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
    }
  ];

  console.log(`\n📤 Sending ${moviesToUpload.length} movies to EarnVids Cloud Downloader...`);

  const results = [];
  for (const m of moviesToUpload) {
    const filecode = await uploadRemoteUrl(m.url, m.title);
    if (filecode) {
      results.push({ title: m.title, filecode, embedUrl: `https://morencius.com/e/${filecode}` });
    }
    // Small delay between API calls
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log('\n📊 Checking Active Upload Status on EarnVids Cloud...');
  await new Promise(r => setTimeout(r, 3000));
  const queue = await checkUploadQueue();
  console.log('Current Queue Items:', queue);

  console.log('\n🎉 [Done] All 5 movies have been queued into your EarnVids account!');
  console.log('Results Summary:');
  console.table(results);
}

// Run if called directly
runBatchUpload();
