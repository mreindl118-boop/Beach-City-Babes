// Prove the generative AI-art path: default mode is Pollinations (no key).
// Intercept image.pollinations.ai with a canned PNG and verify the sticker
// placeholder swaps to a generated <img class="portrait-ext">, that the prompt
// URL carries the character's genes, and that switching to "Off" restores SVG.
const { chromium, executablePath, BASE } = require('./_pw.cjs');
const SHOT = process.env.SHOT_DIR;
const errors = [];

// a valid 1x1 PNG (base64) — scaled to fill by CSS; proves the <img> swap
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64');

(async () => {
  const b = await chromium.launch({ executablePath });
  const page = await b.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  page.on('pageerror', e => { console.log('PAGEERR', e.message); errors.push('pageerror: ' + e.message); });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });

  const seenPrompts = [];
  await page.route('https://image.pollinations.ai/**', route => {
    try { seenPrompts.push(decodeURIComponent(route.request().url())); } catch { seenPrompts.push(route.request().url()); }
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  const gate = await page.$('#age-yes'); if (gate) await gate.click();
  await page.click('[data-new="1"]');
  await page.waitForSelector('#cc-roles .role-card');
  await page.fill('#cc-name', 'Ava');
  await page.click('[data-r="artist"]');
  await page.click('#cc-go');

  // the sticker placeholder renders, then the generated image swaps in over it
  // (the swap can be near-instant with a fast provider, so assert on the <img>)
  await page.waitForSelector('#portrait-box img.portrait-ext', { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOT}/art-generated.png` });

  if (!seenPrompts.length) errors.push('pollinations never called');
  const p = seenPrompts[0] || '';
  for (const need of ['anime', 'hair', 'eyes', 'swimwear', 'seed=']) {
    if (!p.includes(need)) errors.push(`prompt missing "${need}": ${p.slice(0, 160)}`);
  }
  // session-dynamic: the first look carries the live scene — whichever location
  // the session starts at (wherever the first NPC is), lit for 9am
  const BACKDROPS = /turquoise water|fishing pier|smoothie hut|ferris wheel|beach gym|art studio|tiki lounge|night market|dance club|boutique|clinic lobby|living room/;
  if (!BACKDROPS.test(p)) errors.push('prompt missing session location backdrop: ' + p.slice(0, 200));
  if (!p.includes('morning sun')) errors.push('prompt missing session time-of-day lighting');

  // DYNAMIC TO THE SESSION #1 — emotion: pump desire so emotionFor() flips to
  // 'love'; the next portrait must be a NEW generation with the new expression
  const nBefore = seenPrompts.length;
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const a = raw.npcs.find(n => n.id === raw.activeId);
    a.desire = 65; a.affection = 40; a.mood = 1;
    localStorage.setItem('bcb_slot_1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-load="1"]');
  await page.waitForSelector('#portrait-box img.portrait-ext', { timeout: 10000 });
  const pLove = seenPrompts[seenPrompts.length - 1] || '';
  if (seenPrompts.length <= nBefore) errors.push('emotion change did not trigger a new generation');
  else if (!pLove.includes('loving gaze')) errors.push('new emotion missing from prompt: ' + pLove.slice(0, 200));

  // DYNAMIC TO THE SESSION #2 — location: travel somewhere else; the backdrop
  // in the prompt must follow the session there
  const nBefore2 = seenPrompts.length;
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const a = raw.npcs.find(n => n.id === raw.activeId);
    raw.player.location = 'tiki'; raw.player.hour = 20; // evening at the Tiki Lounge
    a.schedule = {};
    ['dawn', 'morning', 'afternoon', 'evening', 'night', 'late'].forEach(ph => a.schedule[ph] = 'tiki');
    localStorage.setItem('bcb_slot_1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-load="1"]');
  await page.waitForSelector('#portrait-box img.portrait-ext', { timeout: 10000 });
  const pTiki = seenPrompts[seenPrompts.length - 1] || '';
  if (seenPrompts.length <= nBefore2) errors.push('location change did not trigger a new generation');
  else {
    if (!pTiki.includes('tiki lounge')) errors.push('new location missing from prompt: ' + pTiki.slice(0, 200));
    if (!pTiki.includes('sunset light')) errors.push('evening lighting missing from prompt: ' + pTiki.slice(0, 200));
  }

  // switch to Off via menu → should restore the drawn SVG
  await page.click('#btn-menu');
  await page.waitForSelector('#m-art');
  await page.click('#m-art');
  await page.waitForSelector('#art-mode');
  await page.selectOption('#art-mode', 'off');
  await page.click('#art-save');
  await page.waitForTimeout(400);
  const hasSvg = await page.$('#portrait-box svg.portrait');
  const stillImg = await page.$('#portrait-box img.portrait-ext');
  if (!hasSvg || stillImg) errors.push('Off mode did not restore drawn SVG');
  await page.screenshot({ path: `${SHOT}/art-off.png` });

  await b.close();
  if (errors.length) { console.log('ART ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('ART E2E PASS — gene-rich prompt, session-dynamic emotion/location/lighting regeneration, Off restores SVG');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
