// Shared Playwright bootstrap for the e2e suite. Works in the cloud sandbox
// (system playwright + pinned chromium) and locally (npm i -D playwright).
const fs = require('fs');
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('playwright not found — run: npm i -D playwright && npx playwright install chromium');
}
const { chromium } = loadPlaywright();
const executablePath = process.env.BCB_CHROMIUM
  || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const BASE = process.env.BCB_URL || 'http://localhost:8765/';
module.exports = { chromium, executablePath, BASE };
