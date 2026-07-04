// Static content banks: names, roles, archetypes, gifts, activities, quirks.
// Tone ceiling: flirty → steamy innuendo at high tiers. Suggestive, never explicit.

export const NAMES = {
  woman: [
    'Luna', 'Coral', 'Sienna', 'Marina', 'Jade', 'Bianca', 'Aurora', 'Selena',
    'Paloma', 'Ivy', 'Melody', 'Dahlia', 'Noelle', 'Ruby', 'Amara', 'Cleo',
    'Nadia', 'Priya', 'Talia', 'Josie', 'Elena', 'Camille', 'Freya', 'Isla',
  ],
  man: [
    'Dante', 'Marco', 'Levi', 'Theo', 'Rocco', 'Jasper', 'Andre', 'Nico',
    'Silas', 'Diego', 'Ezra', 'Koa', 'Rafael', 'Miles', 'Hugo', 'Dashiell',
  ],
  enby: [
    'Kai', 'Skye', 'River', 'Ash', 'Nova', 'Rowan', 'Indigo', 'Sage',
    'Phoenix', 'Marlowe', 'Sol', 'Wren', 'Ocean', 'Ari', 'Jules', 'Zephyr',
  ],
};

// Pronoun sets are independent of gender — chosen per character.
export const PRONOUN_SETS = {
  she:  { id: 'she',  label: 'she/her',   sub: 'she', obj: 'her', pos: 'her', self: 'herself' },
  he:   { id: 'he',   label: 'he/him',    sub: 'he', obj: 'him', pos: 'his', self: 'himself' },
  they: { id: 'they', label: 'they/them', sub: 'they', obj: 'them', pos: 'their', self: 'themself' },
};

export const GENDER_LABELS = { woman: 'Woman', man: 'Man', enby: 'Non-binary' };

// Warm, affirming lines used when a trans NPC opens up at the Dating tier.
export const TRANS_SHARE_LINES = [
  'So... I don’t tell everyone this, but I like where this is going. I’m trans. Took me years to become this fabulous, and I regret nothing.',
  'Can I tell you something? I’m trans. I wanted you to hear it from me, over a sunset, like the movies.',
  'You know what’s funny? Younger me would never believe someone like you would look at me like that. I’m trans, by the way. Best decision I ever made was becoming me.',
];

export const TRANS_SHARE_REPLIES = [
  'Thank you for trusting me with that. You’re stunning — that hasn’t changed one bit.',
  'I’m into *you*. That’s just more of your story, and I like your story.',
  'Honestly? The bravest, hottest thing about you is how completely yourself you are.',
];

export const BODY_TYPES = ['slim', 'curvy', 'athletic', 'soft', 'muscular'];
export const BODY_LABELS = {
  slim: 'slim', curvy: 'curvy', athletic: 'athletic', soft: 'soft & huggable', muscular: 'built',
};

export const JOBS = [
  'lifeguard', 'smoothie barista', 'yoga instructor', 'tattoo artist',
  'marine biologist', 'DJ', 'surf coach', 'pastry chef', 'photographer',
  'bartender at the tiki lounge', 'jewelry maker', 'skate shop owner',
  'aquarium diver', 'beach volleyball pro', 'mixologist', 'muralist',
];

export const HOMETOWNS = [
  'up the coast', 'from the city', 'from a tiny mountain town',
  'from across the bay', 'from the desert originally', 'born right here in Beach City',
];

export const PET_NAMES = [
  'cutie', 'trouble', 'sunshine', 'hot stuff', 'babe', 'tiger',
  'gorgeous', 'stranger', 'heartbreaker', 'good-lookin’', 'menace',
];

export const QUIRKS = [
  { id: 'tacos', text: 'is obsessed with fish tacos', topic: 'fish tacos' },
  { id: 'shells', text: 'collects seashells and names each one', topic: 'the seashell collection' },
  { id: 'astro', text: 'reads horoscopes religiously', topic: 'astrology' },
  { id: 'karaoke', text: 'is an undefeated karaoke champion', topic: 'karaoke night' },
  { id: 'plants', text: 'has 43 houseplants, all named', topic: 'the plant jungle' },
  { id: 'horror', text: 'loves terrible horror movies', topic: 'bad horror movies' },
  { id: 'salsa', text: 'dances salsa when nobody’s watching', topic: 'salsa dancing' },
  { id: 'poetry', text: 'writes poetry on napkins', topic: 'napkin poetry' },
  { id: 'spicy', text: 'puts hot sauce on literally everything', topic: 'hot sauce' },
  { id: 'moped', text: 'rides a seafoam-green moped', topic: 'the moped' },
  { id: 'tarot', text: 'does tarot readings at parties', topic: 'tarot cards' },
  { id: 'nightswim', text: 'swears night swimming is a personality trait', topic: 'midnight swims' },
];

// ---------- Player roles ----------
// Each role: economy tweaks, a signature chat move bonus, and NPC type-appeal.
export const ROLES = [
  {
    id: 'surfer', label: 'Drifter Surfer', emoji: '🏄',
    desc: 'Salt-cured and easygoing. Broke, but the ocean is free.',
    coins: 40, wage: [22, 38], moveBonus: { TEASE: 1.2 },
    perk: 'Beach dates hit harder. Teasing comes naturally.',
    actBonus: ['surf', 'walk', 'midnight'],
  },
  {
    id: 'musician', label: 'Boardwalk Musician', emoji: '🎸',
    desc: 'You play sunset sets by the pier. People remember your hands.',
    coins: 50, wage: [26, 44], moveBonus: { JOKE: 1.15, SERENADE: 1.3 },
    perk: 'Unlocks the Serenade move. Charm in 6 strings.',
    actBonus: ['dance', 'stars'],
  },
  {
    id: 'heir', label: 'Trust-Fund Heir', emoji: '💳',
    desc: 'Never worked a day. Some find that delicious. Some find it tragic.',
    coins: 220, wage: [60, 90], moveBonus: {},
    perk: 'Money is not a problem. Being interesting might be.',
    actBonus: ['sushi', 'dance'],
  },
  {
    id: 'trainer', label: 'Personal Trainer', emoji: '💪',
    desc: 'You correct people’s form. Sometimes with your hands.',
    coins: 60, wage: [30, 48], moveBonus: { TEASE: 1.15, SPICY: 1.15 },
    perk: 'Physical confidence. Spicy moves land smoother.',
    actBonus: ['surf', 'yoga', 'arcade'],
  },
  {
    id: 'chef', label: 'Line Cook', emoji: '🔪',
    desc: 'Burn scars and perfect timing. You feed people. It works.',
    coins: 70, wage: [32, 50], moveBonus: { COMPLIMENT: 1.1 },
    perk: 'Food dates cost half. The way to every heart.',
    actBonus: ['sushi', 'smoothie'],
  },
  {
    id: 'artist', label: 'Struggling Artist', emoji: '🎨',
    desc: 'Paint under your nails, universe in your head.',
    coins: 35, wage: [20, 36], moveBonus: { ASK: 1.25, COMPLIMENT: 1.1 },
    perk: 'Deep talk is your love language. Art gifts are cheap for you.',
    actBonus: ['stars', 'yoga', 'walk'],
  },
];

// ---------- Gifts ----------
export const GIFT_CATEGORIES = ['flowers', 'jewelry', 'books', 'sweets', 'tech', 'art', 'beach', 'spicy'];

export const GIFTS = [
  { id: 'daisies',   name: 'Bunch of Daisies',        cat: 'flowers', cost: 12, emoji: '🌼' },
  { id: 'roses',     name: 'Red Roses',               cat: 'flowers', cost: 28, emoji: '🌹' },
  { id: 'anklet',    name: 'Shell Anklet',            cat: 'jewelry', cost: 22, emoji: '📿' },
  { id: 'necklace',  name: 'Moonstone Necklace',      cat: 'jewelry', cost: 55, emoji: '💎' },
  { id: 'novel',     name: 'Trashy Beach Novel',      cat: 'books',   cost: 14, emoji: '📖' },
  { id: 'poems',     name: 'Book of Love Poems',      cat: 'books',   cost: 24, emoji: '📕' },
  { id: 'fudge',     name: 'Boardwalk Fudge',         cat: 'sweets',  cost: 10, emoji: '🍫' },
  { id: 'macarons',  name: 'Fancy Macarons',          cat: 'sweets',  cost: 20, emoji: '🧁' },
  { id: 'speaker',   name: 'Waterproof Speaker',      cat: 'tech',    cost: 45, emoji: '🔊' },
  { id: 'polaroid',  name: 'Retro Instant Camera',    cat: 'tech',    cost: 60, emoji: '📸' },
  { id: 'sketch',    name: 'Sunset Portrait of Them', cat: 'art',     cost: 30, emoji: '🎨' },
  { id: 'vinyl',     name: 'Vintage Surf-Rock Vinyl', cat: 'art',     cost: 26, emoji: '🎵' },
  { id: 'wax',       name: 'Coconut Surf Wax',        cat: 'beach',   cost: 8,  emoji: '🏄' },
  { id: 'sarong',    name: 'Silk Beach Wrap',         cat: 'beach',   cost: 35, emoji: '🧣' },
  { id: 'oil',       name: 'Scented Massage Oil',     cat: 'spicy',   cost: 32, emoji: '🫙', minTier: 2 },
  { id: 'swim',      name: 'Daring Little Swimsuit',  cat: 'spicy',   cost: 48, emoji: '👙', minTier: 2 },
  { id: 'blindfold', name: 'Silk Blindfold',          cat: 'spicy',   cost: 40, emoji: '🎀', minTier: 3 },
];

// ---------- Activities ----------
// heatScene: spicier flavor text used at tier >= 2.
export const ACTIVITIES = [
  { id: 'walk',     name: 'Beach Walk',       cost: 0,  hours: 1, aff: 6,  des: 2,  minAff: 0,  emoji: '🚶',
    scene: 'you two wander the shoreline, dodging waves and trading stories',
    heatScene: 'you walk the empty shoreline, {pos} fingers laced in yours, hips bumping on purpose' },
  { id: 'smoothie', name: 'Smoothie Stand',   cost: 8,  hours: 1, aff: 7,  des: 3,  minAff: 0,  emoji: '🥤',
    scene: 'you split a mango-coconut smoothie, two straws',
    heatScene: 'one smoothie, two straws, and {sub} maintains eye contact the entire time' },
  { id: 'arcade',   name: 'Boardwalk Arcade', cost: 15, hours: 2, aff: 9,  des: 4,  minAff: 10, emoji: '🕹️',
    scene: '{sub} destroys you at air hockey and gloats adorably',
    heatScene: '{sub} bets kisses on air hockey and loses on purpose. Twice.' },
  { id: 'surf',     name: 'Surf Session',     cost: 20, hours: 2, aff: 8,  des: 8,  minAff: 15, emoji: '🏄',
    scene: 'salt spray, wipeouts, and {obj} laughing at yours',
    heatScene: 'wet skin, shared board, and {pos} hands steadying your waist far longer than technique requires' },
  { id: 'sushi',    name: 'Sushi Date',       cost: 35, hours: 2, aff: 12, des: 6,  minAff: 20, emoji: '🍣',
    scene: 'candlelight, sake, and {obj} stealing your last roll',
    heatScene: 'sake-warm and candlelit, {sub} feeds you the last roll from {pos} chopsticks, slow' },
  { id: 'yoga',     name: 'Sunset Yoga',      cost: 18, hours: 1, aff: 8,  des: 10, minAff: 25, emoji: '🧘',
    scene: 'partner poses at golden hour, very hands-on',
    heatScene: 'partner poses turn into an excuse to be pressed together, breathing in sync at golden hour' },
  { id: 'dance',    name: 'Tiki Club Night',  cost: 30, hours: 3, aff: 10, des: 14, minAff: 35, emoji: '💃',
    scene: 'sweaty bass, close dancing, {pos} lips at your ear',
    heatScene: 'bass in your ribs, {pos} body moving against yours, lips grazing your ear with every whisper' },
  { id: 'stars',    name: 'Stargazing',       cost: 5,  hours: 2, aff: 14, des: 10, minAff: 45, emoji: '🌌',
    scene: 'a blanket, a thermos, and constellations you both invent',
    heatScene: 'one blanket, zero interest in stars — {sub} traces constellations on your palm instead' },
  { id: 'midnight', name: 'Midnight Swim',    cost: 0,  hours: 2, aff: 10, des: 18, minAff: 55, emoji: '🌊',
    scene: 'moonlit water, whispered dares, goosebumps that aren’t from the cold',
    heatScene: 'moonlit water up to your shoulders, {pos} legs finding yours beneath the surface, dares whispered against wet skin' },
  { id: 'hottub',   name: 'Rooftop Hot Tub',  cost: 40, hours: 2, aff: 12, des: 22, minAff: 65, emoji: '♨️',
    scene: 'steam, city lights, and very little distance between you',
    heatScene: 'steam curling off the water, {sub} drifts across the tub and settles in close enough to share a heartbeat' },
];

export const FINALE_MIN_AFF = 85;
export const FINALE_MIN_DES = 85;

// ---------- Archetypes ----------
// rolesLoved/rolesMeh: player-role chemistry. receptivity: chat move multipliers.
export const ARCHETYPES = [
  {
    id: 'sunny', label: 'Sunny Flirt',
    desc: 'Warm, playful, flirts like breathing.',
    loves: ['flowers', 'sweets'], likes: ['beach', 'art'], dislikes: ['tech'],
    actLove: ['smoothie', 'walk', 'dance'], actMeh: ['arcade'],
    rolesLoved: ['surfer', 'musician'], rolesMeh: ['heir'],
    receptivity: { COMPLIMENT: 1.2, FLIRT: 1.3, TEASE: 1.0, JOKE: 1.1, ASK: 0.9, SPICY: 1.1, SERENADE: 1.2 },
    desireGain: 1.1, patience: 3,
  },
  {
    id: 'shy', label: 'Shy Bookworm',
    desc: 'Soft-spoken, blushes easily, deep waters under still surface.',
    loves: ['books', 'flowers'], likes: ['sweets', 'art'], dislikes: ['spicy'],
    actLove: ['stars', 'walk', 'sushi'], actMeh: ['dance'],
    rolesLoved: ['artist', 'chef'], rolesMeh: ['trainer'],
    receptivity: { COMPLIMENT: 1.1, FLIRT: 0.8, TEASE: 0.7, JOKE: 1.0, ASK: 1.4, SPICY: 0.6, SERENADE: 1.3 },
    desireGain: 0.9, patience: 4,
  },
  {
    id: 'sporty', label: 'Adrenaline Junkie',
    desc: 'Competitive, fearless, dares you to keep up.',
    loves: ['beach', 'tech'], likes: ['sweets'], dislikes: ['flowers'],
    actLove: ['surf', 'arcade', 'midnight'], actMeh: ['stars'],
    rolesLoved: ['trainer', 'surfer'], rolesMeh: ['artist'],
    receptivity: { COMPLIMENT: 0.9, FLIRT: 1.0, TEASE: 1.4, JOKE: 1.2, ASK: 0.8, SPICY: 1.2, SERENADE: 0.8 },
    desireGain: 1.2, patience: 2,
  },
  {
    id: 'artsy', label: 'Artsy Dreamer',
    desc: 'Head in the clouds, heart worn on one paint-stained sleeve.',
    loves: ['art', 'books'], likes: ['flowers', 'beach'], dislikes: ['tech'],
    actLove: ['stars', 'yoga', 'walk'], actMeh: ['arcade'],
    rolesLoved: ['artist', 'musician'], rolesMeh: ['heir'],
    receptivity: { COMPLIMENT: 1.2, FLIRT: 1.0, TEASE: 0.9, JOKE: 1.0, ASK: 1.3, SPICY: 0.9, SERENADE: 1.3 },
    desireGain: 1.0, patience: 3,
  },
  {
    id: 'glam', label: 'Glam Royalty',
    desc: 'High standards, higher heels, worth every coin.',
    loves: ['jewelry', 'spicy'], likes: ['flowers', 'tech'], dislikes: ['books'],
    actLove: ['sushi', 'dance', 'hottub'], actMeh: ['walk'],
    rolesLoved: ['heir', 'chef'], rolesMeh: ['surfer'],
    receptivity: { COMPLIMENT: 1.4, FLIRT: 1.1, TEASE: 0.8, JOKE: 0.9, ASK: 1.0, SPICY: 1.2, SERENADE: 1.0 },
    desireGain: 1.0, patience: 2,
  },
  {
    id: 'mystic', label: 'Moonlit Mystic',
    desc: 'Reads your palm, then reads your mind, then keeps your secrets.',
    loves: ['art', 'jewelry'], likes: ['books', 'flowers'], dislikes: ['sweets'],
    actLove: ['midnight', 'stars', 'yoga'], actMeh: ['smoothie'],
    rolesLoved: ['artist', 'surfer'], rolesMeh: ['trainer'],
    receptivity: { COMPLIMENT: 1.0, FLIRT: 1.1, TEASE: 1.0, JOKE: 0.8, ASK: 1.2, SPICY: 1.1, SERENADE: 1.1 },
    desireGain: 1.1, patience: 3,
  },
  {
    id: 'brooding', label: 'Brooding Poet',
    desc: 'Leather jacket in July. Feels everything, admits nothing.',
    loves: ['books', 'art'], likes: ['jewelry'], dislikes: ['sweets'],
    actLove: ['midnight', 'stars', 'walk'], actMeh: ['smoothie', 'arcade'],
    rolesLoved: ['musician', 'artist'], rolesMeh: ['heir', 'trainer'],
    receptivity: { COMPLIMENT: 0.8, FLIRT: 1.0, TEASE: 1.2, JOKE: 0.9, ASK: 1.3, SPICY: 1.0, SERENADE: 1.2 },
    desireGain: 1.0, patience: 3,
  },
  {
    id: 'golden', label: 'Golden Retriever',
    desc: 'Sunshine incarnate. Loves everything, especially you, probably.',
    loves: ['sweets', 'beach'], likes: ['flowers', 'tech'], dislikes: ['jewelry'],
    actLove: ['surf', 'smoothie', 'arcade'], actMeh: ['sushi'],
    rolesLoved: ['chef', 'trainer'], rolesMeh: [],
    receptivity: { COMPLIMENT: 1.1, FLIRT: 1.1, TEASE: 1.1, JOKE: 1.3, ASK: 1.0, SPICY: 1.0, SERENADE: 1.0 },
    desireGain: 1.1, patience: 4,
  },
];

// ---------- Rotating desires (proactively hinted) ----------
export const DESIRE_POOL = [
  { id: 'want_flowers',  type: 'gift', cat: 'flowers',  hint: 'Walked past the flower stand today... nobody ever buys me flowers anymore 🥀' },
  { id: 'want_jewelry',  type: 'gift', cat: 'jewelry',  hint: 'Saw the prettiest thing in a shop window today. Sigh. One can dream ✨' },
  { id: 'want_books',    type: 'gift', cat: 'books',    hint: 'Just finished my book and now I have NOTHING to read. Tragic 📚' },
  { id: 'want_sweets',   type: 'gift', cat: 'sweets',   hint: 'I would commit minor crimes for something sweet right now 🍫' },
  { id: 'want_art',      type: 'gift', cat: 'art',      hint: 'My walls are so bare. I need something beautiful to look at... besides my mirror 😌' },
  { id: 'want_beach',    type: 'gift', cat: 'beach',    hint: 'Beach season and my gear is falling apart. Hint hint 🏖️' },
  { id: 'want_spicy',    type: 'gift', cat: 'spicy',    hint: 'Feeling a little daring lately... surprise me with something bold 😏', minTier: 2 },
  { id: 'want_sushi',    type: 'activity', act: 'sushi',    hint: 'I’ve been CRAVING sushi all week. Just saying 🍣' },
  { id: 'want_dance',    type: 'activity', act: 'dance',    hint: 'My feet are begging to dance. Who’s gonna take me out? 💃' },
  { id: 'want_surf',     type: 'activity', act: 'surf',     hint: 'Waves are supposed to be perfect tomorrow. I hate surfing alone 🌊' },
  { id: 'want_stars',    type: 'activity', act: 'stars',    hint: 'Meteor shower this week... I know a spot on the dunes 🌠', minAff: 40 },
  { id: 'want_midnight', type: 'activity', act: 'midnight', hint: 'The water’s so warm at night lately. Almost criminal to swim alone 😇', minAff: 50 },
  { id: 'want_hottub',   type: 'activity', act: 'hottub',   hint: 'I know a rooftop with a hot tub and a view. I’ve been thinking about who to bring 😳', minAff: 60 },
  { id: 'want_words',    type: 'attention', hint: 'Say something nice to me. I’ve had a day 🥺' },
  { id: 'want_laugh',    type: 'attention', hint: 'Bored bored bored. Entertain me, funny person 🙃' },
];

// Relationship tiers gate heat level in art + dialogue.
export const TIERS = [
  { tier: 0, label: 'Strangers',  minAff: 0 },
  { tier: 1, label: 'Flirting',   minAff: 25 },
  { tier: 2, label: 'Dating',     minAff: 55 },
  { tier: 3, label: 'Lovers',     minAff: 80 },
];

export function tierFor(c) {
  if (c.partner) return 3;
  let t = 0;
  for (const row of TIERS) if (c.affection >= row.minAff) t = row.tier;
  return t;
}

export function tierLabel(t) { return TIERS[t].label; }

// ---------- Player stats, boosts, hustle ----------
// Stats feed the seduction math: charm → words, style → first impressions
// and flirting, physique → teasing and spicy moves. Mojo is earned sexual
// confidence — it grows when bold plays land and amplifies desire gains.
export const STAT_DEFS = [
  { id: 'charm',    label: 'Charm',    emoji: '💬', moves: ['COMPLIMENT', 'JOKE', 'ASK', 'SERENADE'] },
  { id: 'style',    label: 'Style',    emoji: '✨', moves: ['FLIRT'] },
  { id: 'physique', label: 'Physique', emoji: '💪', moves: ['TEASE', 'SPICY'] },
];

// Consumable boosts (inventory items). durMoves = chat-move charges,
// durDay = lasts until sleep.
export const BOOSTS = [
  { id: 'courage', name: 'Liquid Courage', emoji: '🥃', cost: 18, durMoves: 3,
    desc: '+20% success on your next 3 chat moves.' },
  { id: 'scent',   name: 'Date-Night Scent', emoji: '🌺', cost: 25, durDay: true,
    desc: 'Desire gains +50% until you sleep. Devastating.' },
  { id: 'smoothie', name: 'Energy Smoothie', emoji: '🥤', cost: 12, instant: 'hours',
    desc: '+3 hours to your day, immediately.' },
  { id: 'outfit',  name: 'Killer Outfit', emoji: '🕶️', cost: 40, durDay: true,
    desc: 'Style counts double until you sleep. Heads will turn.' },
];

// Ways to earn coins / train stats. Stat-gated gigs pay like they should.
export const HUSTLES = [
  { id: 'shift',   name: 'Work a shift', emoji: '💼', hours: 4, desc: 'Honest coin. Your role sets the wage.' },
  { id: 'gym',     name: 'Hit the gym', emoji: '🏋️', hours: 3, cost: 15, stat: 'physique',
    desc: '+1 Physique. Sweat now, smolder later.' },
  { id: 'style',   name: 'Style session', emoji: '💇', hours: 2, cost: 25, stat: 'style',
    desc: '+1 Style. Investment dressing.' },
  { id: 'openmic', name: 'Open mic night', emoji: '🎤', hours: 2, cost: 10, stat: 'charm',
    desc: '+1 Charm. Learn what makes a room lean in.' },
  { id: 'model',   name: 'Swimwear modeling gig', emoji: '📸', hours: 3, req: ['physique', 5], pay: [70, 110],
    desc: 'Requires Physique 5. They pay you to look like that.' },
  { id: 'tiki',    name: 'Guest-bartend the tiki lounge', emoji: '🍹', hours: 3, req: ['charm', 5], pay: [60, 95],
    desc: 'Requires Charm 5. Tips scale with winks.' },
];

// Phone text kinds the player can send. perDay limits spam per NPC.
export const TEXT_KINDS = [
  { id: 'sweet',  label: '💛 Sweet text',  minTier: 0 },
  { id: 'flirty', label: '😉 Flirty text', minTier: 1 },
  { id: 'spicy',  label: '🌶️ Spicy text',  minTier: 2 },
  { id: 'invite', label: '📍 “Come find me”', minTier: 1 },
];
export const TEXTS_PER_NPC_PER_DAY = 2;
