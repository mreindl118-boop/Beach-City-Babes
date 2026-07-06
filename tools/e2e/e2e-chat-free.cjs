// Prove generative chat works BY DEFAULT (no key): intercept the free text
// endpoint, verify the NPC's spoken reply comes from the "LLM", carries the
// persona system prompt (facts + world + continuity rules), still moves the
// stat meters, and that phone texts are generative too.
const { chromium, executablePath, BASE } = require('./_pw.cjs');
const SHOT = process.env.SHOT_DIR;
const errors = [];

(async () => {
  const b = await chromium.launch({ executablePath });
  const page = await b.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const imgPrompts = [];
  await page.route('https://image.pollinations.ai/**', route => {
    imgPrompts.push(decodeURIComponent(route.request().url()));
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });

  const calls = [];
  let slowNext = false; // when set, delay the next reply to widen the race window
  await page.route('https://text.pollinations.ai/**', route => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push(body);
    const reply = slowNext
      ? { delay: 1800, text: 'A slow generated reply that must land in the SENDER’s log. 🐢' }
      : { delay: 0, text: 'Mmm, a free generated reply just for you, sunshine. 😏' };
    slowNext = false;
    setTimeout(() => route.fulfill({ status: 200, contentType: 'text/plain', body: reply.text }), reply.delay);
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  const gate = await page.$('#age-yes'); if (gate) await gate.click();
  await page.click('[data-new="1"]');
  await page.waitForSelector('#cc-roles .role-card');
  await page.fill('#cc-name', 'Ava');
  await page.click('[data-r="artist"]');
  await page.click('#cc-go');
  await page.waitForSelector('#portrait-box svg.portrait, #portrait-box img.portrait-ext');
  await page.waitForTimeout(300);

  // 1. typed chat, ZERO configuration → generative reply
  const before = await page.$eval('#meter-aff .val', el => +el.textContent);
  await page.fill('#chat-input', 'hey! you have amazing style, what do you do?');
  await page.click('#chat-send');
  await page.waitForTimeout(1300);
  const log1 = await page.textContent('#chat-log');
  if (!log1.includes('free generated reply')) errors.push('default chat not generative; log=' + log1.slice(-200));
  const after = await page.$eval('#meter-aff .val', el => +el.textContent);
  if (after <= before) errors.push(`stats not driven by typed chat (aff ${before} → ${after})`);

  // 2. the system prompt must carry persona + world + continuity rules
  const sys = calls[0]?.messages?.find(m => m.role === 'system')?.content || '';
  for (const need of ['Beach City', 'Personality', 'Job:', 'mood', 'CONVERSATION RULES', 'TONE CEILING']) {
    if (!sys.includes(need)) errors.push(`system prompt missing "${need}"`);
  }
  if (!calls[0].messages.some(m => m.role === 'user')) errors.push('no user message sent');

  // 3. continuity: second message must include the first exchange as history
  await page.fill('#chat-input', 'so what would you paint if I posed for you?');
  await page.click('#chat-send');
  await page.waitForTimeout(1300);
  const hist = calls[1]?.messages || [];
  if (!hist.some(m => m.role === 'assistant' && m.content.includes('free generated reply')))
    errors.push('second call missing prior assistant turn — no conversation memory');

  // 4. phone texts are generative too
  await page.click('[data-action="phone"]');
  await page.waitForSelector('[data-contact]');
  await page.click('[data-contact]');
  await page.waitForSelector('[data-kind]');
  const nCalls = calls.length;
  await page.click('[data-kind="sweet"]');
  await page.waitForTimeout(1400);
  const logT = await page.textContent('#chat-log');
  if (calls.length <= nCalls) errors.push('phone text did not hit the generative provider');
  else {
    const sysT = calls[calls.length - 1].messages.find(m => m.role === 'system')?.content || '';
    if (!sysT.includes('TEXT MESSAGE')) errors.push('phone text persona missing texting register');
  }
  if (!logT.includes('free generated reply')) errors.push('phone reply not generative; log=' + logT.slice(-200));
  await page.screenshot({ path: `${SHOT}/chat-free.png` });

  // 4b. TEXTING MODE: send the active NPC across town — chat flips to SMS mode
  // with a banner, typed messages become texts, replies come back with 📱
  const farId = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const a = raw.npcs.find(n => n.id === raw.activeId);
    a.schedule = {};
    ['dawn', 'morning', 'afternoon', 'evening', 'night', 'late'].forEach(ph => a.schedule[ph] = 'club');
    raw.player.location = 'beach'; raw.player.hour = 10;
    raw.player.textsSent = {};
    a.affection = 40; a.desire = 90; a.boldness = 1; // tier 1+, eager → pic chip shows
    localStorage.setItem('bcb_slot_1', JSON.stringify(raw));
    return a.id;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-load="1"]');
  await page.waitForTimeout(600);
  // the game focuses whoever is PRESENT on load — deliberately switch to the
  // faraway one via the roster to enter texting mode
  await page.click('[data-action="roster"]');
  await page.waitForSelector('[data-npc]');
  await page.click(`[data-npc="${farId}"]`);
  await page.waitForTimeout(500);
  const bannerCls = await page.$eval('#chat-banner', el => el.className).catch(() => '');
  if (bannerCls !== 'texting') errors.push('texting banner not active when apart, class=' + bannerCls);
  const ph = await page.$eval('#chat-input', el => el.placeholder);
  if (!ph.includes('📱')) errors.push('texting placeholder missing: ' + ph);
  await page.fill('#chat-input', 'wish you were here with me');
  await page.click('#chat-send');
  await page.waitForTimeout(1300);
  const logX = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return (raw.logs[raw.activeId] || []).map(e => e.text).join('|');
  });
  if (!logX.includes('📱 wish you were here')) errors.push('typed message while apart not sent as text');
  if (!logX.includes('📱 Mmm, a free generated reply')) errors.push('texted reply missing 📱 prefix: ' + logX.slice(-200));

  // 4c. PICTURE TEXTING: the 📸 chip requests a selfie; the selfie prompt goes
  // through the art pipeline and an <img> picture message lands in the thread
  const picChip = await page.$('[data-chip="pic"]');
  if (!picChip) errors.push('📸 Ask-for-a-pic chip missing in texting mode');
  else {
    const nImg = imgPrompts.length;
    await picChip.click();
    await page.waitForTimeout(1500);
    const gotPic = await page.$('#chat-log .bubble.pic img.chat-pic');
    const refusal = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
      return /Earn it|Not yet|Bold of you/.test((raw.logs[raw.activeId] || []).map(e => e.text).join('|'));
    });
    if (!gotPic && !refusal) errors.push('pic request produced neither a picture message nor a refusal');
    if (gotPic) {
      const selfiePrompt = imgPrompts.slice(nImg).find(u => u.includes('phone selfie'));
      if (!selfiePrompt) errors.push('selfie generation did not use a selfie-framed prompt');
    }
    await page.screenshot({ path: `${SHOT}/chat-picture.png` });
  }

  // 4d. REQUEST-DRIVEN selfies: "let me see you smiling at the tiki lounge…"
  // must translate into whitelisted prompt attributes (never the raw text)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const a = raw.npcs.find(n => n.id === raw.activeId) || raw.npcs[0];
    raw.player.textsSent = {};
    a.affection = 80; a.desire = 95; a.boldness = 1;
    localStorage.setItem('bcb_slot_1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-load="1"]');
  await page.waitForTimeout(500);
  await page.click('[data-action="roster"]');
  await page.waitForSelector('[data-npc]');
  await page.click(`[data-npc="${farId}"]`);
  await page.waitForTimeout(400);
  const nReq = imgPrompts.length;
  await page.fill('#chat-input', 'let me see you smiling at the tiki lounge with a drink 📸');
  await page.click('#chat-send');
  await page.waitForTimeout(1800);
  const wishLog = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return (raw.logs[raw.activeId] || []).map(e => e.text + (e.img ? '[IMG]' : '')).join('|');
  });
  const wishRefused = /Earn it|Not yet|Bold of you/.test(wishLog);
  // the session-dynamic PORTRAIT also regenerates in the background — assert
  // on selfie-framed prompts only
  const wishPrompt = imgPrompts.slice(nReq).find(u => u.includes('phone selfie') && u.includes('holding a colorful drink'));
  if (!wishPrompt && !wishRefused) errors.push('typed pic request produced neither wish-selfie nor refusal: ' + wishLog.slice(-160));
  if (wishPrompt) {
    for (const need of ['bright warm smile', 'tiki lounge']) {
      if (!wishPrompt.includes(need)) errors.push(`wish attribute missing from selfie prompt: "${need}"`);
    }
    if (wishPrompt.includes('let me see you')) errors.push('raw request text leaked into image prompt');
  }

  // explicit asks NEVER generate a selfie — the character holds the boundary
  // renderLog re-renders re-request the same selfie URL — count UNIQUE prompts
  const selfieCount = () => new Set(imgPrompts.filter(u => u.includes('phone selfie'))).size;
  const nExp = selfieCount();
  await page.fill('#chat-input', 'send me a nude pic');
  await page.click('#chat-send');
  await page.waitForTimeout(1200);
  if (selfieCount() > nExp) errors.push('explicit ask reached the selfie pipeline');
  const expLog = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return (raw.logs[raw.activeId] || []).slice(-3).map(e => e.text).join('|');
  });
  if (!/Swimsuit|cute no|bikini/.test(expLog)) errors.push('explicit ask missing boundary reply: ' + expLog);

  // 5. RACE REGRESSION: reply must land in the SENDER's log even if the player
  // switches to another NPC while the request is in flight (via roster — the
  // approach chips are disabled during awaitingReply by design).
  // bring the far NPC back in person (and reset text limits) for the race test
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const a = raw.npcs.find(n => n.id === raw.activeId);
    a.schedule = {};
    ['dawn', 'morning', 'afternoon', 'evening', 'night', 'late'].forEach(ph => a.schedule[ph] = 'beach');
    raw.player.location = 'beach'; raw.player.hour = 10;
    raw.player.textsSent = {};
    localStorage.setItem('bcb_slot_1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-load="1"]');
  await page.waitForTimeout(500);
  const senderId = await page.evaluate(() => JSON.parse(localStorage.getItem('bcb_slot_1')).activeId);
  slowNext = true;
  await page.fill('#chat-input', 'tell me a secret');
  await page.click('#chat-send');
  await page.waitForTimeout(250); // request now in flight
  const chipDisabled = await page.$eval('[data-approach]', el => el.disabled).catch(() => null);
  if (chipDisabled === false) errors.push('approach chips not disabled while a reply is in flight');
  await page.click('[data-action="roster"]');
  await page.waitForSelector('[data-npc]');
  const otherId = await page.$$eval('[data-npc]', (els, sid) =>
    els.map(e => e.dataset.npc).find(id => id !== sid), senderId);
  await page.click(`[data-npc="${otherId}"]`);
  await page.waitForTimeout(2600); // slow reply resolves after the switch
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('bcb_slot_1')).logs);
  const inSender = (logs[senderId] || []).some(e => e.text.includes('slow generated reply'));
  const inOther = (logs[otherId] || []).some(e => e.text.includes('slow generated reply'));
  if (!inSender) errors.push('race: slow reply missing from the sender’s log');
  if (inOther) errors.push('race: slow reply cross-wired into the wrong NPC’s log');

  await b.close();
  if (errors.length) { console.log('FREE-CHAT ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('FREE-CHAT E2E PASS — zero-config generative replies, continuity, stats, texting mode, picture texting incl. request-driven selfies + boundary, race-safe routing');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
