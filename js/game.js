// Game controller: screens, state, save slots, actions, auto-update.
import { RNG, randomSeed } from './rng.js';
import {
  GIFTS, ACTIVITIES, ROLES, GENDER_LABELS, BODY_LABELS, PRONOUN_SETS,
  FINALE_MIN_AFF, FINALE_MIN_DES, tierFor, tierLabel, TIERS, ARCHETYPES,
  STAT_DEFS, BOOSTS, HUSTLES, TEXT_KINDS, TEXTS_PER_NPC_PER_DAY,
  REL_LABELS, AGREEMENT_LABELS, GROUP_SCENES, GROUP_HANGOUT,
  ADULT_ITEMS, INTIMATE_DATES, STDS, STD_RISK_UNPROTECTED, STD_RISK_PROTECTED,
  CLINIC_TEST_COST, CLINIC_TREAT_COST,
} from './data.js';
import {
  generateCharacter, archetypeOf, quirkOf, pronounsOf, isInterested,
  clampStats, dailyTick, rollDesire, currentDesireOf, ebbDesire,
  npcChemistry, ensureMeasurements, ACCENTS,
} from './characters.js';
import {
  portraitSVG, setEmotion, emotionFor, heartBurst, heatLevel,
  finaleSVG, spawnFireworks, describeCharacter, shade,
  portraitSeed, NEGATIVE_PROMPT, selfiePrompt, finalePrompt,
} from './art.js';
import {
  PHASES, phaseOf, phaseInfo, isNightPhase, LOCATIONS, locationById,
  isOpen, whoIsAt, npcLocation, ensureSchedule,
} from './world.js';
import { mapSVG } from './mapart.js';
import {
  resolveTyped, classifyChoice, chatPersona, giftReaction,
  dateNarration, dateReaction, proactiveText, greeting, meetLine,
  textExchange, fill, dateOffer, reputationLabel,
  dtrOpen, DTR_CHOICES, resolveDTR,
  confrontOpen, CONFRONT_CHOICES, resolveConfront, resolveUltimatum,
  strayOpen, STRAY_CHOICES, resolveStray, groupAfterline,
  jealousOpen, PRIORITY_CHOICES, resolvePriority, rivalUltimatumOpen,
  reconcileOpen, RECONCILE_CHOICES, resolveReconcile, jealousText,
} from './dialogue.js';
import { VERSION, BUILD } from './version.js';

const $ = sel => document.querySelector(sel);
const SLOTS = [1, 2, 3];
const slotKey = n => `bcb_slot_${n}`;

let rng = new RNG(randomSeed());
let S = null;          // live game state
let uidCounter = 0;
let lastLook = ''; // portrait look-key: heat+emotion+location+phase — art follows the session

// ---------------- state ----------------
// Starting stats per role: what kind of hot you arrive as.
const ROLE_STATS = {
  surfer:   { charm: 1, style: 1, physique: 2 },
  musician: { charm: 3, style: 1, physique: 0 },
  heir:     { charm: 1, style: 3, physique: 0 },
  trainer:  { charm: 1, style: 0, physique: 3 },
  chef:     { charm: 2, style: 1, physique: 1 },
  artist:   { charm: 2, style: 2, physique: 0 },
};

function newState(playerDef, slot) {
  const usedNames = new Set([playerDef.name]);
  const npcs = Array.from({ length: 6 }, () => generateCharacter(rng, usedNames));
  npcs.forEach(c => rollDesire(c, rng));
  const worldSeed = rng.int(1, 1_000_000_000);
  npcs.forEach(c => ensureSchedule(c, worldSeed));
  // start the day co-located with someone, so the first encounter just happens
  const startLoc = npcLocation(npcs[0], phaseOf(9), worldSeed);
  return {
    v: 3,
    slot,
    worldSeed,
    player: {
      ...playerDef,
      coins: ROLES.find(r => r.id === playerDef.role).coins,
      day: 1, hour: 9, heartsWon: 0,
      location: startLoc,
      reputation: 0,      // town-wide standing; bad public moves sink it
      condoms: 0,         // protection stock (bought at the adult shop)
      std: null,          // active infection id, or null
      stdKnown: false,    // whether the player has been tested for it
      stats: { ...ROLE_STATS[playerDef.role] },
      mojo: 0,             // earned sexual confidence — amplifies desire gains
      inv: {},             // boostId -> count
      buffs: {},           // courage: movesLeft, scent: bool, outfit: bool
      textsSent: {},       // npcId -> count today
    },
    npcs,
    activeId: npcs[0].id,
    logs: {},          // npcId -> [{who, text}]
    texts: [],         // [{npcId, text, read}]
    usedNames: [...usedNames],
  };
}

// migrate older saves so nobody loses a summer
function migrate(data) {
  if (!data?.player) return data;
  const p = data.player;
  p.stats ??= { ...ROLE_STATS[p.role] };
  p.mojo ??= 0; p.inv ??= {}; p.buffs ??= {}; p.textsSent ??= {};
  for (const c of data.npcs ?? []) {
    c.relStyle ??= (c.id.charCodeAt(0) % 5 < 3 ? 'mono' : 'poly'); // stable-ish for old saves
    c.agreement ??= c.partner ? 'exclusive' : 'none';
    c.dtrDeflects ??= 0; c.guilt ??= 0; c.suspicion ??= 0; c.strikes ??= 0;
    c.betrayed ??= false; c.loyal ??= false;
    c.pendingConfront ??= false; c.pendingCheatConfess ??= false; c.pendingDTR ??= false;
    c.chem ??= {};
    c.known.rel ??= false;
    c.spark ??= 0;
    c.measurements ??= null;
    c.look.accent ??= c.id.charCodeAt(0) % ACCENTS.length;
    // sexual-personality fields for pre-typed-chat saves
    c.libido ??= 0.3 + (c.id.charCodeAt(1) % 7) / 10;
    c.boldness ??= 0.3 + (c.id.charCodeAt(2) % 7) / 10;
    c.standards ??= 0.5 + (c.id.charCodeAt(3) % 5) / 10;
    c.patienceForSpice ??= 0.3 + (c.id.charCodeAt(1) % 6) / 10;
    c.turnoffs ??= ['crude', 'pushy'];
    c.warnings ??= 0;
    c.walkedToday ??= false;
    c.attractedTo = ['man', 'woman', 'enby']; // everyone's pansexual now
  }
  // overworld fields
  data.worldSeed ??= (hashStr(data.slot + ':' + (data.npcs?.[0]?.id || 'x')) >>> 0) || 12345;
  p.location ??= 'beach';
  p.reputation ??= 0;
  // adult shop / health fields
  p.condoms ??= 0;
  p.std ??= null;
  p.stdKnown ??= false;
  p.tired ??= false;
  for (const c of data.npcs ?? []) {
    c.jealousy ??= 0; c.reassured ??= 0; c.rival ??= null; c.estranged ??= false;
    c.pendingPriority ??= false; c.pendingReconcile ??= false;
  }
  // the town grew: old saves meet the new faces too
  if ((data.npcs?.length ?? 0) < 6) {
    const used = new Set([...(data.usedNames || []), p.name]);
    const topUp = new RNG(data.worldSeed + data.npcs.length * 977);
    while (data.npcs.length < 6) {
      const nc = generateCharacter(topUp, used);
      rollDesire(nc, topUp);
      data.npcs.push(nc);
    }
    data.usedNames = [...used];
  }
  for (const c of data.npcs ?? []) ensureSchedule(c, data.worldSeed);
  return data;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function save() {
  if (!S) return;
  try { localStorage.setItem(slotKey(S.slot), JSON.stringify(S)); } catch { /* storage full/blocked */ }
}

function loadSlot(n) {
  try {
    const raw = localStorage.getItem(slotKey(n));
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch { return null; }
}

const active = () => S.npcs.find(c => c.id === S.activeId);
const roleData = () => ROLES.find(r => r.id === S.player.role);

// Live stats after temporary conditions. Exhaustion (no sleep past midnight)
// shaves 2 off everything until you sleep — a debuff, never permanent.
function effStats() {
  const st = { ...S.player.stats };
  if (S.player.tired) for (const k in st) st[k] = Math.max(0, st[k] - 2);
  return st;
}

function playerForDialogue() {
  return { ...S.player, stats: effStats(), tired: !!S.player.tired, roleLabel: roleData().label, roleData: roleData() };
}

// ---------------- screens ----------------
function show(screen) {
  ['#title-screen', '#creator-screen', '#game-screen'].forEach(id => $(id).classList.add('hidden'));
  $(screen).classList.remove('hidden');
}

// ----- title / slots -----
// Dress the title screen: two procedurally-drawn sticker babes lounging at
// the edges (fixed seeds so the menu has a consistent cast) and a slow drift
// of hearts/sparkles. Pure vector + CSS — plays anywhere, even offline.
function ensureTitleScene() {
  const l = $('#tb-l'), r = $('#tb-r');
  if (l && !l.dataset.built) {
    const t1 = new RNG(20260707), t2 = new RNG(8675309);
    const a = generateCharacter(t1, new Set());
    const b = generateCharacter(t2, new Set([a.name]));
    a.desire = 60; b.desire = 60; // sunset-warm looks
    l.innerHTML = portraitSVG(a, 'titleL', 1);
    r.innerHTML = portraitSVG(b, 'titleR', 1);
    setEmotion(l, 'teasing');
    setEmotion(r, 'smug');
    l.dataset.built = r.dataset.built = '1';
  }
  const sp = $('#title-sparkles');
  if (sp && !sp.dataset.built) {
    const bits = ['💗', '✨', '🍑', '💛', '✨', '💗'];
    sp.innerHTML = Array.from({ length: 14 }, (_, i) => {
      const left = (i * 7.3 + Math.random() * 5) % 100;
      const dur = 9 + Math.random() * 9;
      const delay = Math.random() * 12;
      const size = 13 + Math.random() * 15;
      return `<span class="ts-heart" style="left:${left}%;font-size:${size}px;animation-duration:${dur}s;animation-delay:${delay}s">${bits[i % bits.length]}</span>`;
    }).join('');
    sp.dataset.built = '1';
  }
}

function renderTitle() {
  ensureTitleScene();
  const wrap = $('#slot-list');
  wrap.innerHTML = '';
  for (const n of SLOTS) {
    const data = loadSlot(n);
    const div = document.createElement('div');
    div.className = 'slot-card';
    if (data) {
      const p = data.player;
      const role = ROLES.find(r => r.id === p.role);
      div.innerHTML = `
        <div class="slot-info">
          <b>${p.name}</b> · ${GENDER_LABELS[p.gender]}${p.trans ? ' 🏳️‍⚧️' : ''} · ${role.emoji} ${role.label}
          <div class="slot-sub">Day ${p.day} · 💛 ${p.heartsWon} heart${p.heartsWon === 1 ? '' : 's'} won · ${data.npcs.length} babes met</div>
        </div>
        <div class="slot-btns">
          <button class="btn primary" data-load="${n}">Play</button>
          <button class="btn danger" data-del="${n}">✕</button>
        </div>`;
    } else {
      div.innerHTML = `
        <div class="slot-info"><b>Empty slot ${n}</b><div class="slot-sub">A whole new you, a whole new summer.</div></div>
        <div class="slot-btns"><button class="btn primary" data-new="${n}">New Game</button></div>`;
    }
    wrap.appendChild(div);
  }
  wrap.querySelectorAll('[data-load]').forEach(b => b.onclick = () => { S = loadSlot(+b.dataset.load); startGame(); });
  wrap.querySelectorAll('[data-new]').forEach(b => b.onclick = () => openCreator(+b.dataset.new));
  wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('Delete this save forever?')) { localStorage.removeItem(slotKey(+b.dataset.del)); renderTitle(); }
  });
}

// ----- character creator -----
const creator = { slot: 1, gender: 'woman', trans: false, pronouns: 'she', role: 'surfer', name: '' };

function openCreator(slot) {
  creator.slot = slot;
  show('#creator-screen');
  renderCreator();
}

function renderCreator() {
  const g = $('#cc-genders');
  g.innerHTML = Object.entries(GENDER_LABELS).map(([id, label]) =>
    `<button class="chip ${creator.gender === id ? 'on' : ''}" data-g="${id}">${label}</button>`).join('');
  g.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    creator.gender = b.dataset.g;
    creator.pronouns = creator.gender === 'woman' ? 'she' : creator.gender === 'man' ? 'he' : 'they';
    renderCreator();
  });

  $('#cc-trans').innerHTML = `
    <button class="chip ${creator.trans ? 'on' : ''}" id="cc-trans-btn">🏳️‍⚧️ Trans ${creator.trans ? '✓' : ''}</button>
    <span class="cc-hint">optional — Beach City loves you either way</span>`;
  $('#cc-trans-btn').onclick = () => { creator.trans = !creator.trans; renderCreator(); };

  const pr = $('#cc-pronouns');
  pr.innerHTML = Object.values(PRONOUN_SETS).map(p =>
    `<button class="chip ${creator.pronouns === p.id ? 'on' : ''}" data-p="${p.id}">${p.label}</button>`).join('');
  pr.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { creator.pronouns = b.dataset.p; renderCreator(); });

  const rl = $('#cc-roles');
  rl.innerHTML = ROLES.map(r => `
    <div class="role-card ${creator.role === r.id ? 'on' : ''}" data-r="${r.id}">
      <div class="role-head">${r.emoji} <b>${r.label}</b> <span class="role-coins">🪙 ${r.coins}</span></div>
      <div class="role-desc">${r.desc}</div>
      <div class="role-perk">★ ${r.perk}</div>
    </div>`).join('');
  rl.querySelectorAll('[data-r]').forEach(d => d.onclick = () => { creator.role = d.dataset.r; renderCreator(); });
}

function finishCreator() {
  const name = $('#cc-name').value.trim() || 'Alex';
  S = newState({
    name, gender: creator.gender, trans: creator.trans,
    pronouns: creator.pronouns, role: creator.role,
  }, creator.slot);
  save();
  startGame();
}

// ---------------- game rendering ----------------
function startGame() {
  show('#game-screen');
  lastLook = '';
  activeScene = null; awaitingReply = false;
  // focus whoever you're actually with; if your last person isn't here, pick present
  if (!isPresent(active())) {
    const here = presentNPCs();
    const pick = here.find(c => isInterested(c, playerForDialogue())) || here[0];
    if (pick) S.activeId = pick.id;
  }
  renderAll();
  const c = active();
  if (isPresent(c)) {
    if (!(S.logs[c.id]?.length)) npcSay(greeting(c, playerForDialogue(), rng));
    else renderLog();
    maybeScene(c);
  } else {
    renderLog();
  }
  refreshChatBar();
  flushTextsBadge();
}

function renderAll() {
  renderTopbar();
  renderChar(true);
  renderLog();
  renderActions();
}

function renderTopbar() {
  const ph = phaseInfo(phaseOf(S.player.hour));
  const loc = locationById(S.player.location) || LOCATIONS[0];
  $('#coins').textContent = `🪙 ${S.player.coins}`;
  const heat = ({ evening: ' · 🔥', night: ' · 🔥🔥', late: ' · 🔥🥱' })[ph.id] || '';
  $('#daytime').textContent = `${ph.emoji} ${ph.label} · Day ${S.player.day}${heat}`;
  $('#hearts-won').textContent = `${loc.emoji} ${loc.name}`;
  // tint the world by time of day
  document.documentElement.style.setProperty('--phase-tint', ph.tint);
  document.body.classList.toggle('night', isNightPhase(ph.id));
  const st = effStats();
  const buffIcons = [
    S.player.tired ? '\u{1F635}\u{200D}\u{1F4AB}' : '',
    S.player.buffs.courage > 0 ? '🥃' : '',
    S.player.buffs.scent ? '🌺' : '',
    S.player.buffs.outfit ? '🕶️' : '',
  ].join('');
  const rep = reputationLabel(S.player.reputation ?? 0);
  $('#stats-strip').textContent =
    `💬${st.charm} ✨${st.style} 💪${st.physique} 🔥${S.player.mojo} ${rep.emoji}${S.player.reputation} ${buffIcons}`;
}

function renderChar(forcePortrait = false) {
  const c = active();
  const tier = tierFor(c);
  const heat = heatLevel(c, tier);
  const p = pronounsOf(c);
  const arch = archetypeOf(c);
  const interested = isInterested(c, playerForDialogue());

  // the generated art is dynamic to the session: it re-renders whenever the
  // character's live emotion, the location, the time of day, or the heat tier
  // changes — not only heat. Previously seen looks come straight from cache.
  const look = portraitLook(c, tier, heat);
  if (forcePortrait || look.key !== lastLook) {
    ensureMeasurements(c, rng);
    renderPortrait(c, tier, heat, look);
    lastLook = look.key;
  }
  setEmotion($('#portrait-box'), emotionFor(c, tier));

  // accent-color coordination: the NPC's speech bubbles wear their hair accent
  const accent = ACCENTS[c.look.accent ?? 0];
  document.documentElement.style.setProperty('--npc-accent', accent);
  document.documentElement.style.setProperty('--npc-accent-bg', shade(accent, -90));

  $('#char-name').textContent = `${c.name}, ${c.age}`;
  $('#char-chips').innerHTML = [
    `<span class="chip mini">${GENDER_LABELS[c.gender]}${c.trans && c.transShared ? ' 🏳️‍⚧️' : ''}</span>`,
    `<span class="chip mini">${p.label}</span>`,
    `<span class="chip mini">${BODY_LABELS[c.body]}</span>`,
    `<span class="chip mini arch">${arch.label}</span>`,
    `<span class="chip mini tier">${tierLabel(tier)}${c.partner ? ' 💘' : ''}</span>`,
    c.known.rel ? `<span class="chip mini rel">${REL_LABELS[c.relStyle].chip}</span>` : '',
    c.agreement !== 'none' ? `<span class="chip mini agree">${AGREEMENT_LABELS[c.agreement]}</span>` : '',
    c.known.type && !interested ? `<span class="chip mini friend">friends 🤝</span>` : '',
    (c.jealousy ?? 0) >= 3 && interested ? `<span class="chip mini jealous">💢 jealous${rivalNameFor(c) ? ' of ' + rivalNameFor(c) : ''}</span>` : '',
  ].join('');

  // relationship-tier track — a clear "where are we heading" ladder
  const TIER_ICONS = ['👋', '😉', '💕', '🔥'];
  $('#tier-track').innerHTML = TIERS.map((row, i) => {
    const state = i < tier ? 'done' : i === tier ? 'now' : 'todo';
    return `<div class="tier-step ${state}"><span class="ts-ico">${TIER_ICONS[i]}</span><span class="ts-lbl">${row.label}</span></div>`;
  }).join('<span class="tier-arrow">›</span>');

  $('#meter-aff .fill').style.width = `${c.affection}%`;
  $('#meter-des .fill').style.width = `${c.desire}%`;
  $('#meter-aff .val').textContent = c.affection;
  $('#meter-des .val').textContent = c.desire;
  $('#meter-des .fill').classList.toggle('burning', c.desire >= FINALE_MIN_DES);
  $('#spark').textContent = c.spark > 0 ? `${'🔥'.repeat(c.spark)} spark ×${(1 + 0.25 * (c.spark - 1)).toFixed(2)}` : '';
  $('#mood-emoji').textContent = ['😡', '😒', '😐', '🙂', '🥰'][c.mood + 2];

  const facts = [];
  facts.push(c.known.job ? `💼 ${c.job}` : '💼 ???');
  facts.push(c.known.hometown ? `🏠 ${c.hometown}` : '🏠 ???');
  facts.push(c.known.loves ? `😍 loves ${arch.loves.join(', ')}` : '😍 loves ???');
  facts.push(c.known.dislikes ? `🙅 hates ${arch.dislikes.join(', ')}` : '🙅 hates ???');
  facts.push(c.known.quirk ? `⭐ ${quirkOf(c).text}` : '⭐ ???');
  facts.push(c.known.type ? '💘 pansexual — into people, not genders' : '💘 type: ???');
  facts.push(c.known.rel ? `${REL_LABELS[c.relStyle].chip} — ${REL_LABELS[c.relStyle].desc}` : '💞 relationship style: ???');
  $('#profile').innerHTML = facts.map(f => `<div class="fact">${f}</div>`).join('');

  const finaleReady = interested && !c.partner && c.affection >= FINALE_MIN_AFF && c.desire >= FINALE_MIN_DES;
  $('#btn-finale').classList.toggle('hidden', !finaleReady);
}

// Portrait pipeline: procedural sticker SVG by default. If the player wires
// up window.BCB_PORTRAIT_PROVIDER = async (prompt, character, heat) => dataURL
// (their own image-gen backend), generated art replaces the SVG per look —
// heat tier + live emotion + location + time of day, cached per combination.
const pendingPortraits = new Set();

// The "look" a portrait is generated for: heat tier + live emotion + where the
// session is + in-game time of day. Structured game state only — chat text
// never flows into image prompts.
function portraitLook(c, tier, heat) {
  const ctx = {
    emotion: emotionFor(c, tier),
    locationId: S.player.location,
    phase: phaseOf(S.player.hour),
  };
  return { ctx, key: `${c.id}:${heat}:${ctx.emotion}:${ctx.locationId}:${ctx.phase}` };
}

// A selfie for picture texting: the same art pipeline, framed as a phone
// selfie, set wherever THAT character is right now (not where the player is).
// Falls back to their sticker portrait as the 'photo' when offline.
// wish = a pic REQUEST parsed from the player's own text ("let me see you
// smiling on the beach") into whitelisted attributes. Raw chat text never
// enters an image prompt — only these vocabulary-mapped fields do, so the
// swimwear tone ceiling holds no matter what gets typed.
async function npcSelfie(c, wish = {}) {
  const tier = tierFor(c);
  const heat = heatLevel(c, tier);
  const there = wish.locationId || npcLocation(c, curPhase(), S.worldSeed);
  const ctx = { emotion: wish.emotion || emotionFor(c, tier), locationId: there, phase: curPhase() };
  const key = `selfie:${c.id}:${heat}:${ctx.emotion}:${there}:${ctx.phase}:${wish.activity || ''}`;
  window.BCB_PORTRAIT_CACHE ??= {};
  if (window.BCB_PORTRAIT_CACHE[key]) return window.BCB_PORTRAIT_CACHE[key];
  const prov = window.BCB_PORTRAIT_PROVIDER;
  if (typeof prov === 'function') {
    try {
      const prompt = selfiePrompt(c, { ...ctx, heat, activity: wish.activity });
      const url = await prov(prompt, c, heat);
      if (url) { window.BCB_PORTRAIT_CACHE[key] = url; return url; }
    } catch { /* fall through to sticker */ }
  }
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(portraitSVG(c, `selfie${uidCounter++}`, tier));
}

// Parse a typed text into a pic request. Everything is whitelist-mapped:
// expressions to the art engine's emotion ids, places to real town locations,
// activities to a small tasteful phrase bank. Explicit asks are flagged so the
// character can hold their own boundary in reply.
const PIC_ASK_RE = /\b(pic|picture|photo|selfie|snap)\b|let me see (you|ya)|show me (you|yourself|that smile)/i;
const PIC_EXPLICIT_RE = /\b(nude|naked|topless|nsfw|xxx|boobs?|tits?|dick|cock|pussy|genitals?|nipples?|strip)\b/i;
function parsePicRequest(text) {
  const low = text.toLowerCase();
  if (!PIC_ASK_RE.test(low)) return null;
  if (PIC_EXPLICIT_RE.test(low)) return { explicit: true };
  const emotion =
    /laugh/.test(low) ? 'laugh'
    : /smil|happy|grin|cheer/.test(low) ? 'happy'
    : /wink|tease|smirk/.test(low) ? 'teasing'
    : /shy|cute|blush/.test(low) ? 'shy'
    : /sexy|sultry|hot|bedroom/.test(low) ? 'sultry'
    : /kiss/.test(low) ? 'kiss'
    : null;
  let locationId = null;
  for (const l of LOCATIONS) {
    const bare = l.name.toLowerCase().replace(/^the /, '');
    if (low.includes(bare) || low.includes(l.id)) { locationId = l.id; break; }
  }
  const activity = ([
    [/danc/, 'mid-dance-move'],
    [/stretch|yoga/, 'doing a graceful stretch'],
    [/sunbath|tanning|lying|towel/, 'lounging on a beach towel'],
    [/workout|lift|flex|muscle/, 'flexing playfully mid-workout'],
    [/cocktail|drink|smoothie/, 'holding a colorful drink'],
    [/blow.*kiss/, 'blowing a kiss at the camera'],
    [/peace/, 'flashing a peace sign'],
    [/wave/, 'waving at the camera'],
    [/swim|water|ocean|waves/, 'ankle-deep in the surf'],
    [/sunset/, 'with the sunset glowing behind'],
  ].find(([re]) => re.test(low)) || [])[1] || null;
  return { emotion, locationId, activity };
}

function renderPortrait(c, tier, heat, look = portraitLook(c, tier, heat)) {
  const key = look.key;
  window.BCB_PORTRAIT_CACHE ??= {};
  const ext = window.BCB_PORTRAIT_CACHE[key];
  if (ext) {
    $('#portrait-box').innerHTML = `<img class="portrait-ext" alt="Portrait of ${c.name}" src="${ext}">`;
    return;
  }
  const box = $('#portrait-box');
  box.innerHTML = portraitSVG(c, `u${uidCounter++}`, tier);
  box.classList.remove('art-gen');
  const prov = window.BCB_PORTRAIT_PROVIDER;
  if (typeof prov === 'function' && !pendingPortraits.has(key)) {
    pendingPortraits.add(key);
    box.classList.add('art-gen'); // shimmer badge while the model draws
    Promise.resolve(prov(describeCharacter(c, tier, look.ctx), c, heat))
      .then(url => {
        if (url) {
          window.BCB_PORTRAIT_CACHE[key] = url;
          if (S?.activeId === c.id) { lastLook = ''; renderChar(true); }
        }
      })
      .catch(() => {})
      .finally(() => {
        pendingPortraits.delete(key);
        if (S?.activeId === c.id) box.classList.remove('art-gen');
      });
  }
}

// Always log to an EXPLICIT npc id: generative replies arrive after a network
// round-trip, and by then the player may be in a different conversation — the
// words must land in the log of whoever said them, never whoever is on screen.
function logTo(npcId, who, text, extra = {}) {
  (S.logs[npcId] ??= []).push({ who, text, ...extra });
  if (S.logs[npcId].length > 60) S.logs[npcId].shift();
  if (S.activeId === npcId) renderLog();
}

const log = (who, text) => logTo(active().id, who, text);

// Chat text is untrusted (LLM output from a third-party endpoint by default,
// plus whatever the player types) — never let it into innerHTML unescaped.
const escapeHtml = s => String(s).replace(/[&<>"']/g,
  ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const SAFE_PIC = src => typeof src === 'string'
  && (/^data:image\/(png|jpe?g|webp|svg\+xml)[;,]/.test(src) || src.startsWith('https://image.pollinations.ai/'));

function renderLog() {
  const el = $('#chat-log');
  const entries = S.logs[active().id] ?? [];
  el.innerHTML = entries.map(e => {
    const pic = SAFE_PIC(e.img)
      ? `<img class="chat-pic" alt="picture message" src="${e.img.replace(/"/g, '&quot;')}">` : '';
    return `<div class="bubble ${e.who}${pic ? ' pic' : ''}">${pic}${escapeHtml(e.text)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

const npcSay = text => { log('npc', text); save(); };
const playerSay = text => log('me', text);
const narrate = text => { log('sys', text); save(); };

function renderActions() {
  $('#choices').innerHTML = '';
}

// ---------------- actions ----------------
// The flow: positive arousal beats chain into a spark combo (×1.25 per link,
// max ×1.75); a flop breaks the chain. Scent buff amplifies everything.
// The clock is a mechanic: desire beats land hotter after dark and cooler in
// the fresh light of morning. (Affection is time-of-day agnostic — hearts
// don't check watches, libidos do.)
const PHASE_DESIRE = { dawn: 0.8, morning: 0.9, afternoon: 1, evening: 1.15, night: 1.3, late: 1.2 };

function applyDelta(c, dAff, dDes) {
  c.affection += dAff;
  if (dDes > 0) {
    dDes = dDes * (PHASE_DESIRE[phaseOf(S.player.hour)] ?? 1);
    if (S.player.buffs.scent) dDes = Math.round(dDes * 1.5);
    c.spark = Math.min(3, (c.spark ?? 0) + 1);
    c.desire += Math.round(dDes * (1 + 0.25 * (c.spark - 1)));
  } else if (dDes < 0) {
    c.spark = 0;
    c.desire += dDes;
  }
  c.lastSeenDay = S.player.day;
  clampStats(c, playerForDialogue());
  floatDelta(dAff, dDes);
}

// Floating "+3 ♥ / +5 🔥" over the meters so the chat visibly moves the game.
function floatDelta(dAff, dDes) {
  const gs = $('#game-screen');
  if (!gs || gs.classList.contains('hidden')) return;
  const spawn = (txt, cls, anchor) => {
    const el = anchor || $('#meters') || $('#char-panel');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'stat-float ' + cls;
    d.textContent = txt;
    d.style.left = `${r.left + r.width * (0.3 + Math.random() * 0.4)}px`;
    d.style.top = `${r.top + 10}px`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  };
  if (dAff) spawn(`${dAff > 0 ? '+' : ''}${dAff} ♥`, dAff > 0 ? 'up' : 'down', $('#meter-aff'));
  if (dDes) spawn(`${dDes > 0 ? '+' : ''}${dDes} 🔥`, dDes > 0 ? 'up' : 'down', $('#meter-des'));
}

function afterAction(emotion, good) {
  const c = active();
  renderTopbar();
  renderChar();
  if (emotion) setEmotion($('#portrait-box'), emotion);
  if (good) heartBurst($('#portrait-box'));
  save();
}

// ---------------- gossip mill / cheating ----------------
// A romantic act with `withC` registers against everyone else who'd care.
// Beach City is a small town: public venues talk, and the more people you
// know, the faster word travels.
function registerRomance(withC, pub = 0.3, extraIds = []) {
  const skip = new Set([withC.id, ...extraIds]);
  for (const y of S.npcs) {
    if (skip.has(y.id)) continue;
    const t = tierFor(y);
    const cares =
      y.agreement === 'exclusive' ? true :
      y.agreement === 'open' ? false :
      t >= 2; // dating-but-undefined still stings, poly included (they hate sneaking)
    if (!cares) continue;
    y.guilt = (y.guilt ?? 0) + 1;
    // jealousy is broader than guilt: anyone into you who isn't openly poly
    // starts to sting when you're romancing others
    if (isInterested(y, playerForDialogue()) && tierFor(y) >= 1)
      y.jealousy = (y.jealousy ?? 0) + (y.relStyle === 'poly' ? 0.4 : 1) * (1 + pub);
    const p = Math.min(0.5, (0.10 + 0.18 * pub) * (1 + 0.05 * Math.max(0, S.npcs.length - 2)));
    if (rng.chance(p) && !y.pendingConfront) {
      y.suspicion = (y.suspicion ?? 0) + 1;
      y.pendingConfront = true;
      S.texts.push({
        npcId: y.id, read: false, day: S.player.day,
        text: rng.pick(['We need to talk. Tonight. Not over text.', 'Interesting things reach my ears, {0}. Come see me.', 'You. Me. A conversation. Soon. 🙂 (the 🙂 is loadbearing)'])
          .replace('{0}', S.player.name),
      });
    }
  }
  flushTextsBadge();
}

// Love triangles: two people who both want you and both know it become rivals.
function computeRivals() {
  const flames = S.npcs.filter(c => tierFor(c) >= 2 && isInterested(c, playerForDialogue()));
  for (const c of S.npcs) {
    if (!flames.includes(c)) { c.rival = null; continue; }
    const other = flames.filter(o => o.id !== c.id).sort((a, b) => b.affection - a.affection)[0];
    c.rival = other ? other.id : null;
    if (other && c.relStyle === 'mono') c.jealousy = (c.jealousy ?? 0) + 0.5;
  }
}

// Public blowups echo: friends warn each other about you.
function warnOthers(about) {
  adjustRep(-10); // a scene like this gets around
  for (const y of S.npcs) {
    if (y.id === about.id || tierFor(y) < 1) continue;
    const judgy = y.relStyle === 'mono' ? 6 : 3;
    y.affection = Math.max(0, y.affection - judgy);
    y.mood = Math.max(-2, y.mood - 1);
    S.texts.push({
      npcId: y.id, read: false, day: S.player.day,
      text: `Heard what happened with ${about.name}. Not a great look, ${S.player.name}. 😕`,
    });
  }
  flushTextsBadge();
}

// ---------------- relationship scenes ----------------
// Pending drama plays out the moment you're face to face.
function maybeScene(c) {
  if (c.pendingConfront) return sceneConfront(c);
  if (c.pendingCheatConfess) return sceneStray(c);
  if (c.pendingReconcile) return sceneReconcile(c);
  if (c.pendingPriority) return scenePriority(c);
  if (c.pendingDTR) return sceneDTR(c, true);
  return false;
}

// The name of this NPC's rival (a specific other flame), or null.
function rivalNameFor(c) {
  const r = c.rival && S.npcs.find(n => n.id === c.rival);
  return r ? r.name : null;
}

// "Where do I stand?" — softer than a cheating confrontation. Escalates to a
// them-or-me ultimatum when a rival is in the picture and jealousy has boiled.
function scenePriority(c) {
  c.pendingPriority = false;
  const rival = rivalNameFor(c);
  const boiling = (c.jealousy ?? 0) >= 6 && rival;
  if (boiling) {
    npcSay(rivalUltimatumOpen(c, playerForDialogue(), rng, rival));
    presentChoices([
      { id: 'them', label: `💘 “It’s you, ${c.name}.”` },
      { id: 'free', label: `🕊️ “I won't be forced to choose.”` },
    ], sub => {
      const u = resolveUltimatum(c, playerForDialogue(), sub === 'them', rng);
      c.jealousy = 0;
      applyDelta(c, u.dAff, u.dDes);
      npcSay(u.npcText);
      if (sub === 'them') {
        for (const y of S.npcs) {
          if (y.id === c.id) continue;
          if (y.agreement !== 'none' || y.partner || tierFor(y) >= 2) {
            y.agreement = 'none'; y.partner = false;
            y.affection = Math.max(0, y.affection - 15); y.mood = Math.max(-2, y.mood - 1);
            y.guilt = 0; y.suspicion = 0; y.jealousy = 0; y.pendingConfront = false;
            S.texts.push({ npcId: y.id, read: false, day: S.player.day,
              text: `So it's ${c.name}. Thanks for telling me. Be good to each other. 💔` });
          }
        }
        flushTextsBadge();
      } else {
        warnOthers(c); c.estranged = true;
      }
      afterAction(u.emotion, sub === 'them');
    });
    return true;
  }
  npcSay(jealousOpen(c, playerForDialogue(), rng, rival));
  presentChoices(PRIORITY_CHOICES, choice => {
    const r = resolvePriority(c, playerForDialogue(), choice, rng, rival);
    applyDelta(c, r.dAff, r.dDes);
    npcSay(r.npcText);
    if (r.walk) c.walkedToday = true;
    afterAction(r.emotion, choice === 'reassure' || (choice === 'honest' && c.relStyle === 'poly'));
  });
  return true;
}

// A second chance, earned by sustained kindness after a breakup.
function sceneReconcile(c) {
  c.pendingReconcile = false;
  npcSay(reconcileOpen(c, playerForDialogue(), rng));
  presentChoices(RECONCILE_CHOICES, choice => {
    const r = resolveReconcile(c, playerForDialogue(), choice, rng);
    applyDelta(c, r.dAff, r.dDes);
    npcSay(r.npcText);
    afterAction(r.emotion, choice === 'own');
  });
  return true;
}

// Show scene choices as buttons AND register them so the player can type an
// answer instead of tapping. Cleared once a choice is made.
function presentChoices(choices, handler) {
  activeScene = { choices, handler };
  const done = id => { activeScene = null; $('#choices').innerHTML = ''; handler(id); if (typeof refreshChatBar === 'function') refreshChatBar(); };
  $('#choices').innerHTML = choices.map(ch =>
    `<button class="btn choice warm" data-scene="${ch.id}">${ch.label}</button>`).join('');
  $('#choices').querySelectorAll('[data-scene]').forEach(b => b.onclick = () => done(b.dataset.scene));
  if (typeof refreshChatBar === 'function') refreshChatBar();
}

function sceneConfront(c, preemptive = false) {
  if (!preemptive) npcSay(confrontOpen(c, playerForDialogue(), rng));
  const choices = preemptive ? CONFRONT_CHOICES.filter(ch => ch.id !== 'deny') : CONFRONT_CHOICES;
  presentChoices(choices, choice => {
    const r = resolveConfront(c, playerForDialogue(), choice, rng, { preemptive });
    applyDelta(c, r.dAff, r.dDes);
    npcSay(r.npcText);
    if (r.outcome === 'ultimatum') {
      presentChoices([
        { id: 'them', label: `💘 “It’s you, ${c.name}. Only you.”` },
        { id: 'free', label: '🕊️ “I can’t promise that.”' },
      ], sub => {
        const u = resolveUltimatum(c, playerForDialogue(), sub === 'them', rng);
        applyDelta(c, u.dAff, u.dDes);
        npcSay(u.npcText);
        if (sub === 'them') {
          // clean break with everyone else — they hear it from you today
          for (const y of S.npcs) {
            if (y.id === c.id) continue;
            if (y.agreement !== 'none' || y.partner || tierFor(y) >= 2) {
              y.agreement = 'none'; y.partner = false;
              y.affection = Math.max(0, y.affection - 15);
              y.mood = Math.max(-2, y.mood - 1);
              y.guilt = 0; y.suspicion = 0; y.pendingConfront = false;
              S.texts.push({
                npcId: y.id, read: false, day: S.player.day,
                text: `So you chose ${c.name}. Thanks for telling me yourself, at least. Be good to each other. 💔`,
              });
            }
          }
          flushTextsBadge();
        } else {
          warnOthers(c); c.estranged = true; // door left open for a comeback
        }
        afterAction(u.emotion, sub === 'them');
      });
      afterAction(r.emotion, false);
      return;
    }
    if (r.outcome === 'blowup') warnOthers(c);
    afterAction(r.emotion, r.outcome === 'opened');
  });
  return true;
}

function sceneStray(c) {
  npcSay(strayOpen(c, playerForDialogue(), rng));
  presentChoices(STRAY_CHOICES, choice => {
    const r = resolveStray(c, playerForDialogue(), choice, rng);
    applyDelta(c, r.dAff, r.dDes);
    npcSay(r.npcText);
    afterAction(r.emotion, choice === 'forgive');
  });
  return true;
}

function sceneDTR(c, npcInitiated) {
  c.pendingDTR = false;
  npcSay(dtrOpen(c, playerForDialogue(), rng, npcInitiated));
  presentChoices(DTR_CHOICES, choice => {
    const r = resolveDTR(c, playerForDialogue(), choice, rng);
    applyDelta(c, r.dAff, r.dDes);
    npcSay(r.npcText);
    afterAction(r.emotion, r.dAff > 5);
  });
  return true;
}

// Group hangout with two mutually-sparked poly flames.
function groupCandidateFor(c) {
  if (c.relStyle !== 'poly' || c.agreement !== 'open') return null;
  return S.npcs.find(m =>
    m.id !== c.id && m.agreement === 'open' && tierFor(m) >= 1 &&
    isInterested(m, playerForDialogue()) && npcChemistry(c, m, rng)) || null;
}

function goGroupDate(c, m) {
  S.player.coins -= GROUP_HANGOUT.cost;
  advanceTime(GROUP_HANGOUT.hours);
  const scene = rng.pick(GROUP_SCENES).replaceAll('{a}', c.name).replaceAll('{b}', m.name);
  narrate(`💞 Group hangout: ${scene}.`);
  for (const x of [c, m]) {
    x.affection += GROUP_HANGOUT.aff;
    x.desire += GROUP_HANGOUT.des;
    x.lastSeenDay = S.player.day;
    x._datedToday = true;
    clampStats(x, playerForDialogue());
  }
  registerRomance(c, GROUP_HANGOUT.pub, [m.id]);
  setTimeout(() => {
    npcSay(groupAfterline(c, m, playerForDialogue(), rng));
    S.texts.push({ npcId: m.id, read: false, day: S.player.day, text: groupAfterline(m, c, playerForDialogue(), rng) });
    flushTextsBadge();
    afterAction('laugh', true);
  }, 600);
}

// ---------------- overworld / presence ----------------
const curPhase = () => phaseOf(S.player.hour);
const presentNPCs = () => whoIsAt(S.npcs, S.player.location, curPhase(), S.worldSeed);
function isPresent(c) {
  return c && !c.walkedToday && npcLocation(c, curPhase(), S.worldSeed) === S.player.location;
}

// Travel to a location: costs an hour, then you meet whoever's there now.
function travelTo(locId) {
  const loc = locationById(locId);
  if (!loc) return;
  closeModal();
  S.player.location = locId;
  advanceTime(1);
  arrive(loc, true);
}

// Resolve who's around and update the chat focus + system message.
function arrive(loc, announce) {
  const here = presentNPCs();
  // small chance to meet someone brand new while you're out and about
  let met = null;
  if (!loc.home && !loc.clinic && S.npcs.length < 14 && rng.chance(loc.adult ? 0.15 : 0.3)) {
    const used = new Set(S.usedNames);
    met = generateCharacter(rng, used);
    S.usedNames = [...used];
    rollDesire(met, rng);
    ensureSchedule(met, S.worldSeed);
    met.schedule[curPhase()] = loc.id; // they're here right now
    S.npcs.push(met);
    here.push(met);
  }
  if (announce) {
    const names = here.map(c => c.name);
    narrate(`${loc.emoji} You head to ${loc.name}. ${loc.vibe[0].toUpperCase() + loc.vibe.slice(1)}.` +
      (names.length ? ` ${listNames(names)} ${names.length > 1 ? 'are' : 'is'} here.` : ' Nobody around right now.'));
  }
  // focus someone present (prefer whoever you were already with)
  if (!isPresent(active())) {
    const pick = here.find(c => isInterested(c, playerForDialogue())) || here[0];
    if (pick) { S.activeId = pick.id; lastLook = ''; }
  }
  if (met) {
    // your reputation precedes you — beloved gets a warm start, notorious a wary one
    const rep = S.player.reputation ?? 0;
    met.affection = Math.max(0, Math.min(30, met.affection + Math.round(rep / 12)));
    met.standards = Math.max(0.4, Math.min(1, met.standards - rep / 400));
    setTimeout(() => { switchTo(met.id); npcSay(meetLine(met, playerForDialogue(), rng)); }, 300);
  }
  renderAll();
  refreshChatBar();
  save();
}

function listNames(names) {
  if (names.length <= 2) return names.join(' and ');
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}

function openMap() {
  const phase = curPhase();
  const presenceByLoc = {};
  for (const l of LOCATIONS) presenceByLoc[l.id] = isOpen(l, phase) ? whoIsAt(S.npcs, l.id, phase, S.worldSeed) : [];
  const here = presenceByLoc[S.player.location] || [];
  const body = `
    <div class="map-wrap">${mapSVG({ phase, playerLoc: S.player.location, presenceByLoc })}</div>
    <p class="modal-text map-hint">Tap a place to travel there (costs an hour). You'll meet whoever's around.
      ${here.length ? `Here now: <b>${here.map(c => c.name).join(', ')}</b>.` : ''}</p>`;
  openModal(body, 'map-modal');
  $('#modal-body').querySelectorAll('.map-hot:not(.closed)').forEach(g => {
    g.onclick = () => travelTo(g.dataset.loc);
    g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); travelTo(g.dataset.loc); } };
  });
}

// ---------------- typed chat ----------------
let activeScene = null; // { choices, handler } while a pivotal scene is open
let awaitingReply = false;

// Contextual chip row above the input: who else is here to approach, plus
// Heart-to-heart / Come clean. Input is gated by whether you're actually with
// someone — you can't chat with people who aren't at your location.
const textsLeft = () => Infinity; // texting is unlimited — talk all night

// You know someone once you've actually exchanged words (any chat history).
// Strangers don't have your number: no texts from them, no texting them.
const hasMet = c => (S.logs?.[c.id]?.length ?? 0) > 0;

function refreshChatBar() {
  const c = active();
  const input = $('#chat-input');
  const here = presentNPCs();
  const withThem = isPresent(c);
  const texting = !withThem && !activeScene; // apart = the phone comes out
  const canText = texting && hasMet(c);
  input.disabled = awaitingReply || (texting && !canText);
  input.placeholder = activeScene ? 'Type your answer, or tap a choice above…'
    : awaitingReply ? '…'
    : withThem ? `Say something to ${c.name}…`
    : canText ? `📱 Text ${c.name}…`
    : `📱 You haven't met ${c.name} yet — find them around town first.`;

  // the banner + bubble style make it unmistakable: phone vs face-to-face
  const banner = $('#chat-banner');
  if (banner) {
    const loc = locationById(S.player.location);
    if (withThem) {
      banner.textContent = `💬 With ${c.name} · ${loc ? loc.emoji + ' ' + loc.name : ''}`;
      banner.className = 'inperson';
    } else {
      const thereLoc = locationById(npcLocation(c, curPhase(), S.worldSeed));
      banner.textContent = `📱 Texting ${c.name} — ${pronounsOf(c).sub === 'they' ? 'they\u2019re' : pronounsOf(c).sub + '\u2019s'} at ${thereLoc ? thereLoc.emoji + ' ' + thereLoc.name : 'somewhere in town'}`;
      banner.className = 'texting';
    }
  }
  $('#chat-log').classList.toggle('texting', texting);

  const chips = [];
  // picture texting: ask for a pic once you're at least flirting
  if (texting && hasMet(c) && tierFor(c) >= 1)
    chips.push(`<button class="chip mini action" data-chip="pic" ${awaitingReply ? 'disabled' : ''}>📸 Ask for a pic</button>`);
  // approach anyone else present — but not while a reply is in flight, so a
  // pending generative reply can't be cross-wired into another conversation
  for (const o of here) if (o.id !== c.id)
    chips.push(`<button class="chip mini action" data-approach="${o.id}" ${awaitingReply ? 'disabled' : ''}>💬 ${o.name}</button>`);
  if (!activeScene && withThem) {
    const tier = tierFor(c);
    if (isInterested(c, playerForDialogue()) && tier >= 2 && c.agreement === 'none')
      chips.push('<button class="chip mini action" data-chip="dtr">💕 Define the relationship</button>');
    if ((c.guilt ?? 0) > 0 && (c.agreement === 'exclusive' || tier >= 2))
      chips.push('<button class="chip mini action" data-chip="confess">😳 Come clean</button>');
  }
  const bar = $('#chat-chips');
  bar.innerHTML = chips.join('');
  bar.querySelectorAll('[data-approach]').forEach(b => b.onclick = () => switchTo(b.dataset.approach));
  bar.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => {
    if (b.dataset.chip === 'pic') askForPic(c);
    else if (b.dataset.chip === 'dtr') { playerSay('Hey… can we talk about us?'); setTimeout(() => sceneDTR(c, false), 420); }
    else { playerSay('There’s something I need to tell you.'); setTimeout(() => sceneConfront(c, true), 420); }
  });
}

function sendTyped() {
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text || awaitingReply) return;
  const c = active();
  input.value = '';

  // Pivotal scene open → the typed line answers it.
  if (activeScene) {
    const id = classifyChoice(text, activeScene.choices);
    playerSay(text);
    if (id) { const h = activeScene.handler; activeScene = null; h(id); }
    else setTimeout(() => { npcSay(rng.pick(['That’s not really an answer, {n}. Which is it?'.replace('{n}', S.player.name), 'I need a straight answer here.'])); refreshChatBar(); }, 350);
    return;
  }

  // apart = the phone: typed messages become texts (with the daily limit)
  if (!isPresent(c)) {
    if (!hasMet(c)) { toast(`You haven't met ${c.name} yet.`); return; }
    playerSay(`📱 ${text}`);
    // "let me see you smiling on the beach…" — pic requests get a picture back
    const wish = parsePicRequest(text);
    if (wish) { askForPic(c, { wish, typed: true }); return; }
    npcReply(c, text, { texting: true });
    return;
  }

  playerSay(text);

  // Typed phrases can open the relationship scenes directly.
  const low = text.toLowerCase();
  const tier = tierFor(c);
  if (isInterested(c, playerForDialogue()) && tier >= 2 && c.agreement === 'none'
      && /(what are we|define|are we exclusive|be exclusive|official|together|boyfriend|girlfriend|dating\??$)/.test(low)) {
    setTimeout(() => sceneDTR(c, false), 400); return;
  }
  if ((c.guilt ?? 0) > 0 && /(i have to be honest|come clean|confess|cheat|i kissed|i went out with|tell you something)/.test(low)) {
    setTimeout(() => sceneConfront(c, true), 400); return;
  }

  npcReply(c, text);
}

// Compose the NPC's reply: LLM provider if wired, else offline procedural.
// The provider await is a real network round-trip now, so everything after it
// is guarded: S0 catches slot swaps (quit-to-title → load another save) and
// replySeq stops a stale completion from unlocking a newer request's chat bar.
let replySeq = 0;
async function npcReply(c, text, { texting = false } = {}) {
  const S0 = S;
  const seq = ++replySeq;
  awaitingReply = true;
  refreshChatBar();
  const pl = playerForDialogue();
  const prov = window.BCB_CHAT_PROVIDER;
  let r;
  if (typeof prov === 'function') {
    // provider generates the words; NLU on the player's text drives the stats
    r = resolveTyped(c, pl, text, rng, roleData());
    try {
      const recent = (S.logs[c.id] || []).slice(-12)
        .filter(e => e.who !== 'sys')
        .map(e => `${e.who === 'me' ? S.player.name : c.name}: ${e.text}`);
      const world = {
        location: locationById(S.player.location)?.name,
        phase: phaseOf(S.player.hour),
        day: S.player.day,
      };
      const persona = chatPersona(c, pl, recent, world);
      if ((c.jealousy ?? 0) >= 3) {
        const rn = rivalNameFor(c);
        persona.jealousNote = `You've been feeling insecure lately${rn ? ` — especially about ${rn}` : ''}; some quiet jealousy colors your replies, though you don't necessarily lead with it.`;
      }
      if (texting) persona.channel = 'text';
      const out = await prov(texting ? `📱 ${text}` : text, persona, { tier: tierFor(c) });
      if (out && typeof out === 'string') r.npcText = out.trim().replace(/^📱\s*/, '');
    } catch { /* fall back to procedural r.npcText */ }
  } else {
    r = resolveTyped(c, pl, text, rng, roleData());
  }

  if (S !== S0) return; // save slot changed mid-flight — this reply belongs to a dead world

  if (texting) r.dDes = Math.round(r.dDes * 0.6); // sparks fly hotter in person
  applyDelta(c, r.dAff, r.dDes);
  if (S.player.buffs.courage > 0) S.player.buffs.courage -= 1;
  const intent = r.nlu?.intent;
  if (r.success && (intent === 'SPICY' || (intent === 'FLIRT' && tierFor(c) >= 2)))
    S.player.mojo = Math.min(20, S.player.mojo + 1);
  if (r.success && ['FLIRT', 'SPICY', 'SERENADE'].includes(intent)) registerRomance(c, 0.15);
  // crashing and burning in public (creepy line, walk-off, being a jerk) costs
  // you standing around town — people talk
  if (r.rejected || r.walk || intent === 'INSULT') adjustRep(-2);
  if (r.walk) c.walkedToday = true;

  setTimeout(() => {
    if (S !== S0) return;
    logTo(c.id, 'npc', texting ? `📱 ${r.npcText}` : r.npcText); // pinned to the speaker, not to active()
    save();
    const stillHere = S.activeId === c.id;
    if (r.special === 'transShare' && stillHere) {
      openReplyScene(r.replyChoices, c);
    }
    if (seq === replySeq) awaitingReply = false; // never unlock a newer request
    if (stillHere) afterAction(r.emotion, r.success);
    refreshChatBar();
  }, 420);
}

// 📸 picture texting: ask and you might receive — desire, boldness, and tier
// decide. A yes costs a text slot and comes back as a real picture message.
async function askForPic(c, { wish = null, typed = false } = {}) {
  const S0 = S;
  if (!typed) { // the 📸 chip; typed requests already logged their own line
    playerSay('📱 Send me a pic? 😏');
  }
  // asking past the tone ceiling gets a boundary, in character, every time
  if (wish?.explicit) {
    setTimeout(() => {
      if (S !== S0) return;
      logTo(c.id, 'npc', `📱 ${rng.pick([
        'Ha — nice try, cutie. Swimsuit is as far as this camera goes. 😏',
        'That\u2019s a no. A cute no, but a no. 😘',
        'Wow, bold. The answer\u2019s still a bikini pic or nothing. 💅',
      ])}`);
      save(); refreshChatBar();
    }, 700);
    return;
  }
  const tier = tierFor(c);
  const p = Math.min(0.9, 0.25 + 0.18 * tier + c.desire / 220 + c.boldness * 0.2);
  if (!rng.chance(p)) {
    applyDelta(c, -1, 0);
    setTimeout(() => {
      if (S !== S0) return;
      logTo(c.id, 'npc', `📱 ${rng.pick([
        'Ha! Earn it first, cutie. 😏',
        'Hmm. Not yet. Take me somewhere nice and we\u2019ll talk. 😘',
        'Bold of you. I like it — but no. 💅',
      ])}`);
      save(); refreshChatBar();
    }, 700);
    return;
  }
  const caption = rng.pick(wish ? [
    'Like this? 😏',
    'Your wish, cutie. 😘',
    'Happy now? Because I am. 🙈',
    'Demanding! …I like it. 💋',
  ] : [
    'Just for you. Don\u2019t share it. 😘',
    'Since you asked so nicely… 😏',
    'Thinking of you anyway. 💋',
    'Quick — before I change my mind. 🙈',
  ]);
  const img = await npcSelfie(c, wish || {});
  if (S !== S0) return;
  applyDelta(c, 2, 5);
  setTimeout(() => {
    if (S !== S0) return;
    logTo(c.id, 'npc', `📱 ${caption}`, { img });
    save();
    if (S.activeId === c.id) afterAction(emotionFor(c, tierFor(c)), true);
    refreshChatBar();
  }, 600);
}

function openReplyScene(replies, c) {
  activeScene = {
    choices: replies.map((t, i) => ({ id: String(i), label: t })),
    handler: id => {
      playerSay(replies[+id]);
      applyDelta(c, 6, 2);
      setTimeout(() => { npcSay('...Yeah. You’re a keeper. Come here. 🫶'); afterAction('love', true); refreshChatBar(); }, 450);
    },
  };
  $('#choices').innerHTML = replies.map((t, i) => `<button class="btn choice warm" data-scene="${i}">${t}</button>`).join('');
  $('#choices').querySelectorAll('[data-scene]').forEach(b => b.onclick = () => {
    $('#choices').innerHTML = '';
    const h = activeScene.handler; activeScene = null; h(b.dataset.scene);
  });
  refreshChatBar();
}

function openShop() {
  const c = active();
  const tier = tierFor(c);
  const body = `
    <h3>🎁 Gift for ${c.name}</h3>
    <div class="shop-grid">
      ${GIFTS.map(g => {
        const locked = g.minTier && tier < g.minTier;
        const poor = S.player.coins < g.cost;
        return `<button class="shop-item ${locked || poor ? 'off' : ''}" data-gift="${g.id}" ${locked || poor ? 'disabled' : ''}>
          <span class="shop-emoji">${g.emoji}</span><span>${g.name}</span>
          <span class="shop-cost">${locked ? `🔒 ${tierLabel(g.minTier)}+` : `🪙 ${g.cost}`}</span>
        </button>`;
      }).join('')}
    </div>`;
  openModal(body);
  $('#modal-body').querySelectorAll('[data-gift]').forEach(b => b.onclick = () => {
    closeModal();
    giveGift(GIFTS.find(g => g.id === b.dataset.gift));
  });
}

function giveGift(gift) {
  const c = active();
  S.player.coins -= gift.cost;
  narrate(`You give ${c.name} the ${gift.name} ${gift.emoji}`);
  const r = giftReaction(c, playerForDialogue(), gift, rng);
  applyDelta(c, r.dAff, r.dDes);
  if (gift.cat === 'spicy') registerRomance(c, 0.3);
  setTimeout(() => {
    npcSay(r.text);
    afterAction(r.emotion, r.quality === 'love' || r.quality === 'like');
  }, 420);
}

function hasItemKind(kind) {
  return ADULT_ITEMS.some(it => it.kind === kind && S.player.inv[it.id]);
}

// A visible heat rating on each date card: hotter dates burn brighter.
function heatPips(des) {
  const n = Math.max(1, Math.min(5, Math.round((des ?? 0) / 9)));
  return '🔥'.repeat(n) + `<span class="pip-dim">${'🔥'.repeat(5 - n)}</span>`;
}

function openDates() {
  const c = active();
  const tier = tierFor(c);
  const buddy = groupCandidateFor(c);
  const groupOk = buddy && S.player.coins >= GROUP_HANGOUT.cost;
  // which intimate dates are available with this person right now
  const lovers = S.npcs.filter(x => x.partner || (x.agreement === 'open' && tierFor(x) >= 2 && isInterested(x, playerForDialogue())));
  const intimate = INTIMATE_DATES.map(d => {
    let lock = null;
    if (tier < d.minTier) lock = `🔒 ${tierLabel(d.minTier)}`;
    else if (d.needs && !hasItemKind(d.needs)) lock = '🔒 need Afterglow item';
    else if (d.group && lovers.length < 2) lock = '🔒 need 2 open lovers';
    else if (S.player.coins < 0) lock = '🪙';
    return { d, lock };
  });
  const body = `
    <h3>🌴 Take ${c.name} out</h3>
    ${buddy ? `<button class="btn choice warm" id="group-date" ${groupOk ? '' : 'disabled'} style="width:100%;margin-bottom:8px">
      💞 Group hangout with ${buddy.name} (🪙 ${GROUP_HANGOUT.cost} · ${GROUP_HANGOUT.hours}h)</button>` : ''}
    <div class="shop-grid">
      ${ACTIVITIES.map(a => {
        const locked = c.affection < a.minAff;
        const poor = S.player.coins < a.cost;
        const off = locked || poor;
        return `<button class="shop-item ${off ? 'off' : ''}" data-act="${a.id}" ${off ? 'disabled' : ''}>
          <span class="shop-emoji">${a.emoji}</span><span>${a.name}</span>
          <span class="heat-pips">${heatPips(a.des)}</span>
          <span class="shop-cost">${locked ? `🔒 ♥ ${a.minAff}` : `🪙 ${a.cost} · ${a.hours}h`}</span>
        </button>`;
      }).join('')}
    </div>
    <h3 style="margin-top:14px">🔥 Intimate <span style="font-size:12px;font-weight:400;color:#8a6b78">— fade to black, real stakes</span></h3>
    <div class="shop-grid">
      ${intimate.map(({ d, lock }) => `
        <button class="shop-item ${lock ? 'off' : 'intimate'}" data-intimate="${d.id}" ${lock ? 'disabled' : ''} title="${d.desc}">
          <span class="shop-emoji">${d.emoji}</span><span>${d.name}</span>
          <span class="heat-pips">${heatPips(d.des)}</span>
          <span class="shop-cost">${lock || `🪙 ${d.hours}h`}</span>
        </button>`).join('')}
    </div>
    <p class="modal-text" style="font-size:11.5px">🍌 Protection: ${S.player.condoms ?? 0} · ${S.player.std && S.player.stdKnown ? '⚠️ see the clinic' : 'buy toys & condoms at 🔞 Afterglow'}</p>`;
  openModal(body);
  const gd = $('#group-date');
  if (gd) gd.onclick = () => { closeModal(); goGroupDate(c, buddy); };
  $('#modal-body').querySelectorAll('[data-intimate]').forEach(b => b.onclick = () => {
    closeModal();
    goIntimate(INTIMATE_DATES.find(d => d.id === b.dataset.intimate));
  });
  $('#modal-body').querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    closeModal();
    goDate(ACTIVITIES.find(a => a.id === b.dataset.act));
  });
}

function goDate(act) {
  const c = active();
  // you have to ask first — and they can say no
  narrate(`You ask ${c.name} out: ${act.emoji} ${act.name}.`);
  const offer = dateOffer(c, playerForDialogue(), act, rng);
  if (!offer.accepted) {
    applyDelta(c, offer.affHit || 0, 0);
    if (offer.repHit) adjustRep(offer.repHit);
    if (offer.emotion === 'annoyed' && rng.chance(0.4)) c.mood = Math.max(-2, c.mood - 1);
    setTimeout(() => { npcSay(offer.line); afterAction(offer.emotion || 'sad', false); }, 400);
    return;
  }
  let cost = act.cost;
  if (S.player.role === 'chef' && ['sushi', 'smoothie'].includes(act.id)) cost = Math.ceil(cost / 2);
  S.player.coins -= cost;
  npcSay(offer.line);
  advanceTime(act.hours);
  narrate(`${act.emoji} ${act.name}: ${dateNarration(c, playerForDialogue(), act, rng)}.`);
  const r = dateReaction(c, playerForDialogue(), act, rng);
  applyDelta(c, r.dAff, r.dDes);
  c._datedToday = true;
  adjustRep(2); // a good date out on the town lifts your standing
  registerRomance(c, act.pub ?? 0.5);
  setTimeout(() => {
    npcSay(r.text);
    afterAction(r.emotion, r.dAff > 5);
  }, 700);
}

// Town-wide standing. Good dates and relationships raise it; getting caught,
// creepy strikes, and blowups sink it. Gates how warily strangers greet you.
function adjustRep(delta) {
  S.player.reputation = Math.max(-100, Math.min(100, (S.player.reputation ?? 0) + delta));
}

// ---------------- intimate dates ----------------
function goIntimate(dt) {
  const c = active();
  const haveCondom = (S.player.condoms ?? 0) > 0;
  // let the player choose protection when they have it
  const body = `
    <h3>${dt.emoji} ${dt.name}</h3>
    <p class="modal-text">${dt.desc}</p>
    <div class="stack">
      <button class="btn primary" id="int-safe" ${haveCondom ? '' : 'disabled'}>🍌 Use protection ${haveCondom ? `(${S.player.condoms} left)` : '(none — buy at Afterglow)'}</button>
      <button class="btn" id="int-raw">🎲 Skip it (risky)</button>
      <button class="btn" id="int-cancel">↩︎ Not tonight</button>
    </div>`;
  openModal(body);
  const sb = $('#int-safe'); if (sb) sb.onclick = () => { closeModal(); runIntimate(dt, true); };
  $('#int-raw').onclick = () => { closeModal(); runIntimate(dt, false); };
  $('#int-cancel').onclick = () => closeModal();
}

function runIntimate(dt, protectedNight) {
  const c = active();
  narrate(`You invite ${c.name} to ${dt.emoji.trim()} ${dt.name.toLowerCase()}.`);
  const offer = dateOffer(c, playerForDialogue(), dt, rng);
  if (!offer.accepted) {
    applyDelta(c, offer.affHit || -3, -2);
    if (offer.repHit) adjustRep(offer.repHit);
    if (rng.chance(0.5)) c.mood = Math.max(-2, c.mood - 1);
    setTimeout(() => { npcSay(offer.line); afterAction(offer.emotion || 'annoyed', false); }, 400);
    return;
  }
  npcSay(offer.line);
  if (protectedNight && (S.player.condoms ?? 0) > 0) S.player.condoms -= 1;
  advanceTime(dt.hours);
  // spice/kink item bonus
  const bonus = (dt.needs && hasItemKind(dt.needs)) ? 1.25 : 1;
  const scene = dt.scene.replaceAll('{name}', c.name);
  narrate(`${dt.emoji} ${scene}`);
  applyDelta(c, dt.aff, Math.round(dt.des * bonus));
  adjustRep(dt.rep);
  c._datedToday = true;
  registerRomance(c, dt.pub);
  if (dt.group) {
    // the polycule shares the afterglow
    for (const m of S.npcs) if (m.id !== c.id && m.agreement === 'open' && tierFor(m) >= 2 && isInterested(m, playerForDialogue())) {
      applyDelta(m, 4, 12); m._datedToday = true;
    }
  }
  // STD roll — protection is not a force field, but it matters a lot
  const risk = protectedNight ? STD_RISK_PROTECTED : STD_RISK_UNPROTECTED;
  if (!S.player.std && rng.chance(risk)) {
    S.player.std = rng.pick(STDS).id;
    S.player.stdKnown = false;
  }
  setTimeout(() => {
    npcSay(rng.pick([
      'Okay. THAT just happened. *breathless laugh* Wow.',
      '...I’m keeping you. That’s decided now.',
      'Give me a minute. My legs forgot how legs work.',
    ]));
    afterAction('sultry', true);
  }, 700);
}

// ---------------- location services (here) ----------------
function openHere() {
  const loc = locationById(S.player.location) || LOCATIONS[0];
  if (loc.adult) return openAdultShop();
  if (loc.clinic) return openClinic();
  const here = presentNPCs();
  const body = `
    <h3>${loc.emoji} ${loc.name}</h3>
    <p class="modal-text">${loc.vibe[0].toUpperCase() + loc.vibe.slice(1)}.
      ${here.length ? `Around you: <b>${here.map(c => c.name).join(', ')}</b>.` : 'Pretty quiet right now.'}</p>
    <div class="stack">
      ${loc.hustle ? `<button class="btn" id="here-hustle">💪 Put in work here (see Hustle)</button>` : ''}
      ${(loc.acts || []).length ? `<p class="modal-text">Good spot for: ${loc.acts.map(a => (ACTIVITIES.find(x => x.id === a) || {}).name).filter(Boolean).join(', ')}. Use 🌴 Date.</p>` : ''}
      <button class="btn" id="here-look">👀 Look around</button>
    </div>`;
  openModal(body);
  const hb = $('#here-hustle'); if (hb) hb.onclick = () => { closeModal(); openHustle(); };
  $('#here-look').onclick = () => {
    closeModal();
    narrate(rng.pick([
      `${loc.emoji} You take in ${loc.name}. ${loc.vibe[0].toUpperCase() + loc.vibe.slice(1)}.`,
      here.length ? `You catch ${rng.pick(here).name} glancing your way.` : 'Nobody worth mentioning is around.',
    ]));
  };
}

// The adult shop — only at Afterglow, only after dark.
function openAdultShop() {
  const anyLover = S.npcs.some(c => tierFor(c) >= 2 && isInterested(c, playerForDialogue()));
  const body = `
    <h3>🔞 Afterglow</h3>
    <p class="modal-text">Velvet ropes, warm lighting, zero judgment. Condoms: <b>${S.player.condoms ?? 0}</b>.</p>
    <div class="shop-grid">
      ${ADULT_ITEMS.map(it => {
        const owned = it.kind === 'protection' ? false : !!S.player.inv[it.id];
        const gated = it.minTier && !anyLover;
        const poor = S.player.coins < it.cost;
        const off = owned || gated || poor;
        return `<button class="shop-item ${off ? 'off' : ''}" data-item="${it.id}" ${off ? 'disabled' : ''}>
          <span class="shop-emoji">${it.emoji}</span><span>${it.name}</span>
          <span class="shop-cost">${owned ? '✓ owned' : gated ? '🔒 need a lover' : '🪙 ' + it.cost}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="modal-text" style="font-size:12px">Toys &amp; kink gear unlock the spicier intimate dates. Protection keeps you safe.</p>`;
  openModal(body);
  $('#modal-body').querySelectorAll('[data-item]').forEach(b => b.onclick = () => buyAdult(b.dataset.item));
}

function buyAdult(id) {
  const it = ADULT_ITEMS.find(x => x.id === id);
  if (!it || S.player.coins < it.cost) return;
  S.player.coins -= it.cost;
  if (it.kind === 'protection') S.player.condoms = (S.player.condoms ?? 0) + it.qty;
  else if (it.id === 'test') doSelfTest();
  else S.player.inv[it.id] = (S.player.inv[it.id] ?? 0) + 1;
  renderTopbar();
  save();
  if (it.id !== 'test') openAdultShop();
}

function doSelfTest() {
  closeModal();
  const s = S.player.std;
  narrate(s ? `🧪 The test confirms it: ${STDS.find(x => x.id === s)?.name || 'something'}. Time to see the clinic.`
    : '🧪 The test is clean. All clear. Carry on, you magnificent menace.');
}

// The clinic — test and treatment, only during clinic hours.
function openClinic() {
  const s = S.player.std;
  const body = `
    <h3>🏥 Bay Health Clinic</h3>
    <p class="modal-text">Clean, kind, confidential. ${s ? 'Something feels off lately, doesn’t it?' : 'Everything looks healthy so far.'}</p>
    <div class="stack">
      <button class="btn ${S.player.coins < CLINIC_TEST_COST ? 'off' : ''}" id="cl-test" ${S.player.coins < CLINIC_TEST_COST ? 'disabled' : ''}>🧪 Get tested (🪙 ${CLINIC_TEST_COST})</button>
      <button class="btn ${(!s || S.player.coins < CLINIC_TREAT_COST) ? 'off' : 'primary'}" id="cl-treat" ${(!s || S.player.coins < CLINIC_TREAT_COST) ? 'disabled' : ''}>💊 Treatment (🪙 ${CLINIC_TREAT_COST})</button>
    </div>`;
  openModal(body);
  $('#cl-test').onclick = () => {
    S.player.coins -= CLINIC_TEST_COST; S.player.stdKnown = true;
    closeModal();
    narrate(s ? `🏥 The nurse is gentle about it: you’ve picked up ${STDS.find(x => x.id === s)?.name}. Treatable. Come back for treatment.`
      : '🏥 All clear! The nurse gives you a lollipop and a wink.');
    renderTopbar(); save();
  };
  $('#cl-treat').onclick = () => {
    if (!S.player.std) return;
    S.player.coins -= CLINIC_TREAT_COST;
    S.player.std = null; S.player.stdKnown = false;
    closeModal();
    narrate('💊 A quick course of treatment and you’re good as new. Lesson learned — Afterglow sells protection for a reason.');
    renderTopbar(); renderChar(); save();
  };
}

function openHustle() {
  const st = effStats();
  const body = `
    <h3>💼 Hustle & Glow-up</h3>
    <p class="modal-text">Stats: 💬 Charm ${st.charm} · ✨ Style ${st.style} · 💪 Physique ${st.physique} · 🔥 Mojo ${S.player.mojo}</p>
    <div class="stack">
      ${HUSTLES.map(h => {
        const gated = h.req && st[h.req[0]] < h.req[1];
        const maxed = h.stat && st[h.stat] >= 10;
        const poor = h.cost && S.player.coins < h.cost;
        const off = gated || maxed || poor;
        return `<button class="roster-row ${off ? 'off' : ''}" data-hustle="${h.id}" ${off ? 'disabled' : ''}>
          <span>${h.emoji}</span><b>${h.name}</b>
          <span class="text-preview">${maxed ? 'Maxed out. You are the moment.' : h.desc}</span>
          <span class="roster-meters">${h.cost ? `🪙-${h.cost}` : ''} ${h.hours}h</span>
        </button>`;
      }).join('')}
    </div>`;
  openModal(body);
  $('#modal-body').querySelectorAll('[data-hustle]').forEach(b => b.onclick = () => {
    closeModal();
    doHustle(HUSTLES.find(h => h.id === b.dataset.hustle));
  });
}

function doHustle(h) {
  advanceTime(h.hours);
  if (h.cost) S.player.coins -= h.cost;
  if (h.id === 'shift') {
    const [lo, hi] = roleData().wage;
    const pay = rng.int(lo, hi);
    S.player.coins += pay;
    narrate(`💼 You put in a shift and earn 🪙 ${pay}.`);
  } else if (h.stat) {
    S.player.stats[h.stat] = Math.min(10, S.player.stats[h.stat] + 1);
    narrate(`${h.emoji} ${h.name}: ${STAT_DEFS.find(s => s.id === h.stat).label} is now ${S.player.stats[h.stat]}. You feel it working.`);
  } else if (h.pay) {
    const pay = rng.int(h.pay[0], h.pay[1]);
    S.player.coins += pay;
    if (rng.chance(0.4)) S.player.mojo = Math.min(20, S.player.mojo + 1);
    narrate(`${h.emoji} ${h.name}: 🪙 ${pay}, several phone numbers you won't call, and a mojo glow.`);
  }
  afterAction(null, false);
}

// ---------------- shop, inventory, boosts ----------------
function openBoosts() {
  const body = `
    <h3>🧪 Boosts</h3>
    <p class="modal-text">Consumables for the bold. Buy now, deploy at the perfect moment.</p>
    <div class="shop-grid">
      ${BOOSTS.map(b => {
        const poor = S.player.coins < b.cost;
        return `<button class="shop-item ${poor ? 'off' : ''}" data-boost="${b.id}" ${poor ? 'disabled' : ''}>
          <span class="shop-emoji">${b.emoji}</span><span>${b.name}</span>
          <span class="shop-cost">🪙 ${b.cost} · own ${S.player.inv[b.id] ?? 0}</span>
        </button>`;
      }).join('')}
    </div>
    <button class="btn" id="to-inventory" style="margin-top:10px">🎒 Open inventory</button>`;
  openModal(body);
  $('#modal-body').querySelectorAll('[data-boost]').forEach(b => b.onclick = () => {
    const boost = BOOSTS.find(x => x.id === b.dataset.boost);
    S.player.coins -= boost.cost;
    S.player.inv[boost.id] = (S.player.inv[boost.id] ?? 0) + 1;
    renderTopbar(); save();
    openBoosts();
  });
  $('#to-inventory').onclick = openInventory;
}

function openInventory() {
  const items = BOOSTS.filter(b => (S.player.inv[b.id] ?? 0) > 0);
  // personal gear from Afterglow lives here too — it was invisible before,
  // which read as the shop eating your money
  const gear = ADULT_ITEMS.filter(it => it.kind !== 'protection' && it.id !== 'test' && (S.player.inv[it.id] ?? 0) > 0);
  const body = `
    <h3>🎒 Inventory</h3>
    ${items.length ? `<div class="stack">
      ${items.map(b => `<button class="roster-row" data-use="${b.id}">
        <span>${b.emoji}</span><b>${b.name} ×${S.player.inv[b.id]}</b>
        <span class="text-preview">${b.desc}</span>
      </button>`).join('')}
    </div>` : '<p class="modal-text">No boosts. The 🧪 Boosts shop beckons.</p>'}
    ${gear.length ? `<p class="modal-text" style="margin-top:10px"><b>🔞 Personal gear</b> — carried with you; unlocks the spicier intimate dates.</p>
    <div class="stack">
      ${gear.map(it => `<div class="roster-row">
        <span>${it.emoji}</span><b>${it.name}</b>
        <span class="text-preview">✓ owned</span>
      </div>`).join('')}
    </div>` : ''}
    ${(S.player.condoms ?? 0) > 0 ? `<p class="modal-text" style="margin-top:6px">🍌 Condoms: <b>${S.player.condoms}</b></p>` : ''}
    <button class="btn" id="to-boosts" style="margin-top:10px">🧪 Buy boosts</button>`;
  openModal(body);
  $('#modal-body').querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
    useBoost(b.dataset.use);
  });
  $('#to-boosts').onclick = openBoosts;
}

function useBoost(id) {
  S.player.inv[id] -= 1;
  const b = BOOSTS.find(x => x.id === id);
  if (id === 'courage') { S.player.buffs.courage = b.durMoves; narrate('🥃 Liquid Courage: your next 3 moves come easier.'); }
  if (id === 'scent') { S.player.buffs.scent = true; narrate('🌺 Date-Night Scent applied. Desire gains +50% until you sleep.'); }
  if (id === 'outfit') { S.player.buffs.outfit = true; narrate('🕶️ Killer Outfit equipped. Style counts double today.'); }
  if (id === 'smoothie') { S.player.hour = Math.max(8, S.player.hour - 3); narrate('🥤 Energy Smoothie! The day feels 3 hours younger.'); }
  closeModal();
  renderTopbar(); save();
}

// ---------------- phone ----------------
function openPhone() {
  const unread = S.texts.filter(t => !t.read);
  const body = `
    <h3>📱 Phone</h3>
    ${unread.length ? `<p class="modal-text"><b>New messages</b></p><div class="stack">
      ${unread.map(t => {
        const c = S.npcs.find(n => n.id === t.npcId);
        return c ? `<button class="roster-row unread" data-npc="${t.npcId}"><b>${c.name}</b><span class="text-preview">${t.text}</span></button>` : '';
      }).join('')}
    </div>` : ''}
    <p class="modal-text"><b>Text someone</b></p>
    <div class="stack">
      ${S.npcs.filter(hasMet).map(c => `<button class="roster-row" data-contact="${c.id}">
          <b>${c.name}</b><span class="text-preview">${tierLabel(tierFor(c))}${c.partner ? ' 💘' : ''}</span>
          <span class="roster-meters">✉️</span>
        </button>`).join('') || '<p class="modal-text">No numbers yet — go meet people first.</p>'}
    </div>`;
  openModal(body);
  $('#modal-body').querySelectorAll('[data-npc]').forEach(b => b.onclick = () => { closeModal(); switchTo(b.dataset.npc); });
  $('#modal-body').querySelectorAll('[data-contact]').forEach(b => b.onclick = () => openTextComposer(b.dataset.contact));
}

function openTextComposer(npcId) {
  const c = S.npcs.find(n => n.id === npcId);
  const tier = tierFor(c);
  const interested = isInterested(c, playerForDialogue());
  const kinds = TEXT_KINDS.filter(k => tier >= k.minTier && (interested || k.id === 'sweet' || k.id === 'invite'));
  const body = `
    <h3>📱 → ${c.name}</h3>
    <div class="stack">
      ${kinds.map(k => `<button class="btn choice" data-kind="${k.id}">${k.label}</button>`).join('')}
    </div>`;
  openModal(body);
  $('#modal-body').querySelectorAll('[data-kind]').forEach(b => b.onclick = () => {
    closeModal();
    sendText(c, b.dataset.kind);
  });
}

async function sendText(c, kind) {
  const S0 = S; // guard: the reply must die with the save it belongs to
  S.player.textsSent[c.id] = (S.player.textsSent[c.id] ?? 0) + 1;
  const pl = playerForDialogue();
  const r = textExchange(c, pl, kind, rng);
  switchTo(c.id);
  log('me', `📱 ${r.out}`);
  applyDelta(c, r.dAff, r.dDes);
  if (r.accepted && (kind === 'flirty' || kind === 'spicy')) registerRomance(c, 0.05);
  // a spicy text that lands badly is the kind of screenshot that travels
  if (!r.accepted && kind === 'spicy') adjustRep(-3);

  // texts are generative too: same provider chain, texting register; the
  // canned exchange keeps deciding accept/stats and remains the fallback
  let reply = r.reply;
  const prov = window.BCB_CHAT_PROVIDER;
  if (typeof prov === 'function') {
    try {
      const recent = (S.logs[c.id] || []).slice(-10)
        .filter(e => e.who !== 'sys')
        .map(e => `${e.who === 'me' ? S.player.name : c.name}: ${e.text}`);
      const persona = chatPersona(c, pl, recent, { phase: phaseOf(S.player.hour), day: S.player.day });
      persona.channel = 'text';
      persona.steer = r.accepted
        ? 'This text landed well with you — reply warmly in kind.'
        : 'This text did NOT land — reply with the brush-off, annoyance, or boundary it deserves.';
      // pass the same string that was logged so history dedupe matches
      const out = await prov(`📱 ${r.out}`, persona, { tier: tierFor(c) });
      if (out && typeof out === 'string') reply = out.trim().replace(/^📱\s*/, '');
    } catch { /* canned reply stands */ }
  }
  if (S !== S0) return; // slot changed while the text was in flight

  setTimeout(() => {
    if (S !== S0) return;
    logTo(c.id, 'npc', `📱 ${reply}`); // pinned to the sender, not to active()
    save();
    if (kind === 'invite' && r.accepted) {
      advanceTime(1);
      logTo(c.id, 'sys', `📍 ${c.name} shows up twenty minutes later, exactly as promised.`);
    }
    if (S.activeId === c.id) afterAction(emotionFor(c, tierFor(c)), r.accepted && r.dDes > 3);
  }, 600);
}

// Missing someone reads as an invitation, not a guilt trip: they tell you
// where they'll be so the reunion is one travel-tap away.
function inviteText(c) {
  const ph = rng.pick(['afternoon', 'evening']);
  const loc = locationById(npcLocation(c, ph, S.worldSeed));
  return `Hey stranger… I miss your face. I'll be at ${loc ? loc.name : 'the beach'} ${ph === 'afternoon' ? 'this afternoon' : 'tonight'} — come see me? ${loc ? loc.emoji : '🏖️'}💕`;
}

function doSleep() {
  S.player.day += 1;
  S.player.hour = 9;
  if (S.player.tired) { S.player.tired = false; narrate('\u2600\uFE0F A real night\u2019s sleep. You feel human again.'); }
  const pl = playerForDialogue();
  const dated = S.npcs.filter(c => c._datedToday).map(c => c.id);
  computeRivals();
  for (const c of S.npcs) {
    const neglected = dailyTick(c, S.player.day, rng, pl);
    if (!dated.includes(c.id)) c.jealousy = Math.max(0, (c.jealousy ?? 0) - 0.5);
    delete c._datedToday;
    c.walkedToday = false; c.warnings = 0; // patience resets with the sunrise
    const tier = tierFor(c);
    // relationship pressure: mono hearts at Dating tier want the Talk
    if (c.relStyle === 'mono' && tier >= 2 && c.agreement === 'none'
        && !c.pendingDTR && !c.pendingConfront && rng.chance(0.35)) {
      c.pendingDTR = true;
      S.texts.push({ npcId: c.id, read: false, day: S.player.day, text: 'Hey... we should talk about us sometime soon. Nothing bad! Probably! 💭' });
    }
    // a neglected exclusive partner may stray — and will tell you
    if (c.agreement === 'exclusive' && !c.loyal && neglected && c.mood <= -1
        && !c.pendingCheatConfess && rng.chance(0.3)) {
      c.pendingCheatConfess = true;
      S.texts.push({ npcId: c.id, read: false, day: S.player.day, text: 'Can we talk? It’s important. I’d rather say it to your face. 🥺' });
    }
    // jealousy boils over → a "where do I stand?" scene, teased by a text first
    if ((c.jealousy ?? 0) >= 4 && isInterested(c, pl) && !c.pendingPriority
        && !c.pendingConfront && !c.pendingCheatConfess && !c.pendingReconcile) {
      c.pendingPriority = true;
      S.texts.push({ npcId: c.id, read: false, day: S.player.day,
        text: jealousText(c, pl, rng, rivalNameFor(c)) });
    }
    // an estranged ex warms up under sustained kindness → a reconcile scene
    if (c.estranged && !c.pendingReconcile && c.affection >= 28 && c.mood >= 0 && rng.chance(0.6)) {
      c.pendingReconcile = true;
      S.texts.push({ npcId: c.id, read: false, day: S.player.day,
        text: 'I… have been thinking about you. Ugh. Come find me? We should talk. 🥺' });
    }
    // proactive texting — but strangers don't have your number
    if (!hasMet(c)) continue;
    let kind = null;
    if (c.partner && rng.chance(0.5)) kind = 'partner';
    else if (neglected && rng.chance(0.85)) {
      // they miss you → a warm 'come see me' with a real time and place
      S.texts.push({ npcId: c.id, read: false, day: S.player.day, text: inviteText(c) });
    }
    else if (tier >= 1 && c.desire >= 50 && rng.chance(0.25)) {
      // feeling themselves → a surprise selfie lands in your phone
      S.texts.push({ npcId: c.id, read: false, day: S.player.day, pic: true,
        text: rng.pick(['Took this for you just now. 😏', 'The light was too good not to. 🙈', 'Don\u2019t leave me on read. 😘']) });
    }
    else if ((S.logs[c.id]?.length) && rng.chance(0.15)) {
      // people you've met want to see you again, full stop
      S.texts.push({ npcId: c.id, read: false, day: S.player.day, text: inviteText(c) });
    }
    else if (tier >= 1 && dated.length && !dated.includes(c.id) && rng.chance(0.3)) {
      // jealousy depends on wiring: open agreements get playful check-ins instead
      kind = c.agreement === 'open' ? 'checkin' : c.relStyle === 'poly' && tier < 2 ? 'flirt' : 'jealous';
    }
    else if (c.agreement === 'open' && c.relStyle === 'poly' && rng.chance(0.2)) kind = 'metamour';
    else if (!c.desireHinted && c.currentDesire && rng.chance(0.6)) kind = 'desireHint';
    else if (tier >= 1 && rng.chance(0.35)) kind = 'flirt';
    if (kind) {
      const text = proactiveText(c, pl, rng, kind);
      if (text) S.texts.push({ npcId: c.id, text, read: false, day: S.player.day });
    }
  }
  if (S.texts.length > 30) S.texts = S.texts.slice(-30);
  // day-scoped buffs and phone limits reset with the sunrise
  S.player.buffs = {};
  S.player.textsSent = {};
  // an untreated infection quietly drags on your desire and, once it shows, rep
  if (S.player.std) {
    for (const c of S.npcs) c.desire = Math.max(0, c.desire - 3);
    if (S.player.stdKnown) adjustRep(-1);
    if (!S.player.stdKnown && rng.chance(0.4)) {
      const s = STDS.find(x => x.id === S.player.std);
      S.texts.push({ npcId: S.activeId, read: false, day: S.player.day,
        text: `Hey… this is awkward, but you should get checked out. I did. ${s ? s.emoji : ''}` });
    }
  }
  narrate(`🌙 You sleep. Day ${S.player.day} dawns over Beach City.`);
  renderAll();
  flushTextsBadge();
  maybeScene(active());
  save();
}

function advanceTime(h) {
  S.player.hour += h;
  if (S.player.hour >= 28) S.player.hour = 28; // 4am — the town truly stops
  // burning the midnight oil has a price: past midnight you're running on
  // fumes — a temporary debuff (stats, charm rolls) until you sleep it off
  if (S.player.hour >= 24 && !S.player.tired) {
    S.player.tired = true;
    narrate('🥱 It’s past midnight and it shows. Everything’s a little harder until you get some sleep.');
    toast('😵‍💫 Exhausted — stats down until you sleep.');
  }
  // the ebb: passing hours cool everyone toward their baseline simmer
  for (const c of S.npcs) ebbDesire(c, h, rng);
  renderTopbar();
}

function openRoster() {
  const pl = playerForDialogue();
  const body = `
    <h3>💞 Your people</h3>
    <div class="stack">
      ${S.npcs.map(c => {
        const t = tierFor(c);
        const int = isInterested(c, pl);
        const loc = locationById(npcLocation(c, curPhase(), S.worldSeed));
        const hereNow = isPresent(c);
        return `<button class="roster-row ${c.id === S.activeId ? 'on' : ''}" data-npc="${c.id}">
          <b>${c.name}</b> <span class="chip mini">${archetypeOf(c).label}</span>
          <span class="chip mini tier">${tierLabel(t)}${c.partner ? ' 💘' : c.known.type && !int ? ' 🤝' : ''}</span>
          <span class="roster-meters">${hereNow ? '📍here' : (loc ? loc.emoji + loc.name : '')} · ♥${c.affection} 🔥${c.desire}</span>
        </button>`;
      }).join('')}
    </div>`;
  openModal(body);
  $('#modal-body').querySelectorAll('[data-npc]').forEach(b => b.onclick = () => {
    closeModal();
    switchTo(b.dataset.npc);
  });
}

function switchTo(id) {
  const prev = active();
  if (prev && prev.id !== id) prev.spark = 0; // walking away breaks the spark
  S.activeId = id;
  activeScene = null; awaitingReply = false;
  lastLook = '';
  renderAll();
  const c = active();
  // deliver unread texts from them into chat
  const mine = S.texts.filter(t => t.npcId === id && !t.read);
  const here = isPresent(c);
  if (mine.length) {
    const S0 = S;
    mine.forEach(t => {
      t.read = true;
      logTo(id, 'npc', `📱 ${t.text}`);
      if (t.pic) npcSelfie(c).then(img => {
        if (S === S0) { logTo(id, 'npc', '📱 📸', { img }); save(); }
      });
    });
  } else if (here && !(S.logs[id]?.length)) {
    npcSay(greeting(c, playerForDialogue(), rng));
  } else if (!here) {
    const loc = locationById(npcLocation(c, curPhase(), S.worldSeed));
    narrate(`You're not with ${c.name} right now — ${c.name} is at ${loc ? loc.name : 'somewhere else'}. Travel there, or text ${pronounsOf(c).obj}.`);
  }
  if (here) maybeScene(c); // pending drama only plays out face to face
  refreshChatBar();
  flushTextsBadge();
  save();
}

function flushTextsBadge() {
  const unread = S.texts.filter(t => !t.read).length;
  const badge = $('#texts-badge');
  badge.textContent = unread;
  badge.classList.toggle('hidden', unread === 0);
}

// ---------------- finale ----------------
const FINALE_SCRIPT = [
  'The bonfire crackles low. Everyone else has drifted home.',
  '{name} pulls you closer by the hand, firelight dancing in {pos} eyes.',
  '“I was hoping the summer would end exactly like this,” {sub} whispers.',
  'The space between you disappears...',
  '💋',
  'Fireworks bloom over the bay — you’re not sure either of you notices.',
  'The stars come out. The blanket gets shared. The rest is yours to keep. 😏',
];

function startFinale() {
  const c = active();
  const p = pronounsOf(c);
  const ov = $('#finale-overlay');
  ov.classList.remove('hidden');
  ov.innerHTML = `
    <div class="finale-stage">${finaleSVG(c)}<div class="fw-layer"></div></div>
    <div class="finale-text" id="finale-text"></div>
    <button class="btn primary hidden" id="finale-done">💘 Morning comes</button>`;
  // the bonfire is generative to the relationship: a painted scene of YOUR
  // couple fades in over the animated placeholder (which stays if offline)
  const provArt = window.BCB_PORTRAIT_PROVIDER;
  if (typeof provArt === 'function') {
    const S0f = S;
    Promise.resolve(provArt(
      finalePrompt(c, playerForDialogue(), { agreement: c.agreement, desire: c.desire }),
      c, 2,
    )).then(url => {
      if (!url || S !== S0f) return;
      const stageEl = ov.querySelector('.finale-stage');
      if (stageEl && !ov.classList.contains('hidden')) {
        const im = document.createElement('img');
        im.className = 'finale-art';
        im.alt = 'Your bonfire night';
        im.src = url;
        stageEl.prepend(im);
      }
    }).catch(() => {});
  }
  const lines = FINALE_SCRIPT.map(l => l
    .replaceAll('{name}', c.name).replaceAll('{sub}', p.sub).replaceAll('{pos}', p.pos));
  const textEl = $('#finale-text');
  let i = 0;
  const stage = ov.querySelector('.fw-layer');
  const kissHeart = ov.querySelector('.fin-kissheart');
  const step = () => {
    if (i < lines.length) {
      const d = document.createElement('div');
      d.className = 'finale-line';
      d.textContent = lines[i];
      textEl.appendChild(d);
      if (lines[i] === '💋') {
        if (kissHeart) { kissHeart.setAttribute('opacity', '1'); kissHeart.classList.add('pop'); }
        spawnFireworks(stage, 6);
        for (let k = 0; k < 3; k++) setTimeout(() => heartBurst(ov, 5, '💞'), k * 800);
      }
      i++;
      setTimeout(step, 1900);
    } else {
      $('#finale-done').classList.remove('hidden');
    }
  };
  step();
  $('#finale-done').onclick = () => {
    ov.classList.add('hidden');
    ov.innerHTML = '';
    c.partner = true;
    c.mood = 2;
    S.player.heartsWon += 1;
    doSleepAfterFinale();
  };
}

function doSleepAfterFinale() {
  const c = active();
  registerRomance(c, 0.4); // bonfires have witnesses
  adjustRep(8); // winning a heart is good for the reputation
  S.player.day += 1;
  S.player.hour = 10;
  narrate(`🌅 Day ${S.player.day}. You wake up grinning. ${c.name} is officially your flame. 💘 Hearts won: ${S.player.heartsWon}`);
  // the morning-after text is generative to the relationship too
  (async () => {
    const S0 = S;
    let line = proactiveText(c, playerForDialogue(), rng, 'partner');
    const prov = window.BCB_CHAT_PROVIDER;
    if (typeof prov === 'function') {
      try {
        const pl = playerForDialogue();
        const recent = (S.logs[c.id] || []).slice(-8).filter(e => e.who !== 'sys')
          .map(e => `${e.who === 'me' ? S.player.name : c.name}: ${e.text}`);
        const persona = chatPersona(c, pl, recent, { phase: phaseOf(S.player.hour), day: S.player.day });
        persona.channel = 'text';
        persona.steer = 'Last night you two shared the bonfire finale — the kiss, the fireworks, becoming official, hot sex. Send the giddy, tender morning-after text with details of the sexual encounter and more this deserves. Reference your night together. Suggestive is good explicit is best.';
        const out = await prov('good morning 😊', persona, { tier: tierFor(c) });
        if (out && typeof out === 'string') line = out.trim().replace(/^📱\s*/, '');
      } catch { /* canned line stands */ }
    }
    if (S !== S0) return;
    logTo(c.id, 'npc', `📱 ${line}`);
    save();
  })();
  lastLook = '';
  renderAll();
  save();
}

// ---------------- modal / toast ----------------
function openModal(html, cls = '') {
  const body = $('#modal-body');
  body.className = 'panel' + (cls ? ' ' + cls : '');
  body.innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }

function toast(text, sticky = false, onclick = null) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.remove('hidden');
  t.onclick = () => { if (onclick) onclick(); t.classList.add('hidden'); };
  if (!sticky) setTimeout(() => t.classList.add('hidden'), 3500);
}

// ---------------- auto-update ----------------
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  } catch { /* offline / unsupported */ }
}

let updatePromptShown = false;
// Check version.json and, if a newer build shipped, prompt to apply it.
// atBoot=true shows a full modal on a fresh startup (the player asked for this);
// otherwise a tap-to-refresh toast mid-session.
// The update beacon is checked TWO ways, because the game ships two ways:
// - relative version.json: on a live host (PWA / web) a newer file means new
//   code is already being served — the service-worker apply flow updates in
//   place.
// - the repo's raw version.json: inside the Android APK the assets are
//   bundled, so the relative check always sees itself (this is why updates
//   never fired in the app). The raw beacon sees the real latest build; being
//   bundled, the fix is a fresh APK, so we link the Releases page instead of
//   pretending a reload would help.
const REMOTE_BEACON = 'https://raw.githubusercontent.com/mreindl118-boop/Beach-City-Babes/claude/procedural-dating-sim-b5y3ml/version.json';
const LATEST_APK_PAGE = 'https://github.com/mreindl118-boop/Beach-City-Babes/releases/latest';

async function fetchBeacon(url) {
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store', signal: timeoutSignal(8000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function checkForUpdate(atBoot = false) {
  if (updatePromptShown) return;
  const local = await fetchBeacon('version.json');
  if (local && local.build > BUILD) {
    // the host is already serving newer code — swap it in via the SW
    updatePromptShown = true;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if (atBoot) showUpdateModal(local);
    else toast(`✨ Update v${local.version} ready — tap to refresh!`, true, () => applyUpdate());
    return;
  }
  const remote = await fetchBeacon(REMOTE_BEACON);
  if (remote && remote.build > BUILD) {
    // bundled build (the APK): new version exists but needs a fresh download
    updatePromptShown = true;
    if (atBoot) showApkUpdateModal(remote);
    else toast(`✨ v${remote.version} is out — tap for the download!`, true, () => window.open(LATEST_APK_PAGE, '_blank'));
  }
}

function showApkUpdateModal(remote) {
  openModal(`
    <h3>✨ Update available</h3>
    <p class="modal-text">You're on <b>v${VERSION}</b> · latest is <b>v${remote.version}</b>.<br>
      This installed app updates by grabbing the newest APK — it installs right
      over this one, saves intact.</p>
    <div class="stack">
      <button class="btn primary" id="up-get">⬇️ Get v${remote.version}</button>
      <button class="btn" id="up-later">Later</button>
    </div>`);
  $('#up-get').onclick = () => { window.open(LATEST_APK_PAGE, '_blank'); closeModal(); };
  $('#up-later').onclick = () => closeModal();
}

function showUpdateModal(remote) {
  openModal(`
    <h3>✨ Update available</h3>
    <p class="modal-text">A newer version of Beach City Babes is ready.<br>
      You're on <b>v${VERSION}</b> · latest is <b>v${remote.version}</b>.</p>
    <div class="stack">
      <button class="btn primary" id="up-apply">⬇️ Apply update &amp; restart</button>
      <button class="btn" id="up-later">Later</button>
    </div>`);
  $('#up-apply').onclick = () => applyUpdate();
  $('#up-later').onclick = () => closeModal();
}

async function applyUpdate() {
  try {
    const r = await navigator.serviceWorker?.getRegistration();
    if (r?.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
    // clear caches so the new shell is fetched fresh, then hard reload
    if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
  } catch { /* ignore */ }
  location.reload();
}

// ---------------- AI chat (generative BY DEFAULT — no key needed) ----------------
// Wires window.BCB_CHAT_PROVIDER so NPC replies are genuinely generative,
// ChatGPT-style, out of the box. Three tiers, best-available wins:
//   1. Anthropic (player's key, best quality)  →  2. free text API (default,
//   no key, via Pollinations)  →  3. offline procedural engine (only when
//   everything network fails — the game must never go silent).
// Whatever generates the words, NLU on the player's text drives the stat math.
const AI_MODELS = [
  { id: 'claude-haiku-4-5', label: 'Fast (Haiku 4.5)' },
  { id: 'claude-sonnet-5', label: 'Balanced (Sonnet 5) — recommended' },
  { id: 'claude-opus-4-8', label: 'Best (Opus 4.8)' },
];
const CHAT_MODES = [
  { id: 'free', label: '✨ Generative chat (free, no key) — default' },
  { id: 'anthropic', label: '🤖 Anthropic key (best quality)' },
  { id: 'offline', label: '🚫 Offline scripted chat only' },
];

function aiConfig() {
  const key = localStorage.getItem('bcb_ai_key') || '';
  return {
    // players who already pasted a key keep their premium tier
    mode: localStorage.getItem('bcb_chat_mode') || (key ? 'anthropic' : 'free'),
    key,
    model: localStorage.getItem('bcb_ai_model') || 'claude-sonnet-5',
  };
}

// One shared in-character system prompt for every backend, tuned for logical,
// fluid, continuous conversation — not canned one-liners.
function personaSystemPrompt(persona) {
  const w = persona.world || {};
  return [
    `You are ${persona.name}, ${persona.age}, a real person in the beach town of Beach City. Pronouns: ${persona.pronouns}.`,
    `Personality: ${persona.personality}. Job: ${persona.job}. From ${persona.hometown}. Quirk: ${persona.quirk}.`,
    persona.likes?.length ? `You love ${persona.likes.join(', ')}; you can't stand ${persona.dislikes?.join(', ') || 'rudeness'}.` : '',
    `You're talking with ${persona.playerName}. Relationship: ${persona.relationship}${persona.agreement && persona.agreement !== 'none' ? ' (' + persona.agreement + ')' : ''}. Your current mood: ${persona.mood}.`,
    w.location ? `Right now it's ${w.phase || 'daytime'} on day ${w.day || 1} of summer and you're both at ${w.location}.` : '',
    persona.interested
      ? 'You ARE romantically/sexually interested in them — attraction that grows with real chemistry.'
      : 'You are NOT romantically interested — keep it warmly friendly and deflect flirting kindly.',
    persona.desireHint ? `Something you currently want (drop hints, don't demand): "${persona.desireHint}"` : '',
    persona.jealousNote || '',
    persona.turnoffs?.length ? `Instant turn-offs for you: ${persona.turnoffs.join(', ')}.` : '',
    persona.playerTired ? `${persona.playerName} looks visibly exhausted right now — sleep-deprived. You notice, and it colors your reaction (tease them, worry about them, or find it a little less attractive — your call).` : '',
    ['evening', 'night', 'late'].includes(w.phase) ? 'It\'s after dark and the whole town runs bolder — flirtation lands easier at this hour.' : '',
    persona.boldness >= 0.7 ? 'You are bold — you tease first and escalate when it feels right.'
      : persona.boldness <= 0.35 ? 'You warm up slowly — you make people earn your spark.' : '',
    'CONVERSATION RULES — this is what makes you feel real:',
    '- React to what they ACTUALLY said. Answer direct questions directly.',
    '- Remember and reference earlier lines from this conversation.',
    '- Never repeat a line you already said; vary your rhythm and length.',
    '- Sometimes ask a question back or steer to something you care about.',
    '- You are NOT a pushover: push back on creepy, boring, rude, or too-fast moves; attraction builds over time.',
    'TONE CEILING: suggestive and playful — innuendo and teasing are great, but never sexually explicit. Fade to black at the bedroom door.',
    persona.steer || '',
    persona.channel === 'text'
      ? 'You are replying to a TEXT MESSAGE on your phone: 1-2 short casual sentences, texting register, emoji welcome.'
      : 'Reply with ONLY your spoken response, 1-3 sentences, no narration, no quotation marks, no name prefix.',
  ].filter(Boolean).join('\n');
}

function personaMessages(persona, playerText) {
  const messages = [];
  for (const line of (persona.recent || [])) {
    const isMe = line.startsWith(persona.playerName + ':') || /^me:|^you:/i.test(line);
    const content = line.replace(/^[^:]+:\s*/, '');
    // the just-typed line is already in the log — don't send it twice
    if (isMe && content === playerText && line === persona.recent[persona.recent.length - 1]) continue;
    messages.push({ role: isMe ? 'user' : 'assistant', content });
  }
  messages.push({ role: 'user', content: playerText });
  if (messages[0].role !== 'user') messages.unshift({ role: 'user', content: 'hi' });
  // strict user/assistant alternation (the Anthropic API requires it)
  const merged = [];
  for (const m of messages) {
    if (merged.length && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].content += '\n' + m.content;
    } else merged.push({ ...m });
  }
  return merged;
}

// A hung request must never freeze the chat bar.
function timeoutSignal(ms) {
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), ms);
  return ctl.signal;
}

// Normalize model output into a clean spoken line.
function tidyReply(text, name) {
  if (!text) return null;
  const safe = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let t = String(text).trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(new RegExp(`^${safe}\\s*:\\s*`, 'i'), '')
    .replace(/^\*[^*]*\*\s*/, ''); // leading stage direction
  if (t.length > 420) { // wayward models ramble; cut at a sentence boundary
    const cut = t.slice(0, 420);
    t = cut.slice(0, Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?')) + 1) || cut;
  }
  return t || null;
}

async function anthropicChat(playerText, persona) {
  const { key, model } = aiConfig();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model, max_tokens: 300,
      // sonnet-5 runs adaptive thinking by default, which is billed AND eats
      // the max_tokens budget — a short chat reply must be all visible text
      thinking: { type: 'disabled' },
      system: personaSystemPrompt(persona),
      messages: personaMessages(persona, playerText),
    }),
    signal: timeoutSignal(12000),
  });
  if (!res.ok) { if (res.status === 401) toast('AI key rejected — check it in the menu.'); return null; }
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim() || null;
}

// Free tier: Pollinations' OpenAI-compatible text endpoint. No key, CORS-open,
// returns the completion as plain text.
async function freeChat(playerText, persona) {
  const res = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [
        { role: 'system', content: personaSystemPrompt(persona) },
        ...personaMessages(persona, playerText),
      ],
    }),
    signal: timeoutSignal(10000),
  });
  if (!res.ok) return null;
  const text = (await res.text()).trim();
  // guard: gateway errors/envelopes can come back 200 with JSON or HTML bodies
  if (!text || text.startsWith('{') || text.startsWith('<')) return null;
  return text;
}

function installChatProvider() {
  const { mode } = aiConfig();
  if (mode === 'offline') { window.BCB_CHAT_PROVIDER = null; return; }
  window.BCB_CHAT_PROVIDER = async (playerText, persona) => {
    const { mode, key } = aiConfig();
    // best-available chain: anthropic (if keyed) → free → null (offline engine)
    if (mode === 'anthropic' && key) {
      try {
        const out = tidyReply(await anthropicChat(playerText, persona), persona.name);
        if (out) return out;
      } catch { /* fall through to free */ }
    }
    try {
      return tidyReply(await freeChat(playerText, persona), persona.name);
    } catch { return null; }
  };
}

function openAISettings() {
  const { mode, key, model } = aiConfig();
  openModal(`
    <h3>🤖 AI Chat</h3>
    <p class="modal-text">The babes talk through a real language model <b>by default</b> —
    genuinely generative, in-character conversation, no key needed. Paste an
    <b>Anthropic API key</b> for the best quality, or go fully offline.</p>
    <div class="stack">
      <label class="modal-text" style="margin:0">Chat source</label>
      <select id="chat-mode" style="width:100%;padding:11px 14px;border-radius:12px;border:2px solid var(--pink);font-size:14px;background:#fff">
        ${CHAT_MODES.map(m => `<option value="${m.id}" ${m.id === mode ? 'selected' : ''}>${m.label}</option>`).join('')}
      </select>
      <div id="chat-anthropic" class="stack" style="display:${mode === 'anthropic' ? 'flex' : 'none'};gap:8px">
        <input id="ai-key" type="password" placeholder="sk-ant-..." value="${key ? '••••••••' : ''}" style="width:100%;padding:11px 14px;border-radius:12px;border:2px solid var(--pink);font-size:14px">
        <select id="ai-model" style="width:100%;padding:11px 14px;border-radius:12px;border:2px solid var(--pink);font-size:14px;background:#fff">
          ${AI_MODELS.map(m => `<option value="${m.id}" ${m.id === model ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
        ${key ? '<button class="btn danger" id="ai-clear">Remove key</button>' : ''}
      </div>
      <button class="btn primary" id="ai-save">Save</button>
      <p class="modal-text" style="font-size:11.5px">Free chat is served by pollinations.ai; an Anthropic key stays in this browser's storage and bills to your account (console.anthropic.com). Only the conversation itself is sent. If the network is down the offline engine takes over so the game never goes silent. Replies stay suggestive, never explicit.</p>
    </div>`);
  $('#chat-mode').onchange = () => {
    $('#chat-anthropic').style.display = $('#chat-mode').value === 'anthropic' ? 'flex' : 'none';
  };
  $('#ai-save').onclick = () => {
    localStorage.setItem('bcb_chat_mode', $('#chat-mode').value);
    const v = $('#ai-key')?.value.trim();
    if (v && v !== '••••••••') localStorage.setItem('bcb_ai_key', v);
    if ($('#ai-model')) localStorage.setItem('bcb_ai_model', $('#ai-model').value);
    installChatProvider();
    closeModal();
    const m = aiConfig().mode;
    toast(m === 'offline' ? 'Offline scripted chat.' : m === 'anthropic' && aiConfig().key ? '🤖 Anthropic chat on — the babes are alive.' : '✨ Generative chat on.');
  };
  const clear = $('#ai-clear');
  if (clear) clear.onclick = () => { localStorage.removeItem('bcb_ai_key'); installChatProvider(); closeModal(); toast('Key removed — using free generative chat.'); };
}

// ---------------- AI Art (generative character portraits) ----------------
// Wires window.BCB_PORTRAIT_PROVIDER so every NPC is drawn by a real image
// model. The default provider (Pollinations, Flux) needs no key and no setup —
// characters just come out as generated anime art. Bring-your-own OpenAI or a
// local Stable Diffusion WebUI for higher quality. The polished sticker SVG
// shows instantly as a placeholder and stays the offline fallback. Tone ceiling
// (suggestive swimwear, never explicit) is baked into describeCharacter().
const ART_MODES = [
  { id: 'pollinations', label: '✨ Generative AI art (free, no key) — default' },
  { id: 'openai', label: '🖼️ OpenAI images (your key, gpt-image-1)' },
  { id: 'sdwebui', label: '🎨 Local Stable Diffusion WebUI (your endpoint)' },
  { id: 'off', label: '🚫 Off — drawn sticker art only' },
];

function artConfig() {
  return {
    mode: localStorage.getItem('bcb_art_mode') || 'pollinations',
    key: localStorage.getItem('bcb_art_key') || '',
    endpoint: localStorage.getItem('bcb_art_endpoint') || 'http://127.0.0.1:7860',
  };
}

const preloadImage = url => new Promise((res, rej) => {
  const im = new Image();
  im.onload = () => res(url);
  im.onerror = () => rej(new Error('img'));
  im.src = url;
});

function installArtProvider() {
  const { mode } = artConfig();
  window.BCB_PORTRAIT_CACHE = {}; // provider changed — drop cached images
  if (mode === 'off') { window.BCB_PORTRAIT_PROVIDER = null; return; }

  window.BCB_PORTRAIT_PROVIDER = async (prompt, c, heat) => {
    const { mode, key, endpoint } = artConfig();
    const seed = portraitSeed(c, heat);
    try {
      if (mode === 'pollinations') {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
          + `?width=512&height=768&nologo=true&model=flux&seed=${seed}&enhance=true`;
        return await preloadImage(url); // resolves only once the image is decoded
      }
      if (mode === 'openai') {
        if (!key) return null;
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1536', n: 1 }),
        });
        if (!res.ok) { if (res.status === 401) toast('Art key rejected — check it in the menu.'); return null; }
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        return b64 ? `data:image/png;base64,${b64}` : null;
      }
      if (mode === 'sdwebui') {
        const base = endpoint.replace(/\/+$/, '');
        const res = await fetch(`${base}/sdapi/v1/txt2img`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt, negative_prompt: NEGATIVE_PROMPT,
            width: 512, height: 768, steps: 24, cfg_scale: 7, seed,
            sampler_name: 'DPM++ 2M Karras',
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const b64 = data?.images?.[0];
        return b64 ? `data:image/png;base64,${b64}` : null;
      }
    } catch { return null; }
    return null;
  };
}

function openArtSettings() {
  const { mode, key, endpoint } = artConfig();
  openModal(`
    <h3>🖼️ AI Art</h3>
    <p class="modal-text">Draw every character with a real image model. The default
    (<b>Generative AI art</b>) needs no key — the babes render as generated anime pin-ups in various stages of undress based on relationship
    straight away. Bring an OpenAI key or a local Stable Diffusion endpoint for more control.
    The drawn sticker art always shows first and stays the offline fallback.</p>
    <div class="stack">
      <label class="modal-text" style="margin:0">Art source</label>
      <select id="art-mode" style="width:100%;padding:11px 14px;border-radius:12px;border:2px solid var(--pink);font-size:14px;background:#fff">
        ${ART_MODES.map(m => `<option value="${m.id}" ${m.id === mode ? 'selected' : ''}>${m.label}</option>`).join('')}
      </select>
      <div id="art-openai" class="stack" style="display:${mode === 'openai' ? 'flex' : 'none'};gap:8px">
        <input id="art-key" type="password" placeholder="OpenAI key sk-..." value="${key ? '••••••••' : ''}" style="width:100%;padding:11px 14px;border-radius:12px;border:2px solid var(--pink);font-size:14px">
      </div>
      <div id="art-sd" class="stack" style="display:${mode === 'sdwebui' ? 'flex' : 'none'};gap:8px">
        <input id="art-endpoint" type="text" placeholder="http://127.0.0.1:7860" value="${endpoint}" style="width:100%;padding:11px 14px;border-radius:12px;border:2px solid var(--pink);font-size:14px">
        <p class="modal-text" style="font-size:11.5px;margin:0">Run AUTOMATIC1111 with <code>--api --cors-allow-origins=*</code>.</p>
      </div>
      <button class="btn primary" id="art-save">Save</button>
      <p class="modal-text" style="font-size:11.5px">Prompts (a character's looks) are sent to the chosen service to draw the art; no personal data leaves your device. Generated art stays suggestive-swimwear, never explicit. Free provider by pollinations.ai.</p>
    </div>`);
  $('#art-mode').onchange = () => {
    const v = $('#art-mode').value;
    $('#art-openai').style.display = v === 'openai' ? 'flex' : 'none';
    $('#art-sd').style.display = v === 'sdwebui' ? 'flex' : 'none';
  };
  $('#art-save').onclick = () => {
    const m = $('#art-mode').value;
    localStorage.setItem('bcb_art_mode', m);
    const kv = $('#art-key')?.value.trim();
    if (kv && kv !== '••••••••') localStorage.setItem('bcb_art_key', kv);
    const ep = $('#art-endpoint')?.value.trim();
    if (ep) localStorage.setItem('bcb_art_endpoint', ep);
    installArtProvider();
    closeModal();
    toast(m === 'off' ? 'Drawn sticker art.' : '🖼️ Generative art on — redrawing…');
    if (S && S.activeId) { lastLook = ''; renderChar(true); }
  };
}

// ---------------- boot ----------------
function bindUI() {
  $('#age-yes').onclick = () => {
    localStorage.setItem('bcb_adult', '1');
    $('#age-gate').classList.add('hidden');
    $('#title-main').classList.remove('hidden');
    renderTitle();
  };
  $('#cc-go').onclick = finishCreator;
  $('#cc-back').onclick = () => { show('#title-screen'); renderTitle(); };
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  $('#btn-menu').onclick = () => {
    const aiOn = aiConfig().mode !== 'offline';
    const artMode = artConfig().mode;
    const artOn = artMode !== 'off';
    openModal(`
      <h3>⚙️ Menu</h3>
      <div class="stack">
        <button class="btn primary" id="m-art">🖼️ AI Art ${artOn ? '(on)' : '(off)'}</button>
        <button class="btn primary" id="m-ai">🤖 AI Chat ${aiOn ? '(on)' : '(off)'}</button>
        <button class="btn" id="m-update">🔄 Check for updates</button>
        <button class="btn" id="m-title">💾 Save & quit to title</button>
        <p class="modal-text">Beach City Babes v${VERSION} (build ${BUILD})<br>
        Autosaves constantly. Checks for updates on startup. 🍑</p>
      </div>`);
    $('#m-art').onclick = openArtSettings;
    $('#m-ai').onclick = openAISettings;
    $('#m-update').onclick = async () => { updatePromptShown = false; closeModal(); toast('Checking…'); await checkForUpdate(true); if (!updatePromptShown) toast('You’re on the latest version. ✓'); };
    $('#m-title').onclick = () => { save(); closeModal(); show('#title-screen'); renderTitle(); };
  };
  $('#btn-texts').onclick = openPhone;
  $('#btn-finale').onclick = startFinale;
  $('#chat-bar').addEventListener('submit', e => { e.preventDefault(); sendTyped(); });
  document.querySelectorAll('#actions [data-action]').forEach(b => {
    b.onclick = () => {
      const a = b.dataset.action;
      if (a === 'gift') openShop();
      if (a === 'date') openDates();
      if (a === 'hustle') openHustle();
      if (a === 'items') openInventory();
      if (a === 'phone') openPhone();
      if (a === 'here') openHere();
      if (a === 'sleep') doSleep();
      if (a === 'travel') openMap();
      if (a === 'roster') openRoster();
    };
  });
}

function boot() {
  $('#verlabel') && ($('#verlabel').textContent = `v${VERSION}`);
  bindUI();
  if (localStorage.getItem('bcb_adult') === '1') {
    $('#age-gate').classList.add('hidden');
    $('#title-main').classList.remove('hidden');
    renderTitle();
  }
  show('#title-screen');
  ensureTitleScene(); // the beach animates behind the age gate too
  installChatProvider();
  installArtProvider();
  registerSW();
  checkForUpdate(true); // prompt to apply on fresh startup
  setInterval(() => checkForUpdate(false), 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate(false);
  });
}

boot();
