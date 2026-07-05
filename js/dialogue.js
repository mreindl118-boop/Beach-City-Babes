// Procedural dialogue engine.
// Every line is grammar-template text filled with character context, filtered
// by relationship tier (heat), flavored by archetype voice, and pronoun-aware.
import {
  PET_NAMES, GIFTS, ACTIVITIES, GENDER_LABELS, tierFor,
  TRANS_SHARE_LINES, TRANS_SHARE_REPLIES, STAT_DEFS,
} from './data.js';
import {
  archetypeOf, quirkOf, pronounsOf, isInterested, roleChemistry,
  currentDesireOf, addMemory, clampStats,
} from './characters.js';
import { classify, topicLabel } from './nlu.js';

// ---------- template filling ----------
export function fill(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null ? ctx[k] : `{${k}}`));
}

export function ctxFor(c, player, rng, extra = {}) {
  const p = pronounsOf(c);
  return {
    name: c.name,
    player: player.name,
    pet: rng.pick(PET_NAMES),
    sub: p.sub, obj: p.obj, pos: p.pos,
    Sub: p.sub[0].toUpperCase() + p.sub.slice(1),
    job: c.job,
    hometown: c.hometown,
    quirk: quirkOf(c).topic,
    memory: c.memories.length ? rng.pick(c.memories) : 'that first day we met',
    ...extra,
  };
}

// Archetype voice: emoji/interjection garnish appended to some lines.
const VOICE = {
  sunny:    { tag: ['😄', '☀️', 'hehe', '💛'], style: 'bubbly' },
  shy:      { tag: ['...', '😳', '//blushes//', '🫣'], style: 'soft' },
  sporty:   { tag: ['😤', 'ha!', '🔥', 'bet.'], style: 'punchy' },
  artsy:    { tag: ['✨', '🌙', 'mm.', '🎨'], style: 'dreamy' },
  glam:     { tag: ['💅', 'obviously.', '😌', '👑'], style: 'polished' },
  mystic:   { tag: ['🔮', '🌊', 'the cards knew.', '🌙'], style: 'cryptic' },
  brooding: { tag: ['...', '🖤', 'hm.', '🚬💨'], style: 'dry' },
  golden:   { tag: ['!!!', '😆', '🐶', 'dude!!'], style: 'eager' },
};

function garnish(c, text, rng) {
  if (rng.chance(0.45)) {
    const v = VOICE[c.archetype];
    return `${text} ${rng.pick(v.tag)}`;
  }
  return text;
}

// pick a line whose tier window contains t; prefer the steamiest available
function pickTiered(bank, t, rng) {
  const ok = bank.filter(e => (e.t ?? 0) <= t && t <= (e.max ?? 3));
  if (!ok.length) return bank[0].s;
  const maxT = Math.max(...ok.map(e => e.t ?? 0));
  const best = ok.filter(e => (e.t ?? 0) === maxT);
  const pool = rng.chance(0.7) ? best : ok;
  return rng.pick(pool).s;
}

// ---------- player chat moves ----------
export const MOVES = {
  COMPLIMENT: { label: 'Compliment', emoji: '🌟' },
  FLIRT:      { label: 'Flirt', emoji: '😉' },
  TEASE:      { label: 'Tease', emoji: '😏' },
  JOKE:       { label: 'Joke around', emoji: '🤪' },
  ASK:        { label: 'Ask about them', emoji: '💬' },
  SPICY:      { label: 'Get spicy', emoji: '🌶️' },
  SERENADE:   { label: 'Serenade', emoji: '🎸' },
};

// What the player is heard saying, per move, tiered.
const PLAYER_LINES = {
  COMPLIMENT: [
    { t: 0, s: 'You have a really great smile, you know that?' },
    { t: 0, s: 'That color is amazing on you.' },
    { t: 1, s: 'Every time I see you, you’re somehow better looking. It’s honestly rude.' },
    { t: 2, s: 'You’re the best part of this whole beach, and the beach knows it.' },
    { t: 3, s: 'I keep losing my train of thought around you. You’re a public hazard.' },
  ],
  FLIRT: [
    { t: 0, s: 'So do you always look this good, or is today special?' },
    { t: 0, s: 'If I buy you a smoothie, is that technically a date?' },
    { t: 1, s: 'I was going to play it cool today. Then you showed up.' },
    { t: 2, s: 'Fair warning: I’ve been thinking about you way more than I’ll admit out loud.' },
    { t: 3, s: 'Come closer. The sunset’s better from right next to me.' },
  ],
  TEASE: [
    { t: 0, s: 'Nice sandcastle. My five-year-old cousin builds better.' },
    { t: 0, s: 'Bet you can’t beat me to the pier. Loser buys tacos.' },
    { t: 1, s: 'You’re trouble. I can tell because I’m already in it.' },
    { t: 2, s: 'Careful with those eyes, {pet}. Someone could get ideas.' },
    { t: 3, s: 'Keep looking at me like that and we’re skipping the small talk.' },
  ],
  JOKE: [
    { t: 0, s: 'Why don’t crabs give to charity? Because they’re shellfish.' },
    { t: 0, s: 'I asked the ocean for dating advice. It just waved.' },
    { t: 1, s: 'My horoscope said I’d meet someone incredible today. So... hi.' },
    { t: 2, s: 'I told my friends about you. They’re sick of me already.' },
  ],
  ASK: [
    { t: 0, s: 'So tell me something about you I don’t know yet.' },
    { t: 1, s: 'What’s your story, really? I want the director’s cut.' },
    { t: 2, s: 'What were you like before Beach City? I want to know all the chapters.' },
  ],
  SPICY: [
    { t: 2, s: 'I had a dream about you. I’m not telling you the rating.' },
    { t: 2, s: 'You, me, and a very private stretch of beach. Discuss.' },
    { t: 3, s: 'I keep thinking about that swim. The water wasn’t the only thing making my heart race.' },
    { t: 3, s: 'Whatever perfume you wear should be illegal. Come here and incriminate yourself.' },
  ],
  SERENADE: [
    { t: 0, s: '*pulls out the guitar and plays a song written about {obj}*' },
    { t: 2, s: '*plays something slow and low, eyes on {obj} the whole time*' },
  ],
};

// NPC responses per move: success / fail, tiered.
const NPC_RESPONSES = {
  COMPLIMENT: {
    ok: [
      { t: 0, s: 'Oh stop it. (Do not actually stop.)' },
      { t: 0, s: 'Flattery will get you... honestly, pretty far.' },
      { t: 1, s: 'You keep saying things like that and I keep not hating it, {pet}.' },
      { t: 2, s: 'You always know exactly what to say. It’s dangerous. I like danger.' },
      { t: 3, s: 'Mmm. Say it again, slower.' },
    ],
    fail: [
      { t: 0, s: 'Smooth. Do you rehearse that in the mirror?' },
      { t: 0, s: 'Uh huh. Heard that one from three tourists this week.' },
      { t: 1, s: 'Points for effort. Minus points for delivery.' },
    ],
  },
  FLIRT: {
    ok: [
      { t: 0, s: 'Wow, bold. Lucky for you I like bold.' },
      { t: 1, s: 'Careful, {pet}. Keep that up and I might start flirting back. ...That was me starting.' },
      { t: 2, s: 'You’ve gotten good at this. Or I’ve gotten weak. Either way, keep going.' },
      { t: 3, s: 'The things you do to me with just words should require a permit.' },
    ],
    fail: [
      { t: 0, s: 'Does that line usually work? Genuine question, for science.' },
      { t: 1, s: 'Hmm. Try again when the moon’s in a better house.' },
      { t: 2, s: 'Not feeling it right this second. Read the room, {pet}.' },
    ],
  },
  TEASE: {
    ok: [
      { t: 0, s: 'Oh, it is ON. You have no idea who you’re messing with.' },
      { t: 1, s: 'You’re SO annoying. Anyway when are we hanging out again?' },
      { t: 2, s: 'One day that smart mouth of yours is going to get you in wonderful trouble.' },
      { t: 3, s: 'Brat. Come here.' },
    ],
    fail: [
      { t: 0, s: 'Wooooow. Rude. I’m telling everyone.' },
      { t: 1, s: 'Too far, {pet}. Buy my forgiveness with snacks.' },
    ],
  },
  JOKE: {
    ok: [
      { t: 0, s: 'PFFF. That’s so bad it circled back to good.' },
      { t: 0, s: 'I hate that I laughed. I hate it so much.' },
      { t: 1, s: 'Okay, you’re funny. That’s deeply inconvenient for my whole plan of playing hard to get.' },
      { t: 2, s: 'Nobody makes me laugh like you do. It’s a problem. Keep causing it.' },
    ],
    fail: [
      { t: 0, s: '...I’m going to pretend I didn’t hear that.' },
      { t: 0, s: 'Was that a joke or a cry for help?' },
    ],
  },
  SPICY: {
    ok: [
      { t: 2, s: 'Well, well. Look who found their nerve. I was wondering when you would.' },
      { t: 2, s: '*leans in close enough that you can feel the warmth* ...Noted.' },
      { t: 3, s: 'You can’t just SAY things like that in public, {pet}. Now I have to think about it all day.' },
      { t: 3, s: 'Meet me later. Bring that exact energy and nothing else.' },
    ],
    fail: [
      { t: 0, s: 'Whoa there, tiger. Buy me dinner first.' },
      { t: 1, s: 'Bold! Wrong moment, but bold. Rain check on that energy.' },
      { t: 2, s: 'Mmm... tempting. But you’ll have to earn that mood back first.' },
    ],
  },
  ASK: {
    ok: [
      { t: 0, s: 'You actually want to know? Okay, so—' },
      { t: 0, s: 'Ooh, getting personal. I respect it.' },
      { t: 0, s: 'Nobody usually asks. Here’s the scoop:' },
      { t: 0, s: 'Since you asked so nicely—' },
      { t: 1, s: 'Nobody ever asks me that. I like that you ask.' },
      { t: 1, s: 'Careful, keep asking and you’ll actually get to know me.' },
      { t: 2, s: 'Come here, this is a sit-down story.' },
    ],
    fail: [
      { t: 0, s: 'A mystery must maintain some mystery, {pet}.' },
    ],
  },
  SERENADE: {
    ok: [
      { t: 0, s: '*forgets to breathe for the length of the chorus* ...You wrote that?' },
      { t: 2, s: 'If you’re trying to ruin all other musicians for me, it’s working.' },
      { t: 3, s: '*pulls you in by the collar the second the last chord fades*' },
    ],
    fail: [
      { t: 0, s: 'The seagulls are filing a noise complaint. But the effort was cute.' },
    ],
  },
};

// friendly deflections when the player isn't their type
const DEFLECT = [
  'You’re sweet, and if I were into {plgender}s you’d be in real danger. Alas — I’m strictly a {wants} person.',
  'Ha! {player}, you know you’re not my type — wrong department entirely. But I love the confidence.',
  'Flirt received, respectfully returned to sender. I don’t date {plgender}s. BUT. I know people who would eat you alive. Want an introduction?',
];

const FACT_REVEALS = [
  { key: 'job',      line: 'Me? I’m a {job}. Yes, it’s exactly as chaotic as it sounds.' },
  { key: 'hometown', line: 'I’m {hometown}. Beach City just... kept me.' },
  { key: 'loves',    line: 'What do I love? Easy: {loves}. Take notes, there will be a quiz.' },
  { key: 'dislikes', line: 'Pet peeve gifts? {dislikes}. Bring me that and watch my face do a thing.' },
  { key: 'quirk',    line: 'Confession time: I {quirktext}. Judge me. I dare you.' },
  { key: 'type',     line: 'My type? I date {wants}. Extra points for {roleloves}.' },
  { key: 'rel',      line: 'How I do relationships? {relstyle}. Better you know now than dramatically later.' },
];

function factCtx(c) {
  const arch = archetypeOf(c);
  const wants = c.attractedTo
    .map(g => ({ man: 'men', woman: 'women', enby: 'enby folks' }[g] || g))
    .join(', ');
  return {
    loves: arch.loves.join(' and '),
    dislikes: arch.dislikes.join(' and '),
    quirktext: quirkOf(c).text.replace(/^is |^has |^loves |^does |^puts |^reads |^writes |^rides |^dances |^collects |^swears /, m => m),
    wants,
    roleloves: arch.rolesLoved.join(' or ') + ' types',
    relstyle: c.relStyle === 'poly'
      ? 'I’m polyamorous — my heart has guest rooms, and I keep them honest'
      : 'I’m a one-person-at-a-time heart. When I’m in, I’m all in',
  };
}

// ---------- public API ----------

export function availableMoves(c, player, rng) {
  const tier = tierFor(c);
  const interested = isInterested(c, player);
  const moves = ['COMPLIMENT', 'JOKE', 'ASK'];
  if (interested) {
    moves.push('FLIRT', 'TEASE');
    if (tier >= 2 && c.desire >= 30) moves.push('SPICY');
    if (player.role === 'musician') moves.push('SERENADE');
  } else {
    moves.push('TEASE');
  }
  return rng.shuffle(moves).slice(0, 4).map(m => ({
    type: m,
    label: `${MOVES[m].emoji} ${MOVES[m].label}`,
  }));
}

export function playerLineFor(c, player, move, rng) {
  const tier = tierFor(c);
  return fill(pickTiered(PLAYER_LINES[move], tier, rng), ctxFor(c, player, rng));
}

// Resolve a chat move → { success, npcText, emotion, dAff, dDes, special }
// opts: { preferFact, echo, crude, boastful } — used by typed-chat routing.
export function resolveMove(c, player, move, rng, roleData, opts = {}) {
  const arch = archetypeOf(c);
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng, factCtx(c));
  const interested = isInterested(c, player);

  // ASK: reveal facts, maybe trigger the trans-share moment
  if (move === 'ASK') {
    const unknown = FACT_REVEALS.filter(f => !c.known[f.key]);
    if (c.trans && !c.transShared && tier >= 2 && rng.chance(0.5)) {
      c.transShared = true;
      addMemory(c, `${c.name} trusted you with ${pronounsOf(c).pos} story`);
      return {
        success: true, dAff: 8, dDes: 2, emotion: 'shy', special: 'transShare',
        npcText: rng.pick(TRANS_SHARE_LINES),
        replyChoices: TRANS_SHARE_REPLIES,
      };
    }
    if (unknown.length) {
      // a typed question can target a specific fact ("what do you do?")
      const preferred = opts.preferFact && unknown.find(f => f.key === opts.preferFact);
      const f = preferred || rng.pick(unknown);
      c.known[f.key] = true;
      return {
        success: true, dAff: 4, dDes: 1, emotion: 'happy', reveal: f.key,
        npcText: garnish(c, fill(pickTiered(NPC_RESPONSES.ASK.ok, tier, rng), ctx) + ' ' + fill(f.line, ctx), rng),
      };
    }
    // everything known → cozy memory talk
    return {
      success: true, dAff: 3, dDes: 1, emotion: 'happy',
      npcText: garnish(c, fill(rng.pick([
        'Remember {memory}? I think about that more than I admit.',
        'Honestly you already know me better than most people ever bother to. It’s nice. Weird. Nice-weird.',
        'Ask me anything. At this point you’ve unlocked the whole tragic backstory DLC.',
      ]), ctx), rng),
    };
  }

  // Flirt-type moves at an uninterested NPC → warm deflection, tiny friendship
  if (!interested && (move === 'FLIRT' || move === 'SPICY' || move === 'SERENADE')) {
    c.known.type = true;
    return {
      success: false, dAff: 1, dDes: 0, emotion: 'laugh', deflected: true,
      npcText: fill(rng.pick(DEFLECT), { ...ctx, plgender: GENDER_LABELS[player.gender].toLowerCase(), wants: ctx.wants }),
    };
  }

  // ----- boundaries first: some moves are just WRONG right now -----
  // Spicy talk before they're comfortable reads as creepy, not confident.
  const spiceGate = (0.35 + 0.65 * (c.patienceForSpice ?? 0.5)) * (tier + (c.desire / 60));
  if (move === 'SPICY' && spiceGate < 1.0) {
    c.warnings = (c.warnings ?? 0) + 1;
    c.mood = Math.max(-2, c.mood - 1);
    const walk = c.warnings >= 2;
    return {
      success: false, rejected: true, walk, dAff: walk ? -8 : -5, dDes: -2, emotion: 'annoyed',
      npcText: fill(rng.pick(walk ? [
        'Okay — I’ve been polite, but you keep going there and I’m not interested. I’m gonna go. 🙄',
        'Yeah, no. Read the room. We’re done here for today.',
      ] : [
        'Whoa. WAY too fast, {pet}. You don’t even know my last name.',
        'Slow. Down. That’s not charming, that’s a lot. Try being a person first.',
        'Mmm, hard no on that energy right now. Buy me a smoothie before you buy the fantasy.',
      ]), ctx),
    };
  }

  // Turn-offs: the move clashes with something they can't stand.
  const turnoffHit =
    (c.turnoffs?.includes('crude') && (opts.crude || move === 'SPICY') && tier < 2) ||
    (c.turnoffs?.includes('tryhard') && recentSameCount(c, move) >= 2) ||
    (c.turnoffs?.includes('boastful') && opts.boastful) ||
    (c.turnoffs?.includes('pushy') && move === 'FLIRT' && c.mood < 0);

  // success roll — archetype receptivity × role chemistry × mood × repetition
  // penalty × player stats × buffs × THEIR standards. Not a pushover: base is
  // lower, standards bite, turn-offs and bad timing cost real ground.
  const recentSame = c.lastMoves.filter(m => m === move).length;
  const statDef = STAT_DEFS.find(s => s.moves.includes(move));
  let statLvl = statDef ? (player.stats?.[statDef.id] ?? 0) : 0;
  if (statDef?.id === 'style' && player.buffs?.outfit) statLvl *= 2;
  let p = 0.5
    * (arch.receptivity[move] ?? 1)
    * roleChemistry(c, player)
    * (roleData?.moveBonus?.[move] ?? 1)
    * (1 + c.mood * 0.1)
    * (1 + statLvl * 0.035)
    * (1.25 - 0.5 * (c.standards ?? 0.7))   // picky people are harder, full stop
    * (player.buffs?.courage > 0 ? 1.2 : 1)
    * (turnoffHit ? 0.45 : 1)
    * Math.max(0.3, 1 - recentSame * 0.26);  // repeating yourself gets old fast
  if (move === 'SPICY') p *= Math.min(1, (c.desire / 55) * (0.6 + c.libido));
  if (move === 'FLIRT' && tier === 0) p *= 0.8;  // strangers aren't easy
  p = Math.max(0.05, Math.min(0.94, p));
  const success = rng.chance(p);

  c.lastMoves.push(move);
  if (c.lastMoves.length > 4) c.lastMoves.shift();

  const bank = NPC_RESPONSES[move][success ? 'ok' : 'fail'];
  let npcText = garnish(c, fill(pickTiered(bank, tier, rng), ctx), rng);
  if (!success && turnoffHit) {
    npcText = fill(rng.pick([
      'Ehh. That’s kind of a {turnoff} move, and {turnoff} isn’t my thing.',
      'Not gonna lie, that landed a little {turnoff}. Not my favorite.',
    ]), { ...ctx, turnoff: c.turnoffs.find(Boolean) });
  }

  const heatMul = 1 + tier * 0.25;
  const mojoMul = (move === 'FLIRT' || move === 'SPICY') ? 1 + (player.mojo ?? 0) * 0.02 : 1;
  let dAff = 0, dDes = 0, emotion;
  if (success) {
    const base = { COMPLIMENT: [3, 2], FLIRT: [3, 4], TEASE: [3, 3], JOKE: [4, 1], SPICY: [2, 8], SERENADE: [5, 4], SMALLTALK: [2, 1], GREETING: [1, 0], AGREE: [1, 1] }[move] || [2, 1];
    dAff = Math.round(base[0] * heatMul);
    dDes = Math.round(base[1] * arch.desireGain * heatMul * mojoMul * (0.7 + (c.libido ?? 0.6)));
    c.warnings = 0; // a good beat resets their patience
    if (c.mood < 2 && rng.chance(0.4)) c.mood += 1;
    const want = currentDesireOf(c);
    if (want?.type === 'attention') {
      const match = (want.id === 'want_words' && (move === 'COMPLIMENT' || move === 'FLIRT'))
        || (want.id === 'want_laugh' && move === 'JOKE');
      if (match) { dAff += 4; dDes += 3; c.currentDesire = null; }
    }
    emotion = move === 'SPICY' ? 'sultry' : move === 'JOKE' ? 'laugh' : tier >= 2 ? 'love' : 'happy';
  } else {
    dAff = move === 'SPICY' ? -3 : turnoffHit ? -3 : -1;
    dDes = move === 'SPICY' ? -2 : 0;
    if (rng.chance(0.4)) c.mood = Math.max(-2, c.mood - 1);
    // persistent failure wears them out and can end the conversation
    if (turnoffHit || move === 'SPICY') c.warnings = (c.warnings ?? 0) + 1;
    emotion = move === 'SPICY' || turnoffHit ? 'annoyed' : 'smirk';
  }
  const walk = (c.warnings ?? 0) >= 3;
  if (walk) npcText += ' ' + rng.pick(['...Okay, I’m gonna mingle. See you around.', 'Anyway. I need some air. Later, {pet}.'.replace('{pet}', ctx.pet)]);
  return { success, npcText, emotion, dAff, dDes, walk };
}

function recentSameCount(c, move) {
  return (c.lastMoves || []).filter(m => m === move).length;
}

// ---------- gifts ----------
export function giftReaction(c, player, gift, rng) {
  const arch = archetypeOf(c);
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng, { gift: gift.name.toLowerCase() });
  const want = currentDesireOf(c);
  const wanted = want?.type === 'gift' && want.cat === gift.cat;

  if (gift.cat === 'spicy' && (tier < 2 || !isInterested(c, player))) {
    return {
      quality: 'toosoon', dAff: -4, dDes: 1, emotion: 'annoyed',
      text: fill(rng.pick([
        'A {gift}?! We are NOT there yet, {pet}. Sliding this back across the table. Slowly. Maintaining eye contact.',
        'Wow. A {gift}. Someone’s confident. Earn it first.',
      ]), ctx),
    };
  }

  let quality = 'meh';
  if (arch.loves.includes(gift.cat)) quality = 'love';
  else if (arch.likes.includes(gift.cat)) quality = 'like';
  else if (arch.dislikes.includes(gift.cat)) quality = 'dislike';

  const diminish = Math.max(0.3, 1 - c.giftsToday * 0.35);
  const spicyKick = gift.cat === 'spicy' ? 1.6 : 1;
  const table = {
    love:    { dAff: 10, dDes: 6, emotion: 'love' },
    like:    { dAff: 6,  dDes: 3, emotion: 'happy' },
    meh:     { dAff: 2,  dDes: 1, emotion: 'neutral' },
    dislike: { dAff: -3, dDes: 0, emotion: 'annoyed' },
  }[quality];

  let dAff = Math.round(table.dAff * diminish);
  let dDes = Math.round(table.dDes * diminish * spicyKick * arch.desireGain);
  let bonus = '';
  if (wanted) {
    dAff += 6; dDes += 5;
    c.currentDesire = null;
    bonus = ' ' + fill(rng.pick([
      'WAIT. How did you know I wanted exactly this?! You actually listen to me. That’s so unfair.',
      'Shut UP. I literally just mentioned this. Okay, you get points. So many points.',
    ]), ctx);
    if (c.mood < 2) c.mood += 1;
  }
  c.giftsToday += 1;
  c.known.loves = c.known.loves || quality === 'love';
  c.known.dislikes = c.known.dislikes || quality === 'dislike';
  if (quality === 'love') addMemory(c, `you gave ${c.name} a ${gift.name.toLowerCase()}`);

  const banks = {
    love: [
      { t: 0, s: 'A {gift}?! Okay you’re officially my favorite person today.' },
      { t: 1, s: 'You got me a {gift}... I’m keeping it forever and you can’t stop me.' },
      { t: 2, s: 'A {gift}. You’re dangerously good at this, {pet}. Come here.' },
      { t: 3, s: 'You keep spoiling me like this and I’ll have to find... creative ways to thank you.' },
    ],
    like: [
      { t: 0, s: 'Aww, a {gift}! That’s really sweet of you.' },
      { t: 1, s: 'A {gift}! Look at you, paying attention.' },
    ],
    meh: [
      { t: 0, s: 'Oh! A {gift}. Thanks! It’s... yeah! Thank you.' },
      { t: 0, s: 'A {gift}, huh. It’s the thought that counts, and I can tell there was... a thought.' },
    ],
    dislike: [
      { t: 0, s: 'A {gift}? Hm. Do you... know me? Like, at all?' },
      { t: 0, s: 'I’m going to smile politely now. This is me smiling politely at a {gift}.' },
    ],
  };
  const spicyBank = [
    { t: 2, s: 'Oh. OH. A {gift}. *checks over both shoulders* You’re trying to get us talked about, aren’t you. I love it.' },
    { t: 3, s: 'A {gift}... *slow smile* Someone’s been thinking ahead. Smart. Very smart.' },
  ];
  const bank = gift.cat === 'spicy' && quality !== 'dislike' ? spicyBank : banks[quality];
  return {
    quality, dAff, dDes, emotion: table.emotion,
    text: garnish(c, fill(pickTiered(bank, tier, rng), ctx), rng) + bonus,
  };
}

// ---------- dates ----------
export function dateNarration(c, player, act, rng) {
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng);
  const scene = tier >= 2 && act.heatScene ? act.heatScene : act.scene;
  return fill(scene, ctx);
}

export function dateReaction(c, player, act, rng) {
  const arch = archetypeOf(c);
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng, { act: act.name.toLowerCase() });
  const want = currentDesireOf(c);
  const wanted = want?.type === 'activity' && want.act === act.id;
  const loved = arch.actLove.includes(act.id);
  const meh = arch.actMeh.includes(act.id);
  const roleBoost = player.roleData?.actBonus?.includes(act.id) ? 1.2 : 1;

  let mult = loved ? 1.5 : meh ? 0.55 : 1;
  let dAff = Math.round(act.aff * mult * roleBoost);
  let dDes = Math.round(act.des * mult * roleBoost * arch.desireGain * (1 + tier * 0.15));
  let bonus = '';
  if (wanted) {
    dAff += 6; dDes += 6; c.currentDesire = null;
    bonus = ' ' + fill('“I’ve been dying to do this. You remembered. You actually remembered.”', ctx);
    if (c.mood < 2) c.mood += 1;
  }
  addMemory(c, `that ${act.name.toLowerCase()} on day ${player.day}`);

  const lines = loved ? [
    { t: 0, s: '“Okay THAT was perfect. Top five days, easily.”' },
    { t: 2, s: '“I don’t want tonight to end, {pet}. Just so you know.”' },
    { t: 3, s: '“Next time we do that, we’re not saying goodnight after.”' },
  ] : meh ? [
    { t: 0, s: '“That was... fine! Fun-adjacent. The company saved it.”' },
  ] : [
    { t: 0, s: '“That was really fun. I mean it.”' },
    { t: 2, s: '“Good date, {pet}. You’re getting suspiciously good at those.”' },
  ];
  return {
    dAff, dDes, emotion: loved ? (tier >= 2 ? 'sultry' : 'love') : meh ? 'neutral' : 'happy',
    text: garnish(c, fill(pickTiered(lines, tier, rng), ctx), rng) + bonus,
  };
}

// ---------- proactive texts ----------
export function proactiveText(c, player, rng, kind) {
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng);
  if (kind === 'desireHint') {
    const want = currentDesireOf(c);
    if (!want) return null;
    c.desireHinted = true;
    return fill(want.hint, ctx);
  }
  if (kind === 'miss') {
    return fill(pickTiered([
      { t: 0, s: 'Hey stranger. Still alive over there? 🙄' },
      { t: 1, s: 'So we’re just... not talking now? Cool cool cool. (Text me back.)' },
      { t: 2, s: 'I walked past our smoothie place today and got irrationally sad. Fix this, {pet}.' },
      { t: 3, s: 'My bed is annoyingly big and my phone is annoyingly quiet. Handle it.' },
    ], tier, rng), ctx);
  }
  if (kind === 'flirt') {
    return fill(pickTiered([
      { t: 0, s: 'Saw someone do a spectacular wipeout at the beach and thought of you 😇' },
      { t: 1, s: 'You crossed my mind today. Twice. Don’t let it go to your head.' },
      { t: 2, s: 'Thinking about you. That’s it. That’s the text.' },
      { t: 2, s: 'What are you wearing right now? Wait— don’t answer. Bad question. (Answer it.)' },
      { t: 3, s: 'Last night’s dream featured you prominently. My subconscious has excellent taste and zero shame.' },
    ], tier, rng), ctx);
  }
  if (kind === 'jealous') {
    return fill(pickTiered([
      { t: 1, s: 'A little bird told me you were at the boardwalk with someone today. Interesting. Very interesting. 🤨' },
      { t: 2, s: 'So who was that today, hm? Should I be sharpening anything?' },
    ], tier, rng), ctx);
  }
  if (kind === 'checkin') { // poly + open agreement: honesty is the love language
    return fill(rng.pick([
      'Heard you were out with someone cute today. GOOD. Full report tomorrow — I want ratings, categories, everything 😄',
      'My spies say you had a date. Proud of you, {pet}. Bring me gossip and a churro and all is celebrated.',
      'Busy little heartbreaker today, huh? 😏 Love that for you. Save Thursday for me though.',
    ]), ctx);
  }
  if (kind === 'metamour') { // they see other people too — and say so
    return fill(rng.pick([
      'FYI: seeing my Tuesday person tonight 🎳 You’re still my favorite weekend plan. Honesty hour, as promised.',
      'Date night with my other flame tonight — telling you because that’s the deal and the deal is sacred. Miss your face already 💛',
      'My moon-and-stars rotation is busy this week but YOU, {pet}, are penciled in permanent ink. Contradiction intended.',
    ]), ctx);
  }
  if (kind === 'partner') {
    return fill(rng.pick([
      'Good morning, trouble. Dreamed about you. Again. This is getting embarrassing 💘',
      'Reminder: you’re mine and I have excellent taste. Come by later 😘',
      'The bonfire crew keeps asking about us. I just smile. They HATE it. Come make it worse with me?',
    ]), ctx);
  }
  return null;
}

export function greeting(c, player, rng) {
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng);
  const moody = c.mood < 0;
  if (moody) {
    return garnish(c, fill(rng.pick([
      'Oh. It’s you. ...Sorry, rough day. You get five minutes to change my mood.',
      'Hmph. I was wondering if you’d show up. The bar was on the floor and yet.',
    ]), ctx), rng);
  }
  return garnish(c, fill(pickTiered([
    { t: 0, s: 'Oh hey! {player}, right? From the boardwalk.' },
    { t: 0, s: 'Well hello there. Back for more Beach City sunshine?' },
    { t: 1, s: 'There you are! I was literally just thinking about you. Don’t make it weird.' },
    { t: 2, s: 'Hey you. C’mere. I saved you a spot. It’s next to me. The spot is me.' },
    { t: 3, s: 'Finally. I was about to start missing you out loud, and nobody wants that. Get over here, {pet}.' },
  ], tier, rng), ctx), rng);
}

// first meeting at the boardwalk
export function meetLine(c, player, rng) {
  const ctx = ctxFor(c, player, rng, factCtx(c));
  return garnish(c, fill(rng.pick([
    'Hey — {player}, was it? I’m {name}. I’ve seen you around the boardwalk. You have main-character energy, it’s very suspicious.',
    'New face! Or... new-ish. I’m {name}. Welcome to the best worst beach town on the coast.',
    'You’re the {plrole} everyone keeps mentioning, right? I’m {name}. Intrigued, honestly.',
  ]), { ...ctx, plrole: player.roleLabel?.toLowerCase() ?? 'newcomer' }), rng);
}

// ---------- phone: outbound texts ----------
// The player texts an NPC remotely; they reply in kind (tier-appropriate).
const TEXT_BANKS = {
  sweet: {
    out: [
      { t: 0, s: 'Hope your day is as nice as you are 🌞' },
      { t: 1, s: 'Saw a dog on the boardwalk wearing sunglasses and needed you to know.' },
      { t: 2, s: 'Random reminder that you make this whole town better. That’s all. Carry on.' },
    ],
    ok: [
      { t: 0, s: 'Okay that was disgustingly cute. Who gave you the right 🥹' },
      { t: 1, s: 'You can’t just SEND that while I’m at work. My coworkers are asking why I’m smiling.' },
      { t: 2, s: 'Keep this up and I’m keeping you, {pet} 💛' },
    ],
  },
  flirty: {
    out: [
      { t: 1, s: 'Thinking about your smile. It’s ruining my productivity. Invoice incoming.' },
      { t: 2, s: 'Quick question: are you free tonight, or are you free tonight?' },
      { t: 3, s: 'I’d text you something smooth but you already know what you do to me.' },
    ],
    ok: [
      { t: 1, s: 'Smooth operator over here 📱🔥 Fine. You get one (1) blush.' },
      { t: 2, s: 'You’re lucky you’re charming. And that I like being flustered. 😉' },
      { t: 3, s: 'Mmm. Save that thought for when you see me, {pet}.' },
    ],
  },
  spicy: {
    out: [
      { t: 2, s: 'Wear that swimsuit tonight. You know the one. 🌶️' },
      { t: 2, s: 'Currently thinking about our last swim. And what almost happened after.' },
      { t: 3, s: 'The things I’d whisper if you were here right now... your battery would die of embarrassment.' },
    ],
    ok: [
      { t: 2, s: 'OH so we’re sending THOSE kinds of texts now?? *fans self* ...continue.' },
      { t: 2, s: 'I read that three times. Do NOT tell anyone. Come find me later 🌶️' },
      { t: 3, s: 'You absolute menace. My imagination is now fully booked for the day. Yours. Later. No excuses.' },
    ],
    fail: [
      { t: 0, s: 'Bold text for someone who hasn’t even taken me to dinner this week 😌 Earn it.' },
      { t: 2, s: 'Mmm, spicy. Wrong mood today though — warm me up in person first.' },
    ],
  },
  invite: {
    out: [
      { t: 1, s: 'Boardwalk. Twenty minutes. I’ll be the one looking for you.' },
      { t: 2, s: 'Drop everything. I miss your face. Come find me? 📍' },
    ],
    ok: [
      { t: 1, s: 'Ha! Demanding. Luckily for you I was bored. OMW 🛵' },
      { t: 2, s: 'You had me at “I miss your face”. Give me 15, {pet} 💨' },
    ],
    fail: [
      { t: 0, s: 'Can’t today, cutie — life is loud. Rain check? Don’t pout. I can FEEL you pouting.' },
    ],
  },
};

export function textExchange(c, player, kind, rng) {
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng);
  const bank = TEXT_BANKS[kind];
  const out = fill(pickTiered(bank.out, tier, rng), ctx);

  if (kind === 'sweet') {
    return { out, reply: fill(pickTiered(bank.ok, tier, rng), ctx), dAff: 3, dDes: 1, accepted: true };
  }
  if (kind === 'flirty') {
    const ok = rng.chance(0.75 + c.mood * 0.05);
    return ok
      ? { out, reply: fill(pickTiered(bank.ok, tier, rng), ctx), dAff: 3, dDes: 4, accepted: true }
      : { out, reply: fill(pickTiered(TEXT_BANKS.spicy.fail, tier, rng), ctx), dAff: 0, dDes: 0, accepted: false };
  }
  if (kind === 'spicy') {
    const ok = tier >= 2 && c.desire >= 35 && rng.chance(0.7 + c.mood * 0.05);
    return ok
      ? { out, reply: fill(pickTiered(bank.ok, tier, rng), ctx), dAff: 2, dDes: 9, accepted: true }
      : { out, reply: fill(pickTiered(bank.fail, tier, rng), ctx), dAff: -2, dDes: -1, accepted: false };
  }
  // invite
  const ok = c.mood >= 0 && rng.chance(0.55 + c.affection / 200 + c.mood * 0.1);
  return ok
    ? { out, reply: fill(pickTiered(bank.ok, tier, rng), ctx), dAff: 2, dDes: 2, accepted: true }
    : { out, reply: fill(pickTiered(bank.fail, tier, rng), ctx), dAff: 0, dDes: 0, accepted: false };
}

// ---------- relationship structure: DTR, cheating, straying ----------
// A DTR ("define the relationship") talk. Openers differ by wiring and by
// who started it (the player's Heart-to-heart move, or the NPC cornering you).
export function dtrOpen(c, player, rng, npcInitiated = false) {
  const ctx = ctxFor(c, player, rng);
  const bank = npcInitiated
    ? (c.relStyle === 'mono' ? [
        'So. Um. What ARE we, exactly? Because I don’t share well, and I need to know if I should be guarding my heart.',
        'Real talk, {pet}. I’m a one-person person. Is this... going where I think it’s going?',
      ] : [
        'Hey. Honesty hour. I’m poly — I date more than one person sometimes, always in the open. What are you looking for with me?',
        'Before this goes further: I don’t do secrets. Multiple loves, zero lies — that’s my whole thing. Where’s your head at?',
      ])
    : (c.relStyle === 'mono' ? [
        '*sets down {pos} drink slowly* Okay. You have my full attention. What are we, {player}?',
        'I was hoping you’d bring this up. I hate floating. Tell me what you want us to be.',
      ] : [
        'Mm, the Talk. Okay — cards up: I’m polyamorous. Honest, open, no sneaking. Your move, {pet}.',
        'You want to define this? Cute. Fair warning: my definition includes honesty and might include other people. Talk to me.',
      ]);
  return fill(rng.pick(bank), ctx);
}

export const DTR_CHOICES = [
  { id: 'exclusive', label: '💍 “Just you and me. Exclusive.”' },
  { id: 'open',      label: '💞 “Open and honest — I see other people.”' },
  { id: 'nolabel',   label: '😅 “Can we not label it yet?”' },
];

export function resolveDTR(c, player, choice, rng) {
  const ctx = ctxFor(c, player, rng);
  if (choice === 'exclusive') {
    if (c.relStyle === 'mono') {
      c.agreement = 'exclusive';
      c.pendingDTR = false;
      addMemory(c, 'the night you two went exclusive');
      return { dAff: 12, dDes: 4, emotion: 'love', npcText: fill(rng.pick([
        '*the smile takes a second to arrive and then it’s everywhere* Yes. YES. Okay. You’re mine now. Officially. No givebacks.',
        'Exclusive. I like that word so much better than I let on. C’mere, {pet}. Deal’s sealed.',
      ]), ctx) };
    }
    // poly hearts don't promise exclusivity — they counter-offer honesty
    c.agreement = 'open';
    c.pendingDTR = false;
    return { dAff: 5, dDes: 0, emotion: 'shy', npcText: fill(rng.pick([
      'That’s sweet, and I mean this kindly: I can’t promise “only.” It’s not how I’m built. What I CAN promise is you’ll always know the truth. Take honest-me or leave me.',
      'Careful — I’d hate to lie to you. Exclusivity isn’t mine to give. Total honesty is. That’s the deal on the table, {pet}.',
    ]), ctx) };
  }
  if (choice === 'open') {
    if (c.relStyle === 'poly') {
      c.agreement = 'open';
      c.pendingDTR = false;
      addMemory(c, 'the refreshingly honest Talk');
      return { dAff: 10, dDes: 5, emotion: 'love', npcText: fill(rng.pick([
        'See, THIS is why I like you. Open and honest — biggest green flag on the beach. Just never lie to me and we’re golden.',
        '*grins* A person who says the quiet part out loud. Deal. Date whoever — just tell me the good gossip first.',
      ]), ctx) };
    }
    c.agreement = 'none';
    c.pendingDTR = false;
    c.mood = Math.max(-2, c.mood - 1);
    return { dAff: -10, dDes: -3, emotion: 'sad', npcText: fill(rng.pick([
      '...Oh. Thank you for being honest. Truly. But I want ALL of somebody, not a timeshare. I need to think about what that means for us.',
      '*long look at the ocean* Honest hurts less than a lie, but it still hurts, {pet}. I’m a one-person heart. Figure out if I’m worth it.',
    ]), ctx) };
  }
  // nolabel
  c.dtrDeflects = (c.dtrDeflects ?? 0) + 1;
  c.pendingDTR = false;
  const strike2 = c.relStyle === 'mono' && c.dtrDeflects >= 2;
  if (strike2) { c.mood = Math.max(-2, c.mood - 1); }
  return {
    dAff: strike2 ? -6 : -1, dDes: 0, emotion: strike2 ? 'sad' : 'smirk',
    npcText: fill(strike2 ? rng.pick([
      'That’s the second time you’ve dodged this. I notice things, {pet}. A girl can only float for so long.',
      'Mm. “No labels” twice in a row. I hear what you’re not saying, and it’s getting loud.',
    ]) : rng.pick([
      'Ha! Fine, mystery it is. For now. This conversation has a rain date, though.',
      '“No labels.” Okay, cool, casual, whatever. *aggressively sips drink*',
    ]), ctx),
  };
}

// Confrontation: the gossip mill delivered. severity by what was promised.
export function confrontOpen(c, player, rng) {
  const ctx = ctxFor(c, player, rng);
  const bank = c.agreement === 'exclusive' ? [
    '*arms crossed, eyes shining* Word travels on this beach, {player}. You promised me EXCLUSIVE. Tell me what I heard isn’t true.',
    'Don’t. Just— don’t open with cute. Three people saw you. We had a DEAL, {player}.',
  ] : c.relStyle === 'mono' ? [
    'So... I heard you’ve been making the rounds. We never promised anything, I know. But I thought— ugh. Say something.',
    'A little bird — okay, four little birds — told me about you and your busy calendar. I don’t own you. It still stings.',
  ] : [
    'Hey. Heard you’ve been seeing people. Which — fine! I’m poly, remember? What’s NOT fine is hearing it from the smoothie guy instead of you.',
    'Relax, I’m not mad you date. I’m mad you hid it. Sneaking is the one thing my rules can’t hold.',
  ];
  return fill(rng.pick(bank), ctx);
}

export const CONFRONT_CHOICES = [
  { id: 'apologize', label: '😔 Own it and apologize' },
  { id: 'confess',   label: '🙏 Come clean about everything' },
  { id: 'deny',      label: '🤥 Deny everything' },
];

export function resolveConfront(c, player, choice, rng, { preemptive = false } = {}) {
  const ctx = ctxFor(c, player, rng);
  const exclusive = c.agreement === 'exclusive';
  const soften = preemptive ? 0.6 : 1;

  if (choice === 'deny' && !preemptive) {
    const p = Math.min(0.75, 0.35 + (player.stats?.charm ?? 0) * 0.04);
    c.pendingConfront = false;
    if (rng.chance(p)) {
      c.suspicion = 0;
      c.mood = Math.max(-2, c.mood - 1);
      return { outcome: 'denied', dAff: -4, dDes: 0, emotion: 'smirk', npcText: fill(rng.pick([
        '...Hm. Okay. Maybe the beach exaggerates. It does that. *watches you a beat too long* Forget I said anything.',
        'You’re either innocent or very good. I genuinely can’t tell, and I hate that I like that about you.',
      ]), ctx) };
    }
    c.betrayed = true; c.agreement = 'none'; c.partner = false;
    c.mood = -2; c.suspicion = 0; c.guilt = 0;
    addMemory(c, 'the lie you told with a straight face');
    return { outcome: 'blowup', dAff: -35, dDes: -20, emotion: 'annoyed', npcText: fill(rng.pick([
      'Lie to my FACE? My cousin took the photos, {player}. We’re done. And everyone on this beach is going to know why.',
      '*dead calm* Wrong answer. I gave you the door and you chose the trapdoor. Goodbye, {player}. The group chat will hear about this.',
    ]), ctx) };
  }

  if (choice === 'confess' || (choice === 'deny' && preemptive)) {
    if (exclusive) {
      // honesty at the cliff's edge: they demand you choose
      return { outcome: 'ultimatum', dAff: Math.round(-12 * soften), dDes: -4, emotion: 'sad', npcText: fill(rng.pick([
        '*quiet for a long moment* Thank you for the truth. Here’s mine: I won’t split you with anybody. Them or me, {player}. Choose.',
        'Okay. Honesty. I can work with honesty. So here’s the honest question: is it me, or is it everyone else? Pick one. Now.',
      ]), ctx) };
    }
    if (c.relStyle === 'poly') {
      c.agreement = 'open'; c.suspicion = 0; c.guilt = 0;
      c.pendingConfront = false;
      addMemory(c, 'the day you chose honesty');
      return { outcome: 'opened', dAff: 8, dDes: 2, emotion: 'happy', npcText: fill(rng.pick([
        'THERE it is. Truth looks good on you. New rule, one rule: I hear it from you first. Now — tell me everything, I want DETAILS.',
        '*exhales* Okay. We’re okay. Honesty resets the board, {pet}. Keep dating your people. Just keep me in the loop.',
      ]), ctx) };
    }
    c.suspicion = 0; c.guilt = 0; c.pendingConfront = false; c.pendingDTR = true;
    c.mood = Math.max(-2, c.mood - 1);
    return { outcome: 'hurt', dAff: Math.round(-12 * soften), dDes: -3, emotion: 'sad', npcText: fill(rng.pick([
      'I appreciate the truth. I do. But I’m not built for crowds, {player}. We need to figure out what this is. Soon.',
      '*nods slowly* Honest hurts clean, at least. Think about what you actually want. Then come find me for the real Talk.',
    ]), ctx) };
  }

  // apologize
  c.strikes = (c.strikes ?? 0) + 1;
  c.suspicion = 0; c.guilt = 0; c.pendingConfront = false;
  if (exclusive && c.strikes >= 2) {
    c.betrayed = true; c.agreement = 'none'; c.partner = false; c.mood = -2;
    return { outcome: 'blowup', dAff: -30, dDes: -15, emotion: 'annoyed', npcText: fill(rng.pick([
      'You apologized LAST time. Fool me once, shame on you. Fool me twice— no. No. We’re done, {player}.',
    ]), ctx) };
  }
  c.mood = Math.max(-2, c.mood - 2);
  const dAff = Math.round((exclusive ? -25 : c.relStyle === 'mono' ? -14 : -7) * soften);
  return { outcome: 'strike', dAff, dDes: -6, emotion: 'sad', npcText: fill(rng.pick(exclusive ? [
    '*wipes {pos} eyes fast, angry about it* One. You get one, {player}. Because I’m stupid about you. Do NOT make me regret this.',
    'I should walk. Everyone would tell me to walk. ...One more chance. Last one. Earn it back.',
  ] : [
    'Yeah. Okay. Apology heard. Just... be a person who tells me things, alright?',
    '*long sigh* Fine. We’re fine. Adjacent to fine. Bring snacks next time, it helps the healing.',
  ]), ctx) };
}

// They strayed (neglected exclusive partner) and are confessing.
export function strayOpen(c, player, rng) {
  const ctx = ctxFor(c, player, rng);
  return fill(rng.pick([
    '*can’t meet your eyes* I have to tell you something and I hate it. Last night at the tiki bar... I kissed someone. It was stupid. You’d been a ghost for days and I— no. No excuses. I’m sorry, {player}.',
    'I need to say this fast or I won’t say it. Someone kissed me and for three seconds I let them. I felt sick the whole moped ride home. You deserve the truth from me, not the boardwalk.',
  ]), ctx);
}

export const STRAY_CHOICES = [
  { id: 'forgive', label: '💗 “Thank you for telling me. Come here.”' },
  { id: 'leave',   label: '💔 “I can’t do this. We’re done.”' },
];

export function resolveStray(c, player, choice, rng) {
  const ctx = ctxFor(c, player, rng);
  c.pendingCheatConfess = false;
  if (choice === 'forgive') {
    c.loyal = true; c.mood = 1;
    addMemory(c, 'the night you forgave and {sub} chose you for good');
    return { dAff: -8, dDes: 0, emotion: 'shy', npcText: fill(rng.pick([
      '*breaks a little, then holds on tight* I don’t deserve— okay. Okay. Never again, {player}. You have ALL of me now. I mean it like a vow.',
      'You’re really not walking? *laughs wetly* Worst decision, best human. Never again. I promise on every seashell I own.',
    ]), ctx) };
  }
  c.agreement = 'none'; c.partner = false; c.mood = -2; c.betrayed = false;
  addMemory(c, 'the goodbye on the pier');
  return { dAff: -30, dDes: -20, emotion: 'sad', npcText: fill(rng.pick([
    '*nods, tears free-falling* That’s fair. That’s— yeah. For what it’s worth, you were the best almost I ever had. Bye, {player}.',
    'I get it. I broke it. *backs away slowly, hand over mouth* Be happy, okay? Really. One of us should be.',
  ]), ctx) };
}

// Choosing at the ultimatum.
export function resolveUltimatum(c, player, choseThem, rng) {
  const ctx = ctxFor(c, player, rng);
  if (choseThem) {
    c.suspicion = 0; c.guilt = 0; c.pendingConfront = false; c.mood = 0;
    addMemory(c, 'the day you chose {obj} over everyone');
    return { dAff: 6, dDes: 4, emotion: 'love', npcText: fill(rng.pick([
      '*searches your face for the lie and doesn’t find it* ...Okay. Okay. Then we start over, properly. Just us. Don’t make me regret being this happy.',
      'Me? You’re choosing me? *fists your collar, forehead to yours* Right answer. RIGHT answer. Clean slate — but I keep the receipts.',
    ]), ctx) };
  }
  c.agreement = 'none'; c.partner = false; c.betrayed = true; c.mood = -2;
  c.suspicion = 0; c.guilt = 0; c.pendingConfront = false;
  return { dAff: -25, dDes: -15, emotion: 'sad', npcText: fill(rng.pick([
    '*nods like something closed* At least you didn’t lie at the end. Goodbye, {player}. Don’t text me when the beach gets lonely.',
    'Freedom. Cool. Enjoy it. *walks into the crowd without looking back*',
  ]), ctx) };
}

// Group hangout afterglow lines from each metamour.
export function groupAfterline(c, other, player, rng) {
  const ctx = ctxFor(c, player, rng, { other: other.name });
  return garnish(c, fill(rng.pick([
    'Okay, {other} is a MENACE and I love it. We’re keeping this arrangement. All of it. Including you, obviously.',
    'Between us? I get why you like {other}. Between us also? I like how you look when we’re all laughing. Do this again soon.',
    'Group consensus reached while you bought the drinks: you’re stuck with us both now. Motion passed unanimously.',
  ]), ctx), rng);
}

// ================= typed free-text chat =================
// The player types a message; we understand it and compose a reply that
// mirrors what they said, driven by the same seduction math (so wrong/creepy
// messages still cost). If window.BCB_CHAT_PROVIDER is set, game.js uses that
// instead for truly generative replies — this is the offline path.

const INTENT_TO_MOVE = {
  COMPLIMENT: 'COMPLIMENT', FLIRT: 'FLIRT', TEASE: 'TEASE', JOKE: 'JOKE',
  ASK: 'ASK', SPICY: 'SPICY', SERENADE: 'SERENADE',
  GREETING: 'GREETING', AGREE: 'AGREE', SMALLTALK: 'SMALLTALK',
};

// A short lead-in that reflects what they actually said, so replies feel heard.
function reflect(nlu, c, player, rng) {
  if (rng.chance(0.4)) return ''; // not every line — avoid a formula
  const ctx = ctxFor(c, player, rng);
  const echo = nlu.echo;
  if (nlu.intent === 'COMPLIMENT' && echo) {
    return fill(rng.pick([`My ${echo}? `, `“${cap(echo)},” huh. `, `You noticed my ${echo}. `]), ctx);
  }
  if (nlu.intent === 'FLIRT' && echo) return rng.pick([`Smooth. `, `Oh, we’re doing this? `, `Bold opener. `]);
  if (nlu.intent === 'SPICY') return rng.pick([`Well. `, `*raises an eyebrow* `, `Someone’s feeling brave. `]);
  if (nlu.intent === 'TEASE') return rng.pick([`Oh it’s ON. `, `Big talk. `, `You’re asking for it. `]);
  if (nlu.topic && rng.chance(0.6)) return fill(rng.pick([`${cap(topicLabel(nlu.topic, c))}? `, `Talking about ${topicLabel(nlu.topic, c)}, nice. `]), ctx);
  return '';
}

// Sometimes bounce a question back so the conversation actually flows.
function followUp(nlu, c, player, rng) {
  const tier = tierFor(c);
  if (rng.chance(0.6)) return '';
  const ctx = ctxFor(c, player, rng);
  return ' ' + fill(pickTiered([
    { t: 0, s: rng.pick(['What about you?', 'So what’s your deal, {player}?', 'Your turn — tell me something.']) },
    { t: 1, s: rng.pick(['Come here often, or am I just lucky today?', 'Okay, your turn to impress me.']) },
    { t: 2, s: rng.pick(['What are you doing later, {pet}?', 'You gonna keep looking at me like that?']) },
    { t: 3, s: rng.pick(['How much longer are we pretending we’re just talking?', 'Say the word, {pet}.']) },
  ], tier, rng), ctx);
}

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

const SMALLTALK_BANK = [
  { t: 0, s: 'Ha, okay. I like where your head’s at. Keep talking.' },
  { t: 0, s: 'Mm-hm. You’re easy to talk to, I’ll give you that.' },
  { t: 1, s: 'You know, most people bore me by now. You don’t. Suspicious.' },
  { t: 2, s: 'I could do this all day, {pet}. Just talk. And... other things.' },
];
const GREETING_BANK = [
  { t: 0, s: 'Hey yourself. To what do I owe the pleasure?' },
  { t: 0, s: 'Well hi. You’ve got my attention — briefly. Use it well.' },
  { t: 1, s: 'There you are. I was starting to think you forgot about me, {pet}.' },
  { t: 2, s: 'Hey you. Get over here, I don’t bite. Much.' },
];
const CONFUSED_BANK = [
  '...I have absolutely no idea what you mean, but okay.',
  'That’s a sentence. Words were involved. I respect the effort.',
  'Huh? You’re gonna have to run that by me again, {pet}.',
];

// Map a topic to which profile fact a question is really asking about.
function factForTopic(topic) {
  return { work: 'job', home: 'hometown', likes: 'loves', dislikes: 'dislikes',
    quirk: 'quirk', type: 'type', rel: 'rel' }[topic] || null;
}

// Resolve typed text → same shape as resolveMove, plus .nlu and .walk.
export function resolveTyped(c, player, text, rng, roleData) {
  const nlu = classify(text, c, player);
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng);

  // Being mean has consequences — they are not here for it.
  if (nlu.intent === 'INSULT') {
    c.warnings = (c.warnings ?? 0) + 1;
    c.mood = Math.max(-2, c.mood - 1);
    const walk = c.warnings >= 2;
    return {
      nlu, success: false, dAff: walk ? -10 : -6, dDes: -2, emotion: 'annoyed', walk,
      npcText: fill(rng.pick(walk ? [
        'Wow. Yeah, I’m done. Find someone else to be a jerk to. 🚶',
        'Nope. Not spending my summer on that. Bye, {player}.',
      ] : [
        'Excuse me? That was uncalled for.',
        'Okay, rude. Try that again and I’m walking.',
        '*narrows eyes* Bold of you to think that works on me.',
      ]), ctx),
    };
  }

  // Greetings and idle small talk: light, warm-ish, low stakes.
  if (nlu.intent === 'GREETING' || nlu.intent === 'AGREE') {
    const bank = nlu.intent === 'GREETING' ? GREETING_BANK : SMALLTALK_BANK;
    const dAff = nlu.intent === 'GREETING' ? 1 : 1;
    return { nlu, success: true, dAff, dDes: 0, emotion: 'happy',
      npcText: garnish(c, reflect(nlu, c, player, rng) + fill(pickTiered(bank, tier, rng), ctx), rng) };
  }
  if (nlu.intent === 'SMALLTALK') {
    // very short / unparseable → confused; otherwise friendly small talk
    if (text.trim().length < 3 || !nlu.echo) {
      return { nlu, success: true, dAff: 0, dDes: 0, emotion: 'smirk',
        npcText: garnish(c, fill(rng.pick(CONFUSED_BANK), ctx), rng) };
    }
    return { nlu, success: true, dAff: 1, dDes: 0, emotion: 'happy',
      npcText: garnish(c, reflect(nlu, c, player, rng) + fill(pickTiered(SMALLTALK_BANK, tier, rng), ctx)
        + followUp(nlu, c, player, rng), rng) };
  }

  // Everything else routes through the move engine (keeps stat math, gossip,
  // boundaries, turn-offs). Typed questions target the fact they asked about.
  const move = INTENT_TO_MOVE[nlu.intent] || 'SMALLTALK';
  const opts = {
    preferFact: nlu.intent === 'ASK' ? factForTopic(nlu.topic) : null,
    echo: nlu.echo,
    crude: nlu.intent === 'SPICY',
  };
  const r = resolveMove(c, player, move, rng, roleData, opts);
  // decorate with a reflection + occasional follow-up so it reads as a reply
  if (!r.special && !r.rejected && !r.deflected) {
    const lead = reflect(nlu, c, player, rng);
    const tail = r.success ? followUp(nlu, c, player, rng) : '';
    r.npcText = (lead + r.npcText + tail).trim();
  }
  r.nlu = nlu;
  return r;
}

// Detect typed intent for the pivotal relationship scenes so the player can
// answer them by typing instead of only tapping. Returns a choice id or null.
export function classifyChoice(text, choices) {
  const t = text.toLowerCase();
  const has = (...ws) => ws.some(w => t.includes(w));
  const ids = choices.map(c => c.id);
  const pick = id => ids.includes(id) ? id : null;
  // DTR
  if (ids.includes('exclusive') && has('exclusive', 'only you', 'just you', 'just us', 'nobody else', 'be together', 'official', 'girlfriend', 'boyfriend', 'partner')) return 'exclusive';
  if (ids.includes('open') && has('open', 'see other', 'polyam', 'poly', 'not exclusive', 'honest', 'other people')) return 'open';
  if (ids.includes('nolabel') && has('no label', 'not sure', 'slow', 'casual', 'don’t know', "don't know", 'no rush', 'keep it')) return 'nolabel';
  // confrontation
  if (ids.includes('apologize') && has('sorry', 'apolog', 'my fault', 'forgive', 'messed up')) return 'apologize';
  if (ids.includes('confess') && has('truth', 'honest', 'confess', 'came clean', 'come clean', 'tell you everything', 'yes i')) return 'confess';
  if (ids.includes('deny') && has('wasn’t me', "wasn't me", 'not true', 'lie', 'didn’t', "didn't", 'never happened', 'rumor')) return 'deny';
  // stray
  if (ids.includes('forgive') && has('forgive', 'thank you', 'come here', 'okay', 'it’s okay', "it's okay", 'stay', 'work through')) return 'forgive';
  if (ids.includes('leave') && has('over', 'done', 'leave', 'can’t', "can't", 'goodbye', 'we’re through', 'break up')) return 'leave';
  // ultimatum
  if (ids.includes('them') && has('you', 'only you', 'choose you', 'pick you', 'want you')) return 'them';
  if (ids.includes('free') && has('can’t promise', "can't promise", 'freedom', 'free', 'no', 'both')) return 'free';
  return null;
}

// Persona/context bundle handed to an LLM provider so it stays in character.
export function chatPersona(c, player, recentLog) {
  const arch = archetypeOf(c);
  const p = pronounsOf(c);
  return {
    name: c.name, age: c.age, pronouns: p.label,
    playerName: player.name,
    personality: `${arch.label}: ${arch.desc}`,
    job: c.known.job ? c.job : 'undisclosed',
    relationship: tierLabelSafe(c),
    agreement: c.agreement,
    mood: ['hostile', 'annoyed', 'neutral', 'warm', 'smitten'][c.mood + 2],
    interested: isInterested(c, player),
    likes: c.known.loves ? arch.loves : undefined,
    turnoffs: c.turnoffs,
    boldness: c.boldness, libido: c.libido,
    recent: recentLog,
    style: 'Reply in first person as this character. Flirty, witty, with real boundaries — you are NOT a pushover and reject moves that are creepy, boring, or too fast. Keep it suggestive, never sexually explicit. 1-3 sentences.',
  };
}
function tierLabelSafe(c) {
  try { return ['strangers', 'flirting', 'dating', 'lovers'][tierFor(c)]; } catch { return 'strangers'; }
}

// ================= date offers can be refused =================
// Asking someone out is a real ask. They weigh their mood, how well they know
// you, their standards, your reputation, and — for intimate dates — the
// relationship tier. A refusal stings and can dent your standing in town.
export function dateOffer(c, player, act, rng) {
  const tier = tierFor(c);
  const ctx = ctxFor(c, player, rng, { act: act.name.toLowerCase() });
  if (!isInterested(c, player)) {
    return { accepted: false, repHit: 0, affHit: -1, emotion: 'laugh',
      line: fill(rng.pick([
        'Aw, as friends? Sure. As a date? You’re barking up the wrong palm tree, {pet}.',
        'That’s sweet but you’re not my flavor, remember? Rain check as buddies.',
      ]), ctx) };
  }
  let p = 0.9
    + (player.reputation ?? 0) / 220        // being well-liked in town helps
    - Math.max(0, ((act.minAff || 0) + 12 - c.affection)) / 55  // asking big too early
    - (c.standards - 0.6) * 0.35
    + c.mood * 0.12
    + (c.partner ? 0.5 : 0);                // your established lover is happy to
  if (act.intimate) p -= (c.partner ? 0.12 : 0.45) + Math.max(0, (act.minTier || 0) - tier) * 0.2;
  p = Math.max(0.08, Math.min(0.97, p));
  if (rng.chance(p)) {
    return { accepted: true, line: fill(rng.pick([
      'Yes! God, finally. Give me two minutes to look devastating.',
      'Took you long enough to ask. Obviously yes.',
      'A date? With me? Bold. I respect it. Let’s go, {pet}.',
    ]), ctx) };
  }
  // refusal — worse when you overreached or your reputation precedes you
  const harsh = act.intimate || c.mood < 0 || (player.reputation ?? 0) < -20;
  return {
    accepted: false, emotion: harsh ? 'annoyed' : 'sad',
    affHit: harsh ? -4 : -2, repHit: harsh ? -4 : -2,
    line: fill(rng.pick(harsh ? [
      'Wow, THAT’s the invite? Hard pass. And people talk, you know.',
      'No. We are nowhere near that, and honestly you asking is a little telling.',
      'Yeah... no. Read the room, {pet}. This is going in the group chat.',
    ] : [
      'Aw — not today. I’ve got a thing. Ask me again when it’s not so out of the blue?',
      'Mm, I’m gonna say... not yet. Warm me up first, {pet}.',
      'A rain check, if that’s okay? I barely know you.',
    ]), ctx),
  };
}

export function reputationLabel(rep) {
  if (rep <= -40) return { txt: 'Notorious', emoji: '💀' };
  if (rep <= -15) return { txt: 'Shady', emoji: '😬' };
  if (rep < 15) return { txt: 'Unknown', emoji: '🙂' };
  if (rep < 40) return { txt: 'Well-liked', emoji: '😊' };
  return { txt: 'Beach Royalty', emoji: '👑' };
}
