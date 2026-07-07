// Scenario test: DTR → exclusive → cheat → confrontation → stray → forgive →
// poly group hangout → old-save migration. State is injected via localStorage.
const { chromium, executablePath, BASE } = require('./_pw.cjs');
const SHOT = process.env.SHOT_DIR || '.';
const errors = [];

async function boot(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const gate = await page.$('#age-yes');
  if (gate && await gate.isVisible()) await gate.click();
}

async function loadSlot(page) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-load="1"]');
  await page.waitForSelector('#portrait-box svg.portrait, #portrait-box img', { timeout: 5000 });
  await page.waitForTimeout(500);
}

function edit(page, fn) {
  return page.evaluate(fnStr => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    (new Function('S', fnStr))(S);
    // force the active NPC co-located so scenes play out deterministically
    const a = S.npcs.find(n => n.id === S.activeId);
    if (a) {
      a.walkedToday = false; a.schedule = {};
      ['dawn', 'morning', 'afternoon', 'evening', 'night', 'late'].forEach(p => a.schedule[p] = 'beach');
    }
    S.player.location = 'beach'; S.player.hour = 10;
    localStorage.setItem('bcb_slot_1', JSON.stringify(S));
  }, fn);
}

(async () => {
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|ERR_FAILED|ERR_TUNNEL/.test(t)) return;
    errors.push('console: ' + t);
  });
  await page.route('https://image.pollinations.ai/**', route => route.abort());
  await page.route('https://text.pollinations.ai/**', route => route.abort());

  await boot(page);
  // fresh run: make a game in slot 1
  const hasSave = await page.$('[data-load="1"]');
  if (!hasSave) {
    await page.click('[data-new="1"]');
    await page.waitForSelector('#cc-roles .role-card');
    await page.fill('#cc-name', 'Sam');
    await page.click('[data-r="chef"]');
    await page.click('#cc-go');
    await page.waitForSelector('#portrait-box svg.portrait');
  } else {
    await loadSlot(page);
  }
  await page.waitForTimeout(400);

  // --- 1. DTR: force tier 2, mono, interested; expect Heart-to-heart ---
  await edit(page, `
    const c = S.npcs.find(n => n.id === S.activeId);
    c.affection = 60; c.desire = 30; c.relStyle = 'mono'; c.agreement = 'none';
    c.pendingConfront = false; c.pendingCheatConfess = false; c.pendingDTR = false;
    c.pendingPriority = false; c.pendingReconcile = false; c.jealousy = 0; c.estranged = false;
    c.attractedTo = ['woman','man','enby']; c.mood = 1; c.guilt = 0; c.suspicion = 0;
  `);
  await loadSlot(page);
  // typing a DTR phrase should open the relationship talk
  await page.fill('#chat-input', 'what are we? are we exclusive?');
  await page.click('#chat-send');
  await page.waitForSelector('[data-scene="exclusive"]', { timeout: 4000 }).catch(() => {});
  const dtrOpen = await page.$('[data-scene="exclusive"]');
  if (!dtrOpen) errors.push('DTR: typed phrase did not open the relationship talk');
  else {
    await page.screenshot({ path: `${SHOT}/d1-dtr.png` });
    // answer the DTR by TYPING instead of tapping
    await page.fill('#chat-input', 'just you and me, only you');
    await page.click('#chat-send');
    await page.waitForTimeout(600);
    const agreed = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('bcb_slot_1')).npcs.find(n => n.id === JSON.parse(localStorage.getItem('bcb_slot_1')).activeId).agreement);
    if (agreed !== 'exclusive') errors.push('DTR: typed exclusive answer did not set agreement, got ' + agreed);
  }

  // --- 2. Confrontation: inject pendingConfront, expect scene on load ---
  await edit(page, `
    const c = S.npcs.find(n => n.id === S.activeId);
    c.agreement = 'exclusive'; c.guilt = 2; c.suspicion = 1; c.pendingConfront = true; c.strikes = 0;
  `);
  await loadSlot(page);
  await page.waitForSelector('[data-scene="apologize"]', { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/d2-confront.png` });
  await page.click('[data-scene="apologize"]');
  await page.waitForTimeout(600);
  let st = await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return S.npcs.find(n => n.id === S.activeId);
  });
  if (st.pendingConfront) errors.push('Confront: pendingConfront not cleared after apologize');
  if (st.strikes !== 1) errors.push('Confront: strikes expected 1, got ' + st.strikes);
  if (st.guilt !== 0 || st.suspicion !== 0) errors.push('Confront: guilt/suspicion not reset');

  // --- 3. Ultimatum: confess while exclusive → choose them ---
  await edit(page, `
    const c = S.npcs.find(n => n.id === S.activeId);
    c.agreement = 'exclusive'; c.guilt = 2; c.suspicion = 1; c.pendingConfront = true;
  `);
  await loadSlot(page);
  await page.waitForSelector('[data-scene="confess"]', { timeout: 5000 });
  await page.click('[data-scene="confess"]');
  await page.waitForSelector('[data-scene="them"]', { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/d3-ultimatum.png` });
  await page.click('[data-scene="them"]');
  await page.waitForTimeout(600);
  st = await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return S.npcs.find(n => n.id === S.activeId);
  });
  if (st.pendingConfront) errors.push('Ultimatum: pendingConfront not cleared');
  if (st.agreement !== 'exclusive') errors.push('Ultimatum-them: agreement should stay exclusive, got ' + st.agreement);

  // --- 4. Stray confession → forgive ---
  await edit(page, `
    const c = S.npcs.find(n => n.id === S.activeId);
    c.pendingCheatConfess = true; c.loyal = false;
  `);
  await loadSlot(page);
  await page.waitForSelector('[data-scene="forgive"]', { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/d4-stray.png` });
  await page.click('[data-scene="forgive"]');
  await page.waitForTimeout(600);
  st = await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return S.npcs.find(n => n.id === S.activeId);
  });
  if (!st.loyal) errors.push('Stray: forgive did not set loyal');
  if (st.pendingCheatConfess) errors.push('Stray: pendingCheatConfess not cleared');

  // --- 5. Group hangout: two poly/open flames with chemistry ---
  await edit(page, `
    const [a, b] = S.npcs;
    S.activeId = a.id;
    a.relStyle = 'poly'; a.agreement = 'open'; a.affection = 50; a.mood = 1;
    a.attractedTo = ['woman','man','enby']; a.pendingConfront = false; a.pendingDTR = false; a.pendingCheatConfess = false;
    a.pendingPriority = false; a.pendingReconcile = false; a.jealousy = 0; a.estranged = false;
    b.pendingPriority = false; b.pendingReconcile = false; b.jealousy = 0; b.estranged = false;
    b.relStyle = 'poly'; b.agreement = 'open'; b.affection = 40; b.mood = 1;
    b.attractedTo = ['woman','man','enby']; b.gender = 'woman'; b.pendingConfront = false; b.pendingDTR = false;
    a.chem = {}; a.chem[b.id] = true; b.chem = {}; b.chem[a.id] = true;
    S.player.coins = 100; S.player.hour = 10;
  `);
  await loadSlot(page);
  await page.click('[data-action="date"]');
  await page.waitForSelector('.shop-item');
  const group = await page.$('#group-date');
  if (!group) errors.push('Group: group-date button missing for compatible polycule');
  else {
    await page.screenshot({ path: `${SHOT}/d5-group.png` });
    await group.click();
    await page.waitForTimeout(900);
    const txt = await page.textContent('#chat-log');
    if (!txt.includes('Group hangout')) errors.push('Group: narration missing from log');
  }

  // --- 6. Old-save migration: strip v2 fields, expect clean load ---
  await edit(page, `
    delete S.player.stats; delete S.player.mojo; delete S.player.inv; delete S.player.buffs; delete S.player.textsSent;
    for (const c of S.npcs) {
      delete c.relStyle; delete c.agreement; delete c.guilt; delete c.suspicion; delete c.strikes;
      delete c.betrayed; delete c.loyal; delete c.pendingConfront; delete c.pendingCheatConfess; delete c.pendingDTR;
      delete c.chem; delete c.measurements; delete c.spark; delete c.dtrDeflects;
      delete c.look.accent; delete c.known.rel;
    }
  `);
  await loadSlot(page);
  await page.fill('#chat-input', 'hey how are you today?');
  await page.click('#chat-send');
  await page.waitForTimeout(700);
  const migratedReply = await page.$$eval('#chat-log .bubble.npc', els => els.length);
  if (migratedReply < 1) errors.push('Migration: old save could not chat, no npc reply');
  await page.click('[data-action="sleep"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT}/d6-migrated.png` });

  // --- 7. Adult shop at Afterglow (night) + intimate date + clinic ---
  await edit(page, `
    const a = S.npcs.find(n => n.id === S.activeId);
    a.affection = 82; a.desire = 60; a.partner = true; a.agreement = 'exclusive';
    a.attractedTo = ['woman','man','enby'];
    S.player.coins = 300; S.player.location = 'shop'; S.player.hour = 22; // night, shop open
  `);
  // re-place active at the shop so we can browse it (edit() forces beach; override)
  await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    S.player.location = 'shop'; S.player.hour = 22;
    localStorage.setItem('bcb_slot_1', JSON.stringify(S));
  });
  await loadSlot(page);
  await page.click('[data-action="here"]');
  await page.waitForSelector('[data-item]', { timeout: 4000 }).catch(() => {});
  const shopItem = await page.$('[data-item="condoms"]');
  if (!shopItem) errors.push('Adult shop: not accessible at Afterglow');
  else {
    await page.screenshot({ path: `${SHOT}/d7-shop.png` });
    await shopItem.click(); await page.waitForTimeout(300);
    await page.click('[data-item="lube"]').catch(() => {});
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape').catch(() => {});
    await page.click('#modal').catch(() => {});
    const condoms = await page.evaluate(() => JSON.parse(localStorage.getItem('bcb_slot_1')).player.condoms);
    if (!condoms || condoms < 6) errors.push('Adult shop: condoms not purchased, got ' + condoms);
  }

  // intimate date (needs co-location + partner) — move to home, force present
  await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const a = S.npcs.find(n => n.id === S.activeId);
    a.schedule = {}; ['dawn','morning','afternoon','evening','night','late'].forEach(p => a.schedule[p] = 'home');
    a.walkedToday = false; a.affection = 88; a.desire = 60; a.partner = true;
    a.agreement = 'exclusive'; a.mood = 2; a.standards = 0.4; a.warnings = 0;
    a.attractedTo = ['woman','man','enby'];
    a.pendingDTR = false; a.pendingConfront = false; a.pendingCheatConfess = false;
    a.pendingPriority = false; a.pendingReconcile = false; a.jealousy = 0; a.estranged = false;
    S.player.condoms = 6; S.player.location = 'home'; S.player.hour = 22; S.player.reputation = 20;
    localStorage.setItem('bcb_slot_1', JSON.stringify(S));
  });
  await loadSlot(page);
  await page.click('[data-action="date"]');
  await page.waitForSelector('[data-intimate]', { timeout: 4000 }).catch(() => {});
  const sensual = await page.$('[data-intimate="sensual"]:not([disabled])');
  if (!sensual) errors.push('Intimate: Sensual Night not available for a partner');
  else {
    await page.screenshot({ path: `${SHOT}/d8-intimate.png` });
    await sensual.click();
    await page.waitForSelector('#int-safe', { timeout: 3000 });
    await page.click('#int-safe'); // use protection
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => {
      const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
      return { condoms: S.player.condoms, log: (S.logs[S.activeId] || []).slice(-3).map(e => e.text) };
    });
    if (st.condoms >= 6) errors.push('Intimate: protection not consumed, condoms=' + st.condoms + ' last=' + JSON.stringify(st.log));
  }

  // clinic: force an STD, travel to clinic, test + treat
  await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    S.player.std = 'itch'; S.player.stdKnown = false; S.player.coins = 300;
    S.player.location = 'clinic'; S.player.hour = 10; // morning, clinic open
    localStorage.setItem('bcb_slot_1', JSON.stringify(S));
  });
  await loadSlot(page);
  await page.click('[data-action="here"]');
  await page.waitForSelector('#cl-treat', { timeout: 4000 }).catch(() => {});
  const treat = await page.$('#cl-treat:not([disabled])');
  if (!treat) errors.push('Clinic: treatment not offered for active STD');
  else {
    await treat.click(); await page.waitForTimeout(400);
    const cured = await page.evaluate(() => JSON.parse(localStorage.getItem('bcb_slot_1')).player.std);
    if (cured) errors.push('Clinic: STD not cured after treatment, still ' + cured);
    await page.screenshot({ path: `${SHOT}/d9-clinic.png` });
  }

  // --- 10. Jealousy → priority scene (reassure clears it) ---
  await edit(page, `
    const c = S.npcs.find(n => n.id === S.activeId);
    c.affection = 55; c.desire = 30; c.relStyle = 'mono'; c.agreement = 'none';
    c.attractedTo = ['woman','man','enby']; c.mood = 0; c.jealousy = 4; c.reassured = 0;
    c.pendingPriority = true; c.pendingConfront = false; c.pendingCheatConfess = false;
    c.pendingDTR = false; c.pendingReconcile = false; c.rival = null;
  `);
  await loadSlot(page);
  await page.waitForSelector('[data-scene="reassure"]', { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/d10-jealous.png` });
  await page.click('[data-scene="reassure"]');
  await page.waitForTimeout(600);
  let js = await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return S.npcs.find(n => n.id === S.activeId);
  });
  if (js.pendingPriority) errors.push('Priority: pendingPriority not cleared');
  if (!(js.jealousy < 4)) errors.push('Priority: reassure did not lower jealousy, got ' + js.jealousy);

  // --- 11. Rival love-triangle escalates to a them-or-me ultimatum ---
  await edit(page, `
    const [a, b] = S.npcs;
    S.activeId = a.id;
    a.affection = 70; a.desire = 40; a.relStyle = 'mono'; a.agreement = 'none';
    a.attractedTo = ['woman','man','enby']; a.mood = 0; a.jealousy = 7;
    a.pendingPriority = true; a.pendingConfront = false; a.pendingCheatConfess = false;
    a.pendingDTR = false; a.pendingReconcile = false; a.rival = b.id;
    b.name = b.name || 'Rival';
  `);
  await loadSlot(page);
  // boiling jealousy + a rival → the ultimatum choices appear
  await page.waitForSelector('[data-scene="them"], [data-scene="free"]', { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/d11-rival.png` });
  await page.click('[data-scene="them"]');
  await page.waitForTimeout(600);
  js = await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const a = S.npcs.find(n => n.id === S.activeId);
    return { jealousy: a.jealousy, pending: a.pendingPriority };
  });
  if (js.pending) errors.push('Rival ultimatum: pendingPriority not cleared');
  if (js.jealousy !== 0) errors.push('Rival ultimatum: jealousy not reset after choosing them, got ' + js.jealousy);

  // --- 12. Reconciliation: estranged ex warms up → second-chance scene ---
  await edit(page, `
    const c = S.npcs.find(n => n.id === S.activeId);
    c.estranged = true; c.betrayed = true; c.affection = 32; c.mood = 0; c.desire = 20;
    c.attractedTo = ['woman','man','enby'];
    c.pendingReconcile = true; c.pendingPriority = false; c.pendingConfront = false;
    c.pendingCheatConfess = false; c.pendingDTR = false;
  `);
  await loadSlot(page);
  await page.waitForSelector('[data-scene="own"]', { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/d12-reconcile.png` });
  await page.click('[data-scene="own"]');
  await page.waitForTimeout(600);
  js = await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return S.npcs.find(n => n.id === S.activeId);
  });
  if (js.estranged || js.pendingReconcile) errors.push('Reconcile: estrangement not cleared after owning it');
  if (!(js.affection >= 40)) errors.push('Reconcile: owning it did not restore affection, got ' + js.affection);

  // --- 13. Unlimited texting: send 8 texts to a faraway NPC, none blocked ---
  // (set state directly — edit() force-co-locates the active NPC, which we DON'T want)
  const farId2 = await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    const c = S.npcs.find(n => n.id === S.activeId);
    c.schedule = {}; ['dawn','morning','afternoon','evening','night','late'].forEach(p => c.schedule[p] = 'club');
    S.player.location = 'beach'; S.player.hour = 12; S.player.textStreak = {}; S.player.textsSent = {};
    c.walkedToday = false; c.affection = 40; c.desire = 30; c.attractedTo = ['woman','man','enby'];
    localStorage.setItem('bcb_slot_1', JSON.stringify(S));
    return c.id;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-load="1"]');
  await page.waitForTimeout(400);
  await page.click('[data-action="roster"]');
  await page.waitForSelector('[data-npc]');
  await page.click(`[data-npc="${farId2}"]`);
  await page.waitForTimeout(400);
  let sent = 0;
  for (let i = 0; i < 8; i++) {
    const disabled = await page.$eval('#chat-input', el => el.disabled).catch(() => true);
    if (disabled) break;
    await page.fill('#chat-input', 'hey thinking about you ' + i);
    await page.click('#chat-send');
    await page.waitForTimeout(500);
    sent++;
  }
  if (sent < 8) errors.push('Unlimited texting: blocked after ' + sent + ' texts (expected 8)');
  const bubbles = await page.evaluate((id) => {
    const S = JSON.parse(localStorage.getItem('bcb_slot_1'));
    return (S.logs[id] || []).filter(e => e.who === 'me').length;
  }, farId2);
  if (!(bubbles >= 8)) errors.push('Unlimited texting: not all 8 texts logged, got ' + bubbles);
  await page.screenshot({ path: `${SHOT}/d13-unlimited.png` });

  await browser.close();
  if (errors.length) { console.log('DRAMA ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('DRAMA E2E PASS — DTR, confront, ultimatum, stray, group, migration, jealousy/priority, rival ultimatum, reconcile, unlimited texting');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
