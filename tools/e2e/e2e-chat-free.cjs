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
  await page.route('https://image.pollinations.ai/**', route => route.abort());

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
  await page.waitForSelector('#portrait-box svg.portrait');
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

  // 5. RACE REGRESSION: reply must land in the SENDER's log even if the player
  // switches to another NPC while the request is in flight (via roster — the
  // approach chips are disabled during awaitingReply by design).
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
  console.log('FREE-CHAT E2E PASS — zero-config generative replies, persona+world prompt, history continuity, stats driven, phone texts generative, race-safe routing');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
