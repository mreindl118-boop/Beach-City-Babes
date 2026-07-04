// Game controller: screens, state, save slots, actions, auto-update.
import { RNG, randomSeed } from './rng.js';
import {
  GIFTS, ACTIVITIES, ROLES, GENDER_LABELS, BODY_LABELS, PRONOUN_SETS,
  FINALE_MIN_AFF, FINALE_MIN_DES, tierFor, tierLabel, ARCHETYPES,
  STAT_DEFS, BOOSTS, HUSTLES, TEXT_KINDS, TEXTS_PER_NPC_PER_DAY,
  REL_LABELS, AGREEMENT_LABELS, GROUP_SCENES, GROUP_HANGOUT,
} from './data.js';
import {
  generateCharacter, archetypeOf, quirkOf, pronounsOf, isInterested,
  clampStats, dailyTick, rollDesire, currentDesireOf, ebbDesire,
  npcChemistry, ensureMeasurements, ACCENTS,
} from './characters.js';
import {
  portraitSVG, setEmotion, emotionFor, heartBurst, heatLevel,
  finaleSVG, spawnFireworks, describeCharacter, shade,
} from './art.js';
import {
  availableMoves, playerLineFor, resolveMove, giftReaction,
  dateNarration, dateReaction, proactiveText, greeting, meetLine,
  textExchange, fill,
  dtrOpen, DTR_CHOICES, resolveDTR,
  confrontOpen, CONFRONT_CHOICES, resolveConfront, resolveUltimatum,
  strayOpen, STRAY_CHOICES, resolveStray, groupAfterline,
} from './dialogue.js';
import { VERSION, BUILD } from './version.js';

const $ = sel => document.querySelector(sel);
const SLOTS = [1, 2, 3];
const slotKey = n => `bcb_slot_${n}`;

let rng = new RNG(randomSeed());
let S = null;          // live game state
let uidCounter = 0;
let lastHeat = -1;

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
  const npcs = [generateCharacter(rng, usedNames), generateCharacter(rng, usedNames), generateCharacter(rng, usedNames)];
  npcs.forEach(c => rollDesire(c, rng));
  return {
    v: 2,
    slot,
    player: {
      ...playerDef,
      coins: ROLES.find(r => r.id === playerDef.role).coins,
      day: 1, hour: 9, heartsWon: 0,
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
  }
  return data;
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

function playerForDialogue() {
  return { ...S.player, roleLabel: roleData().label, roleData: roleData() };
}

// ---------------- screens ----------------
function show(screen) {
  ['#title-screen', '#creator-screen', '#game-screen'].forEach(id => $(id).classList.add('hidden'));
  $(screen).classList.remove('hidden');
}

// ----- title / slots -----
function renderTitle() {
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
  lastHeat = -1;
  renderAll();
  const c = active();
  if (!(S.logs[c.id]?.length)) npcSay(greeting(c, playerForDialogue(), rng));
  else renderLog();
  maybeScene(c);
  flushTextsBadge();
}

function renderAll() {
  renderTopbar();
  renderChar(true);
  renderLog();
  renderActions();
}

function renderTopbar() {
  $('#coins').textContent = `🪙 ${S.player.coins}`;
  $('#daytime').textContent = `☀️ Day ${S.player.day} · ${S.player.hour}:00`;
  $('#hearts-won').textContent = `💛 ${S.player.heartsWon}`;
  const st = S.player.stats;
  const buffIcons = [
    S.player.buffs.courage > 0 ? '🥃' : '',
    S.player.buffs.scent ? '🌺' : '',
    S.player.buffs.outfit ? '🕶️' : '',
  ].join('');
  $('#stats-strip').textContent =
    `💬${st.charm} ✨${st.style} 💪${st.physique} 🔥${S.player.mojo} ${buffIcons}`;
}

function renderChar(forcePortrait = false) {
  const c = active();
  const tier = tierFor(c);
  const heat = heatLevel(c, tier);
  const p = pronounsOf(c);
  const arch = archetypeOf(c);
  const interested = isInterested(c, playerForDialogue());

  if (forcePortrait || heat !== lastHeat) {
    ensureMeasurements(c, rng);
    renderPortrait(c, tier, heat);
    lastHeat = heat;
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
  ].join('');

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
  facts.push(c.known.type ? `💘 into: ${c.attractedTo.map(g => GENDER_LABELS[g]).join(', ')}` : '💘 type: ???');
  facts.push(c.known.rel ? `${REL_LABELS[c.relStyle].chip} — ${REL_LABELS[c.relStyle].desc}` : '💞 relationship style: ???');
  $('#profile').innerHTML = facts.map(f => `<div class="fact">${f}</div>`).join('');

  const finaleReady = interested && !c.partner && c.affection >= FINALE_MIN_AFF && c.desire >= FINALE_MIN_DES;
  $('#btn-finale').classList.toggle('hidden', !finaleReady);
}

// Portrait pipeline: procedural sticker SVG by default. If the player wires
// up window.BCB_PORTRAIT_PROVIDER = async (prompt, character, heat) => dataURL
// (their own image-gen backend), generated art replaces the SVG per heat tier.
const pendingPortraits = new Set();
function renderPortrait(c, tier, heat) {
  const key = `${c.id}:${heat}`;
  window.BCB_PORTRAIT_CACHE ??= {};
  const ext = window.BCB_PORTRAIT_CACHE[key];
  if (ext) {
    $('#portrait-box').innerHTML = `<img class="portrait-ext" alt="Portrait of ${c.name}" src="${ext}">`;
    return;
  }
  $('#portrait-box').innerHTML = portraitSVG(c, `u${uidCounter++}`, tier);
  const prov = window.BCB_PORTRAIT_PROVIDER;
  if (typeof prov === 'function' && !pendingPortraits.has(key)) {
    pendingPortraits.add(key);
    Promise.resolve(prov(describeCharacter(c, tier), c, heat))
      .then(url => {
        if (url) {
          window.BCB_PORTRAIT_CACHE[key] = url;
          if (S?.activeId === c.id) { lastHeat = -1; renderChar(true); }
        }
      })
      .catch(() => {})
      .finally(() => pendingPortraits.delete(key));
  }
}

function log(who, text) {
  const c = active();
  (S.logs[c.id] ??= []).push({ who, text });
  if (S.logs[c.id].length > 60) S.logs[c.id].shift();
  renderLog();
}

function renderLog() {
  const el = $('#chat-log');
  const entries = S.logs[active().id] ?? [];
  el.innerHTML = entries.map(e => `<div class="bubble ${e.who}">${e.text}</div>`).join('');
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
function applyDelta(c, dAff, dDes) {
  c.affection += dAff;
  if (dDes > 0) {
    if (S.player.buffs.scent) dDes = Math.round(dDes * 1.5);
    c.spark = Math.min(3, (c.spark ?? 0) + 1);
    c.desire += Math.round(dDes * (1 + 0.25 * (c.spark - 1)));
  } else if (dDes < 0) {
    c.spark = 0;
    c.desire += dDes;
  }
  c.lastSeenDay = S.player.day;
  clampStats(c, playerForDialogue());
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

// Public blowups echo: friends warn each other about you.
function warnOthers(about) {
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
  if (c.pendingDTR) return sceneDTR(c, true);
  return false;
}

function presentChoices(choices, handler) {
  $('#choices').innerHTML = choices.map(ch =>
    `<button class="btn choice warm" data-scene="${ch.id}">${ch.label}</button>`).join('');
  $('#choices').querySelectorAll('[data-scene]').forEach(b => b.onclick = () => {
    $('#choices').innerHTML = '';
    handler(b.dataset.scene);
  });
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
          warnOthers(c);
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

function doTalk() {
  const c = active();
  if (maybeScene(c)) return; // pending drama outranks small talk
  const moves = availableMoves(c, playerForDialogue(), rng);
  const tier = tierFor(c);
  let html = moves.map(m =>
    `<button class="btn choice" data-move="${m.type}">${m.label}</button>`).join('');
  if (isInterested(c, playerForDialogue()) && tier >= 2 && c.agreement === 'none') {
    html += `<button class="btn choice warm" data-special="dtr">💕 Heart-to-heart</button>`;
  }
  if ((c.guilt ?? 0) > 0 && (c.agreement === 'exclusive' || tier >= 2)) {
    html += `<button class="btn choice warm" data-special="confess">😳 Come clean</button>`;
  }
  $('#choices').innerHTML = html;
  $('#choices').querySelectorAll('[data-move]').forEach(b => b.onclick = () => doMove(b.dataset.move));
  $('#choices').querySelectorAll('[data-special]').forEach(b => b.onclick = () => {
    $('#choices').innerHTML = '';
    if (b.dataset.special === 'dtr') {
      playerSay('Hey... can we talk? About us, I mean.');
      setTimeout(() => sceneDTR(c, false), 420);
    } else {
      playerSay('There’s something I need to tell you, and you deserve to hear it from me.');
      setTimeout(() => sceneConfront(c, true), 420);
    }
  });
}

function doMove(move) {
  const c = active();
  $('#choices').innerHTML = '';
  playerSay(playerLineFor(c, playerForDialogue(), move, rng));
  const r = resolveMove(c, playerForDialogue(), move, rng, roleData());
  applyDelta(c, r.dAff, r.dDes);
  // buffs & mojo bookkeeping
  if (S.player.buffs.courage > 0) S.player.buffs.courage -= 1;
  if (r.success && (move === 'SPICY' || (move === 'FLIRT' && tierFor(c) >= 2))) {
    S.player.mojo = Math.min(20, S.player.mojo + 1);
  }
  // open flirting feeds the gossip mill for anyone you've made promises to
  if (r.success && ['FLIRT', 'SPICY', 'SERENADE'].includes(move)) registerRomance(c, 0.15);
  setTimeout(() => {
    npcSay(r.npcText);
    if (r.special === 'transShare') {
      $('#choices').innerHTML = r.replyChoices.map((t, i) =>
        `<button class="btn choice warm" data-reply="${i}">${t}</button>`).join('');
      $('#choices').querySelectorAll('[data-reply]').forEach(b => b.onclick = () => {
        $('#choices').innerHTML = '';
        playerSay(r.replyChoices[+b.dataset.reply]);
        applyDelta(c, 6, 2);
        setTimeout(() => {
          npcSay('...Yeah. You’re a keeper. Come here. 🫶');
          afterAction('love', true);
        }, 450);
      });
    }
    afterAction(r.emotion, r.success);
  }, 420);
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

function openDates() {
  const c = active();
  const buddy = groupCandidateFor(c);
  const groupOk = buddy && S.player.coins >= GROUP_HANGOUT.cost;
  const body = `
    <h3>🌴 Take ${c.name} out</h3>
    ${buddy ? `<button class="btn choice warm" id="group-date" ${groupOk ? '' : 'disabled'} style="width:100%;margin-bottom:8px">
      💞 Group hangout with ${buddy.name} (🪙 ${GROUP_HANGOUT.cost} · ${GROUP_HANGOUT.hours}h)</button>` : ''}
    <div class="shop-grid">
      ${ACTIVITIES.map(a => {
        const locked = c.affection < a.minAff;
        const poor = S.player.coins < a.cost;
        const late = S.player.hour + a.hours > 24 && !['midnight', 'stars', 'hottub', 'dance'].includes(a.id);
        const off = locked || poor;
        return `<button class="shop-item ${off ? 'off' : ''}" data-act="${a.id}" ${off ? 'disabled' : ''}>
          <span class="shop-emoji">${a.emoji}</span><span>${a.name}</span>
          <span class="shop-cost">${locked ? `🔒 ♥ ${a.minAff}` : `🪙 ${a.cost} · ${a.hours}h`}</span>
        </button>`;
      }).join('')}
    </div>`;
  openModal(body);
  const gd = $('#group-date');
  if (gd) gd.onclick = () => { closeModal(); goGroupDate(c, buddy); };
  $('#modal-body').querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    closeModal();
    goDate(ACTIVITIES.find(a => a.id === b.dataset.act));
  });
}

function goDate(act) {
  const c = active();
  let cost = act.cost;
  if (S.player.role === 'chef' && ['sushi', 'smoothie'].includes(act.id)) cost = Math.ceil(cost / 2);
  S.player.coins -= cost;
  advanceTime(act.hours);
  narrate(`${act.emoji} ${act.name}: ${dateNarration(c, playerForDialogue(), act, rng)}.`);
  const r = dateReaction(c, playerForDialogue(), act, rng);
  applyDelta(c, r.dAff, r.dDes);
  c._datedToday = true;
  registerRomance(c, act.pub ?? 0.5);
  setTimeout(() => {
    npcSay(r.text);
    afterAction(r.emotion, r.dAff > 5);
  }, 500);
}

function openHustle() {
  const st = S.player.stats;
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
  const body = `
    <h3>🎒 Inventory</h3>
    ${items.length ? `<div class="stack">
      ${items.map(b => `<button class="roster-row" data-use="${b.id}">
        <span>${b.emoji}</span><b>${b.name} ×${S.player.inv[b.id]}</b>
        <span class="text-preview">${b.desc}</span>
      </button>`).join('')}
    </div>` : '<p class="modal-text">Empty. The 🧪 Boosts shop beckons.</p>'}
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
    <p class="modal-text"><b>Text someone</b> (${TEXTS_PER_NPC_PER_DAY}/day each)</p>
    <div class="stack">
      ${S.npcs.map(c => {
        const sent = S.player.textsSent[c.id] ?? 0;
        const left = TEXTS_PER_NPC_PER_DAY - sent;
        return `<button class="roster-row" data-contact="${c.id}" ${left <= 0 ? 'disabled' : ''}>
          <b>${c.name}</b><span class="text-preview">${tierLabel(tierFor(c))}${c.partner ? ' 💘' : ''}</span>
          <span class="roster-meters">${left > 0 ? `✉️×${left}` : 'tomorrow'}</span>
        </button>`;
      }).join('')}
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

function sendText(c, kind) {
  S.player.textsSent[c.id] = (S.player.textsSent[c.id] ?? 0) + 1;
  const r = textExchange(c, playerForDialogue(), kind, rng);
  switchTo(c.id);
  log('me', `📱 ${r.out}`);
  applyDelta(c, r.dAff, r.dDes);
  if (r.accepted && (kind === 'flirty' || kind === 'spicy')) registerRomance(c, 0.05);
  setTimeout(() => {
    npcSay(`📱 ${r.reply}`);
    if (kind === 'invite' && r.accepted) {
      advanceTime(1);
      narrate(`📍 ${c.name} shows up twenty minutes later, exactly as promised.`);
    }
    afterAction(emotionFor(c, tierFor(c)), r.accepted && r.dDes > 3);
  }, 600);
}

function doSleep() {
  S.player.day += 1;
  S.player.hour = 9;
  const pl = playerForDialogue();
  const dated = S.npcs.filter(c => c._datedToday).map(c => c.id);
  for (const c of S.npcs) {
    const neglected = dailyTick(c, S.player.day, rng, pl);
    delete c._datedToday;
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
    // proactive texting
    let kind = null;
    if (c.partner && rng.chance(0.5)) kind = 'partner';
    else if (neglected && rng.chance(0.8)) kind = 'miss';
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
  narrate(`🌙 You sleep. Day ${S.player.day} dawns over Beach City.`);
  renderAll();
  flushTextsBadge();
  maybeScene(active());
  save();
}

function advanceTime(h) {
  S.player.hour += h;
  if (S.player.hour >= 24) S.player.hour = 23; // last actions squeeze into the night
  // the ebb: passing hours cool everyone toward their baseline simmer
  for (const c of S.npcs) ebbDesire(c, h, rng);
  renderTopbar();
}

function openBoardwalk() {
  const canMeet = S.npcs.length < 6;
  const body = `
    <h3>🎡 The Boardwalk</h3>
    <p class="modal-text">Neon, salt air, and possibility.</p>
    <div class="stack">
      ${canMeet ? '<button class="btn primary" id="bw-meet">👋 Strike up a conversation (1h)</button>' : '<p class="modal-text">Your dance card is pretty full already.</p>'}
      <button class="btn" id="bw-stroll">🚶 People-watch (1h, free smiles)</button>
    </div>`;
  openModal(body);
  const meetBtn = $('#bw-meet');
  if (meetBtn) meetBtn.onclick = () => {
    closeModal();
    advanceTime(1);
    const used = new Set(S.usedNames);
    const c = generateCharacter(rng, used);
    S.usedNames = [...used];
    rollDesire(c, rng);
    S.npcs.push(c);
    S.activeId = c.id;
    lastHeat = -1;
    renderAll();
    npcSay(meetLine(c, playerForDialogue(), rng));
    save();
  };
  $('#bw-stroll').onclick = () => {
    closeModal();
    advanceTime(1);
    narrate(rng.pick([
      '🎡 You watch the ferris wheel spin and eat a churro. Life is okay.',
      '🌊 A pelican steals a tourist’s hot dog. You applaud.',
      '🎶 A street band plays something that makes everyone walk in rhythm.',
    ]));
  };
}

function openRoster() {
  const pl = playerForDialogue();
  const body = `
    <h3>💞 Your people</h3>
    <div class="stack">
      ${S.npcs.map(c => {
        const t = tierFor(c);
        const int = isInterested(c, pl);
        return `<button class="roster-row ${c.id === S.activeId ? 'on' : ''}" data-npc="${c.id}">
          <b>${c.name}</b> <span class="chip mini">${archetypeOf(c).label}</span>
          <span class="chip mini tier">${tierLabel(t)}${c.partner ? ' 💘' : c.known.type && !int ? ' 🤝' : ''}</span>
          <span class="roster-meters">♥${c.affection} 🔥${c.desire}</span>
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
  lastHeat = -1;
  renderAll();
  const c = active();
  // deliver unread texts from them into chat
  const mine = S.texts.filter(t => t.npcId === id && !t.read);
  if (mine.length) {
    mine.forEach(t => { t.read = true; log('npc', `📱 ${t.text}`); });
  } else if (!(S.logs[id]?.length)) {
    npcSay(greeting(c, playerForDialogue(), rng));
  }
  maybeScene(c); // pending drama meets you at the door
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
  S.player.day += 1;
  S.player.hour = 10;
  narrate(`🌅 Day ${S.player.day}. You wake up grinning. ${c.name} is officially your flame. 💘 Hearts won: ${S.player.heartsWon}`);
  npcSay(proactiveText(c, playerForDialogue(), rng, 'partner'));
  lastHeat = -1;
  renderAll();
  save();
}

// ---------------- modal / toast ----------------
function openModal(html) {
  $('#modal-body').innerHTML = html;
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
async function checkForUpdate() {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const remote = await res.json();
    if (remote.build > BUILD && !updatePromptShown) {
      updatePromptShown = true;
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      toast(`✨ Update v${remote.version} ready — tap to refresh!`, true, async () => {
        const r = await navigator.serviceWorker?.getRegistration();
        if (r?.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
        else location.reload(true);
      });
    }
  } catch { /* offline is fine */ }
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
    openModal(`
      <h3>⚙️ Menu</h3>
      <div class="stack">
        <button class="btn" id="m-title">💾 Save & quit to title</button>
        <p class="modal-text">Beach City Babes v${VERSION} (build ${BUILD})<br>
        Autosaves constantly. Auto-updates when a new version ships. 🍑</p>
      </div>`);
    $('#m-title').onclick = () => { save(); closeModal(); show('#title-screen'); renderTitle(); };
  };
  $('#btn-texts').onclick = openPhone;
  $('#btn-finale').onclick = startFinale;
  document.querySelectorAll('#actions [data-action]').forEach(b => {
    b.onclick = () => {
      const a = b.dataset.action;
      if (a === 'talk') doTalk();
      if (a === 'gift') openShop();
      if (a === 'date') openDates();
      if (a === 'hustle') openHustle();
      if (a === 'items') openInventory();
      if (a === 'phone') openPhone();
      if (a === 'sleep') doSleep();
      if (a === 'boardwalk') openBoardwalk();
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
  registerSW();
  checkForUpdate();
  setInterval(checkForUpdate, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate();
  });
}

boot();
