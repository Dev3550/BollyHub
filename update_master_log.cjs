const fs = require('fs');
const path = require('path');

function generateMasterLog() {
  const uploadedPath = path.join(__dirname, 'data', 'earnvid_movies_uploaded.json');
  const linksPath = path.join(__dirname, 'data', 'bollyflix_categorized_download_links.json');
  const masterJsonPath = path.join(__dirname, 'data', 'master_uploaded_movies_log.json');
  const masterMdPath = path.join(__dirname, 'data', 'MASTER_UPLOADED_MOVIES.md');

  const uploaded = fs.existsSync(uploadedPath) ? JSON.parse(fs.readFileSync(uploadedPath, 'utf8')) : [];
  const categorized = fs.existsSync(linksPath) ? JSON.parse(fs.readFileSync(linksPath, 'utf8')) : {};

  // Build lookup for fastdl source links
  const sourceMap = new Map();
  for (const cat of ['Bollywood', 'Hollywood', 'South Hindi Dubbed']) {
    if (!categorized[cat]?.qualities) continue;
    for (const q of ['720p', '480p', '1080p']) {
      const items = categorized[cat].qualities[q] || [];
      for (const item of items) {
        sourceMap.set(`${item.movieId}_${q}`, item);
      }
    }
  }

  // Load existing master log if any to never lose anything
  let masterList = [];
  if (fs.existsSync(masterJsonPath)) {
    try {
      masterList = JSON.parse(fs.readFileSync(masterJsonPath, 'utf8'));
    } catch (_) {}
  }

  const masterMap = new Map(masterList.map(m => [`${m.movieId}_${m.quality}`, m]));

  for (const item of uploaded) {
    const key = `${item.movieId}_${item.quality}`;
    const src = sourceMap.get(key);

    const record = {
      movieId: item.movieId,
      title: item.title,
      category: item.category,
      quality: item.quality,
      filecode: item.filecode,
      embedUrl: `https://morencius.com/embed/${item.filecode}`,
      streamUrl: `https://morencius.com/file/${item.filecode}`,
      downloadUrl: `https://morencius.com/d/${item.filecode}`,
      fastdlUrl: src?.fastdlUrl || '',
      gdflixUrl: src?.gdflixUrl || '',
      uploadedAt: item.uploadedAt || new Date().toISOString()
    };

    masterMap.set(key, record);
  }

  const finalMaster = Array.from(masterMap.values());
  fs.writeFileSync(masterJsonPath, JSON.stringify(finalMaster, null, 2), 'utf8');

  // Generate Markdown summary
  let md = `# 🎬 BollyHub Master Uploaded Movies Archive\n\n`;
  md += `> Persistent master registry of all movies uploaded to EarnVids. Includes direct source links so any deleted movie can be re-uploaded instantly.\n\n`;
  md += `**Total Movies in Master Registry:** \`${finalMaster.length}\`\n\n`;
  md += `| # | Movie Title | Cat | Quality | File Code | EarnVids Stream | EarnVids FastDL | Original FastDL Source |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;

  finalMaster.forEach((m, idx) => {
    const cleanTitle = m.title.replace(/\|/g, '-');
    md += `| ${idx + 1} | **${cleanTitle}** | ${m.category} | \`${m.quality}\` | \`${m.filecode}\` | [▶️ Stream](${m.streamUrl}) | [📥 FastDL](${m.downloadUrl}) | [🔗 Source Link](${m.fastdlUrl}) |\n`;
  });

  fs.writeFileSync(masterMdPath, md, 'utf8');
  console.log(`✅ Master log updated with ${finalMaster.length} movies!`);
}

generateMasterLog();
