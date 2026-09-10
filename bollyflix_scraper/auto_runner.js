// ==========================================================================
// BollyHub Continuous Auto-Runner & Git Push Sync Engine
// Runs scraper cluster and commits/pushes fresh data to GitHub automatically
// ==========================================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function gitPushUpdates() {
  try {
    const status = execSync('git status --porcelain', { cwd: path.resolve(__dirname, '..') }).toString();
    if (status.trim().length > 0) {
      console.log('\n🚀 [Auto-Sync] Committing and pushing fresh scraped movies to GitHub...');
      execSync('git add data/movies.json data/checkpoint_urls.json', { cwd: path.resolve(__dirname, '..') });
      execSync('git commit -m "Auto-update: Fresh movies & 1-click FastDL links scraped [skip ci]"', { cwd: path.resolve(__dirname, '..') });
      execSync('git push origin main', { cwd: path.resolve(__dirname, '..') });
      console.log('✅ [Auto-Sync] Successfully pushed fresh data to GitHub!\n');
    }
  } catch (e) {
    console.error('[Auto-Sync] Git push notice:', e.message);
  }
}

async function startAutoRunner() {
  console.log('==================================================================');
  console.log('  🎬 BOLLYHUB AUTOMATED SCRAPER & GIT SYNC ENGINE STARTED');
  console.log('==================================================================');

  // Periodically check and git push every 2 minutes
  setInterval(() => {
    gitPushUpdates();
  }, 2 * 60 * 1000);

  // Require and run cluster scraper
  require('./scraper_cluster.js');
}

startAutoRunner();
