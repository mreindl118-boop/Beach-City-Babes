// Procedural character generation and stat/desire bookkeeping.
import {
  NAMES, PRONOUN_SETS, JOBS, HOMETOWNS, QUIRKS, ARCHETYPES,
  DESIRE_POOL, tierFor,
} from './data.js';

export const SKIN_TONES = ['#8d5524', '#a9713f', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac'];
export const HAIR_COLORS = ['#1b1b1b', '#3b2314', '#6b3d1e', '#a5622a', '#d8973c', '#f2d16b', '#b03a48', '#7b4fa6', '#2e6f95', '#e88fb2'];
// Sticker-Pop accent: hair tips, iris, nails, sparkles and UI all key off this.
export const ACCENTS = ['#22d3ee', '#f43f5e', '#e879f9', '#a3e635', '#fb923c', '#818cf8', '#2dd4bf', '#fb7185'];
export const ACCENT_NAMES = ['cyan', 'crimson', 'magenta', 'lime', 'tangerine', 'violet', 'teal', 'rose'];
export const EYE_COLORS = ['#4a2c1a', '#2f5d3a', '#2b5f8a', '#6b4fa0', '#7a7a2e', '#444444'];
export const SUIT_COLORS = ['#ff5d8f', '#ff9f1c', '#2ec4b6', '#7b2cbf', '#e63946', '#3a86ff', '#06d6a0', '#fb5607'];
export const HAIR_STYLES = {
  fem: ['waves', 'ponytail', 'bob', 'curls', 'bun'],
  masc: ['short', 'swoop', 'buzz', 'curlsShort', 'manbun'],
};
export const ACCESSORIES = ['none', 'flower', 'shades', 'hoops', 'choker', 'cap', 'stud'];

// Orientation: weighted so most genders have a decent dating pool.
// Everyone in Beach City is pansexual: attraction is about the person, never
// the gender. Chemistry, standards, and mood still decide who actually clicks.
function rollAttraction() {
  return ['man', 'woman', 'enby'];
}

export function generateCharacter(rng, usedNames = new Set()) {
  const gender = rng.weighted([['woman', 5], ['man', 4], ['enby', 2]]);
  let name = rng.pick(NAMES[gender]);
  let guard = 0;
  while (usedNames.has(name) && guard++ < 60) name = rng.pick(NAMES[gender]);
  usedNames.add(name);

  const arch = rng.pick(ARCHETYPES);
  const quirk = rng.pick(QUIRKS);
  // Identity axes are independent: gender, pronouns, presentation, body, and
  // being trans are each their own dial. Presentation leans with gender but
  // any combination can roll.
  const presentation = gender === 'enby'
    ? rng.pick(['fem', 'masc'])
    : rng.weighted(gender === 'woman' ? [['fem', 9], ['masc', 1]] : [['masc', 9], ['fem', 1]]);
  const pronouns = gender === 'enby'
    ? rng.weighted([['they', 8], ['she', 1], ['he', 1]])
    : rng.weighted(gender === 'woman' ? [['she', 9], ['they', 1]] : [['he', 9], ['they', 1]]);
  const trans = rng.chance(0.18); // trans NPCs are simply part of Beach City

  return {
    id: `${name}-${rng.int(1000, 9999)}`,
    name,
    gender,
    trans,
    transShared: false, // set true once they open up to the player
    pronouns,
    presentation,
    attractedTo: rollAttraction(),
    // relationship structure: how this heart is wired
    relStyle: rng.weighted([['mono', 6], ['poly', 4]]),
    agreement: 'none',      // none | exclusive | open — what you two agreed
    dtrDeflects: 0,         // times the player dodged "what are we?"
    guilt: 0,               // your uncaught romantic acts elsewhere (vs. this NPC)
    suspicion: 0,           // what the gossip mill has carried to them
    strikes: 0,             // forgiven betrayals — nobody forgives twice
    betrayed: false,
    loyal: false,           // survived a stray-and-forgive; never strays again
    pendingConfront: false, // they heard something. next visit gets loud
    pendingCheatConfess: false, // they strayed and need to tell you
    pendingDTR: false,      // they want the "what are we?" talk
    chem: {},               // npcId -> bool: poly metamour spark (persisted roll)
    age: rng.int(21, 34),
    job: rng.pick(JOBS),
    hometown: rng.pick(HOMETOWNS),
    archetype: arch.id,
    quirk: quirk.id,
    // sexual personality — these make each person want different things and
    // refuse others. Nobody is a pushover; the wrong move actively costs you.
    libido: rng.float(0.35, 1),      // how much they run on desire vs. slow romance
    boldness: rng.float(0.2, 1),     // how forward THEY get, and how soon
    standards: rng.float(0.4, 1),    // pickiness: high = success is harder, gifts matter less
    patienceForSpice: rng.float(0.2, 0.9), // how early spicy talk is welcome vs. creepy
    turnoffs: rng.shuffle(['clingy', 'crude', 'boastful', 'pushy', 'boring', 'tryhard']).slice(0, 2),
    warnings: 0,                     // strikes this conversation before they walk
    walkedToday: false,
    body: rng.pick(presentation === 'fem'
      ? ['slim', 'curvy', 'athletic', 'soft', 'muscular']
      : ['slim', 'athletic', 'soft', 'muscular', 'curvy']),
    measurements: null, // filled by ensureMeasurements — continuous, per-body-type
    look: {
      skin: rng.int(0, SKIN_TONES.length - 1),
      hairColor: rng.int(0, HAIR_COLORS.length - 1),
      hairStyle: rng.pick(HAIR_STYLES[presentation]),
      eyes: rng.int(0, EYE_COLORS.length - 1),
      suit: rng.int(0, SUIT_COLORS.length - 1),
      suitB: rng.int(0, SUIT_COLORS.length - 1),
      accent: rng.int(0, ACCENTS.length - 1),
      accessory: rng.pick(ACCESSORIES),
    },
    // stats
    affection: rng.int(3, 10),
    desire: rng.int(0, 6),
    spark: 0,                // arousal combo: chained romantic beats surge desire
    mood: 0,                 // -2 .. +2
    // what the player has uncovered
    known: { job: false, hometown: false, loves: false, dislikes: false, quirk: false, type: false, rel: false },
    // rotating desire system
    currentDesire: null,
    desireHinted: false,
    // memory / anti-repetition
    lastMoves: [],
    memories: [],
    lastSeenDay: 1,
    giftsToday: 0,
    partner: false,
    inbox: [],
  };
}

export const pronounsOf = c => PRONOUN_SETS[c.pronouns] || PRONOUN_SETS.they;
export const archetypeOf = c => ARCHETYPES.find(a => a.id === c.archetype);
export const quirkOf = c => QUIRKS.find(q => q.id === c.quirk);

// Continuous silhouette genes: sampled inside the body-type's range with
// jitter so no two characters share a body. Values are multipliers the art
// engine turns into a bespoke figure.
const BODY_RANGES = {
  slim:     { bust: [0.80, 1.05], waist: [0.68, 0.82], hips: [0.85, 1.08], sh: [0.85, 1.00] },
  curvy:    { bust: [1.25, 1.60], waist: [0.64, 0.78], hips: [1.28, 1.62], sh: [0.90, 1.05] },
  athletic: { bust: [0.95, 1.15], waist: [0.74, 0.88], hips: [1.00, 1.18], sh: [1.05, 1.22] },
  soft:     { bust: [1.15, 1.45], waist: [0.95, 1.15], hips: [1.20, 1.52], sh: [0.95, 1.10] },
  muscular: { bust: [1.00, 1.22], waist: [0.80, 0.95], hips: [0.95, 1.12], sh: [1.22, 1.42] },
};
const POSES = ['sway-l', 'sway-r', 'square'];

export function ensureMeasurements(c, rng) {
  if (c.measurements) return c.measurements;
  const r = BODY_RANGES[c.body] || BODY_RANGES.slim;
  c.measurements = {
    bust: rng.float(...r.bust),
    waist: rng.float(...r.waist),
    hips: rng.float(...r.hips),
    sh: rng.float(...r.sh),
    pose: rng.pick(POSES),
    lips: rng.float(0.8, 1.3),
    lashes: rng.chance(0.7),
    beautyMark: rng.chance(0.25),
  };
  return c.measurements;
}

// Would these two NPCs be into each other? Poly-only, orientation-gated, then
// a persisted spark roll — poly people aren't automatically into each other.
export function npcChemistry(a, b, rng) {
  if (a.relStyle !== 'poly' || b.relStyle !== 'poly') return false;
  if (a.chem?.[b.id] != null) return a.chem[b.id];
  const mutual = a.attractedTo.includes(b.gender) && b.attractedTo.includes(a.gender);
  const spark = mutual && rng.chance(0.6);
  (a.chem ??= {})[b.id] = spark;
  (b.chem ??= {})[a.id] = spark;
  return spark;
}

// Is this NPC romantically available to the player at all?
// Attraction is to gender identity — trans women are women, trans men are men.
export function isInterested(c, player) {
  return c.attractedTo.includes(player.gender);
}

// Role chemistry multiplier: loved role = easier, disliked = harder.
export function roleChemistry(c, player) {
  const arch = archetypeOf(c);
  if (arch.rolesLoved.includes(player.role)) return 1.25;
  if (arch.rolesMeh.includes(player.role)) return 0.8;
  return 1.0;
}

export function clampStats(c, player) {
  c.affection = Math.max(0, Math.min(100, Math.round(c.affection)));
  c.desire = Math.max(0, Math.min(100, Math.round(c.desire)));
  // friends-only NPCs stay warm but never burn
  if (player && !isInterested(c, player)) {
    c.affection = Math.min(c.affection, 60);
    c.desire = Math.min(c.desire, 15);
  }
  c.mood = Math.max(-2, Math.min(2, c.mood));
}

export function addMemory(c, text) {
  c.memories.push(text);
  if (c.memories.length > 6) c.memories.shift();
}

// Pick a new "current desire" appropriate to archetype, tier and stats.
export function rollDesire(c, rng) {
  const arch = archetypeOf(c);
  const tier = tierFor(c);
  const candidates = DESIRE_POOL.filter(d => {
    if (d.minAff && c.affection < d.minAff) return false;
    if (d.minTier && tier < d.minTier) return false;
    if (d.type === 'gift' && arch.dislikes.includes(d.cat)) return false;
    return d.id !== c.currentDesire;
  });
  const weightedPairs = candidates.map(d => {
    let w = 1;
    if (d.type === 'gift' && arch.loves.includes(d.cat)) w = 3;
    if (d.type === 'activity' && arch.actLove.includes(d.act)) w = 3;
    return [d.id, w];
  });
  c.currentDesire = rng.weighted(weightedPairs);
  c.desireHinted = false;
}

export function currentDesireOf(c) {
  return DESIRE_POOL.find(d => d.id === c.currentDesire) || null;
}

// Arousal baseline: committed relationships simmer, strangers run cold.
// Desire ebbs toward this floor rather than to zero.
export function desireBaseline(c) {
  const tier = tierFor(c);
  return Math.min(45, tier * 10 + (c.partner ? 15 : 0));
}

// The ebb: desire drifts toward baseline. Above it, cooling accelerates when
// running hot (peaks are hard to hold); below it, the simmer creeps back up.
export function ebbDesire(c, hours, rng) {
  const base = desireBaseline(c);
  if (c.desire > base) {
    const rate = c.desire > 70 ? 2 : 1;
    c.desire = Math.max(base, c.desire - hours * rate);
  } else if (c.desire < base) {
    c.desire = Math.min(base, c.desire + Math.ceil(hours / 2));
  }
}

// Daily decay + mood drift. Returns true if the NPC feels neglected.
export function dailyTick(c, day, rng, player) {
  const base = desireBaseline(c);
  c.desire = Math.max(base, c.desire - rng.int(8, 16));
  c.spark = 0;
  c.giftsToday = 0;
  const arch = archetypeOf(c);
  const daysIgnored = day - c.lastSeenDay;
  let neglected = false;
  // Being apart makes hearts WANE, not shatter: affection drifts down gently
  // (never below a floor of what you built), moods still heal, and nobody
  // holds a grudge for a busy week — they just start wanting to see you.
  if (daysIgnored >= 2 && !c.partner) {
    const floor = Math.min(c.affection, 12); // early spark never fully fades
    c.affection = Math.max(floor, c.affection - 1);
    if (daysIgnored >= arch.patience) neglected = true; // they miss you — expect an invite
  }
  if (c.mood < 0 && rng.chance(0.5)) c.mood += 1; // moods heal with time
  if (!c.currentDesire || rng.chance(0.4)) rollDesire(c, rng);
  clampStats(c, player);
  return neglected;
}
