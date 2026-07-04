// Procedural character generation and stat/desire bookkeeping.
import {
  NAMES, PRONOUN_SETS, JOBS, HOMETOWNS, QUIRKS, ARCHETYPES,
  DESIRE_POOL, tierFor,
} from './data.js';

export const SKIN_TONES = ['#8d5524', '#a9713f', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac'];
export const HAIR_COLORS = ['#1b1b1b', '#3b2314', '#6b3d1e', '#a5622a', '#d8973c', '#f2d16b', '#b03a48', '#7b4fa6', '#2e6f95', '#e88fb2'];
export const EYE_COLORS = ['#4a2c1a', '#2f5d3a', '#2b5f8a', '#6b4fa0', '#7a7a2e', '#444444'];
export const SUIT_COLORS = ['#ff5d8f', '#ff9f1c', '#2ec4b6', '#7b2cbf', '#e63946', '#3a86ff', '#06d6a0', '#fb5607'];
export const HAIR_STYLES = {
  fem: ['waves', 'ponytail', 'bob', 'curls', 'bun'],
  masc: ['short', 'swoop', 'buzz', 'curlsShort', 'manbun'],
};
export const ACCESSORIES = ['none', 'flower', 'shades', 'hoops', 'choker', 'cap', 'stud'];

// Orientation: weighted so most genders have a decent dating pool.
function rollAttraction(rng) {
  return rng.weighted([
    [['man'], 3], [['woman'], 3], [['man', 'woman'], 2],
    [['man', 'woman', 'enby'], 3], [['woman', 'enby'], 1], [['man', 'enby'], 1],
  ]);
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
    attractedTo: rollAttraction(rng),
    age: rng.int(21, 34),
    job: rng.pick(JOBS),
    hometown: rng.pick(HOMETOWNS),
    archetype: arch.id,
    quirk: quirk.id,
    body: rng.pick(presentation === 'fem'
      ? ['slim', 'curvy', 'athletic', 'soft', 'muscular']
      : ['slim', 'athletic', 'soft', 'muscular', 'curvy']),
    look: {
      skin: rng.int(0, SKIN_TONES.length - 1),
      hairColor: rng.int(0, HAIR_COLORS.length - 1),
      hairStyle: rng.pick(HAIR_STYLES[presentation]),
      eyes: rng.int(0, EYE_COLORS.length - 1),
      suit: rng.int(0, SUIT_COLORS.length - 1),
      suitB: rng.int(0, SUIT_COLORS.length - 1),
      accessory: rng.pick(ACCESSORIES),
    },
    // stats
    affection: rng.int(3, 10),
    desire: rng.int(0, 6),
    spark: 0,                // arousal combo: chained romantic beats surge desire
    mood: 0,                 // -2 .. +2
    // what the player has uncovered
    known: { job: false, hometown: false, loves: false, dislikes: false, quirk: false, type: false },
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
  if (daysIgnored >= arch.patience && !c.partner) {
    c.affection = Math.max(0, c.affection - rng.int(2, 5));
    c.mood = Math.max(-2, c.mood - 1);
    neglected = true;
  } else if (c.mood < 0 && rng.chance(0.5)) {
    c.mood += 1; // moods heal with time
  }
  if (!c.currentDesire || rng.chance(0.4)) rollDesire(c, rng);
  clampStats(c, player);
  return neglected;
}
