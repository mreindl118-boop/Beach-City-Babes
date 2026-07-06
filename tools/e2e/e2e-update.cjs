// The update beacon: on a bundled/native build the relative version.json
// always matches the installed build, so the REMOTE beacon (raw repo file)
// must drive an "get the new APK" prompt instead of a useless reload loop.
const { chromium, executablePath, BASE } = require('./_pw.cjs');
const errors = [];

(async () => {
  const b = await chromium.launch({ executablePath });
  const page = await b.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('https://image.pollinations.ai/**', r => r.abort());
  await page.route('https://text.pollinations.ai/**', r => r.abort());

  // simulate the bundled-app situation: local beacon == installed build
  // (default), remote beacon is NEWER
  await page.route('https://raw.githubusercontent.com/**/version.json*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ version: '99.0.0-alpha', build: 9999 }),
  }));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#up-get', { timeout: 8000 }).catch(() => {});
  const modal = await page.$('#up-get');
  if (!modal) errors.push('remote-beacon update modal did not appear at boot');
  else {
    const txt = await page.textContent('#modal-body');
    if (!txt.includes('99.0.0-alpha')) errors.push('modal missing remote version: ' + txt.slice(0, 120));
    if (!txt.includes('APK')) errors.push('modal does not explain the APK download path');
  }

  await b.close();
  if (errors.length) { console.log('UPDATE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('UPDATE E2E PASS — bundled build detects newer remote beacon and offers the APK download');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
