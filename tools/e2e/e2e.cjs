// Alpha smoke test: drive the whole game loop headlessly and screenshot it.
const { chromium, executablePath, BASE } = require('./_pw.cjs');

const SHOT = process.env.SHOT_DIR || '.';
const errors = [];

(async () => {
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  // ignore expected resource-load failures (the generative-art provider is
  // unreachable in the sandbox; the game falls back to the drawn SVG)
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|ERR_FAILED|ERR_TUNNEL/.test(t)) return;
    errors.push('console: ' + t);
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  // isolate the game loop from the default generative-art provider: simulate a
  // network where it's unreachable, so the drawn SVG fallback is exercised.
  await page.route('https://image.pollinations.ai/**', route => route.abort());
  await page.route('https://text.pollinations.ai/**', route => route.abort());

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOT}/01-title.png` });

  // age gate → title
  await page.click('#age-yes');
  await page.waitForSelector('#slot-list .slot-card');
  await page.screenshot({ path: `${SHOT}/02-slots.png` });

  // new game → creator
  await page.click('[data-new="1"]');
  await page.waitForSelector('#cc-roles .role-card');
  await page.fill('#cc-name', 'Riley');
  await page.click('#cc-trans-btn');                       // trans player
  await page.click('[data-p="they"]');                     // they/them
  await page.click('[data-r="musician"]');                 // role with Serenade
  await page.screenshot({ path: `${SHOT}/03-creator.png` });
  await page.click('#cc-go');

  // game starts
  await page.waitForSelector('#portrait-box svg.portrait');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT}/04-game.png` });

  // talk: type free-text messages, expect generative replies
  const lines = [
    'hey there!',
    'you have a really gorgeous smile',
    'what do you do for work?',
    'haha you are hilarious',
    'tell me about where you grew up',
    'want to grab a smoothie sometime?',
  ];
  for (const line of lines) {
    const disabled = await page.$eval('#chat-input', el => el.disabled).catch(() => true);
    if (disabled) break;
    await page.fill('#chat-input', line);
    await page.click('#chat-send');
    await page.waitForTimeout(750);
    const warm = await page.$('#choices .choice.warm');
    if (warm) { await warm.click(); await page.waitForTimeout(650); }
  }
  const bubbles = await page.$$eval('#chat-log .bubble.me', els => els.length);
  if (bubbles < 3) errors.push('typed chat: player bubbles missing, got ' + bubbles);
  await page.screenshot({ path: `${SHOT}/05-chat.png` });

  // gift
  await page.click('[data-action="gift"]');
  await page.waitForSelector('.shop-item');
  const gift = await page.$('.shop-item:not(.off)');
  await gift.click();
  await page.waitForTimeout(700);

  // date
  await page.click('[data-action="date"]');
  await page.waitForSelector('.shop-item');
  const act = await page.$('.shop-item:not(.off)');
  await act.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT}/06-after-date.png` });

  // hustle: work a shift
  await page.click('[data-action="hustle"]');
  await page.waitForSelector('[data-hustle]');
  await page.click('[data-hustle="shift"]');
  await page.waitForTimeout(300);

  // boosts: buy + use liquid courage via inventory
  await page.click('[data-action="items"]');
  await page.waitForSelector('#to-boosts');
  await page.click('#to-boosts');
  await page.waitForSelector('[data-boost="courage"]');
  await page.click('[data-boost="courage"]');
  await page.waitForTimeout(200);
  await page.click('#to-inventory');
  await page.waitForSelector('[data-use="courage"]');
  await page.click('[data-use="courage"]');
  await page.waitForTimeout(300);

  // sleep → day 2, proactive texts roll
  await page.click('[data-action="sleep"]');
  await page.waitForTimeout(400);

  // phone: open, try to text someone sweet
  await page.click('[data-action="phone"]');
  await page.waitForSelector('[data-contact]');
  await page.screenshot({ path: `${SHOT}/07-phone.png` });
  await page.click('[data-contact]');
  await page.waitForSelector('[data-kind]');
  await page.click('[data-kind="sweet"]');
  await page.waitForTimeout(900);

  // travel: open the graphic map and go somewhere open right now
  await page.click('[data-action="travel"]');
  await page.waitForSelector('.citymap .map-hot');
  await page.screenshot({ path: `${SHOT}/08-map.png` });
  const dest = await page.$('.map-hot:not(.closed):not(.here)');
  if (dest) { await dest.click(); await page.waitForTimeout(700); }
  else { await page.click('#modal'); }
  await page.screenshot({ path: `${SHOT}/08b-arrived.png` });

  // roster
  await page.click('[data-action="roster"]');
  await page.waitForSelector('[data-npc]');
  await page.screenshot({ path: `${SHOT}/09-roster.png` });
  await page.click('[data-npc]');
  await page.waitForTimeout(500);

  // force finale: pump stats via console for the alpha test
  await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
  });
  // cheat through the exposed state by simulating: set meters via localStorage then reload
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const active = raw.npcs.find(n => n.id === raw.activeId);
    active.affection = 90; active.desire = 90;
    active.attractedTo = ['woman', 'man', 'enby'];
    // force co-location so the finale target is present
    active.walkedToday = false; active.schedule = {};
    ['dawn', 'morning', 'afternoon', 'evening', 'night', 'late'].forEach(p => active.schedule[p] = 'beach');
    raw.player.location = 'beach'; raw.player.hour = 10;
    localStorage.setItem('bcb_slot_1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-load="1"]');
  await page.waitForSelector('#portrait-box svg.portrait');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT}/10-finale-ready.png` });
  await page.waitForSelector('#btn-finale:not(.hidden)', { timeout: 5000 });
  await page.click('#btn-finale', { force: true });
  await page.waitForSelector('.finale-svg');
  await page.waitForTimeout(9500);                      // let the kiss land
  await page.screenshot({ path: `${SHOT}/11-finale.png` });
  await page.waitForSelector('#finale-done:not(.hidden)', { timeout: 20000 });
  await page.click('#finale-done');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT}/12-morning-after.png` });

  // save survives reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-load="1"]');
  const slotText = await page.textContent('#slot-list');
  if (!slotText.includes('1 heart')) errors.push('heartsWon not persisted: ' + slotText.trim());

  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('E2E PASS — full loop: create → chat → gift → date → hustle → boost → sleep → phone → meet → finale → persist');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
