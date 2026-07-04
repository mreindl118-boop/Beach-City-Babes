// Free-text understanding for typed chat.
// Classifies a typed player message into an intent, pulls out the topic it's
// about, and reads sentiment — so the dialogue engine can reply to what was
// actually said. Fully offline and deterministic; no LLM required. (An LLM
// provider can be wired in separately; see game.js BCB_CHAT_PROVIDER.)
import { GIFT_CATEGORIES, ACTIVITIES, JOBS, QUIRKS } from './data.js';

// Intent signals: whole-word keywords + regex phrases. Higher weight = stronger pull.
const SIGNALS = {
  SPICY: {
    weight: 1.4,
    words: ['sexy', 'naked', 'nude', 'bed', 'body', 'touch', 'tonight', 'naughty',
      'turn me on', 'want you', 'undress', 'thigh', 'thighs', 'lips', 'skin', 'bite',
      'kiss you', 'make out', 'hookup', 'hook up', 'seduce', 'tempting', 'irresistible'],
    phrases: [/want you/i, /take you home/i, /can'?t stop thinking about (you|your body|your lips)/i,
      /get out of (those|that)/i, /my place or yours/i, /come over/i],
  },
  FLIRT: {
    weight: 1.2,
    words: ['date', 'crush', 'into you', 'like you', 'be mine', 'fall for you', 'flirt',
      'charming', 'dreamy', 'gorgeous', 'beautiful', 'handsome', 'cutie', 'sweetheart', 'darling'],
    phrases: [/go (out|on a date)/i, /do you like me/i, /be my/i, /you and me/i, /ask you out/i],
  },
  COMPLIMENT: {
    weight: 1,
    words: ['beautiful', 'gorgeous', 'stunning', 'pretty', 'handsome', 'cute', 'amazing',
      'smart', 'clever', 'talented', 'kind', 'sweet', 'lovely', 'perfect', 'wonderful',
      'incredible', 'best', 'love your', 'great', 'nice', 'admire', 'impressive'],
  },
  SERENADE: {
    weight: 1.3,
    words: ['sing', 'song', 'serenade', 'play you', 'guitar', 'melody', 'write you a song', 'ballad'],
    phrases: [/(sing|play).*(for|to) you/i, /wrote (you )?a song/i],
  },
  TEASE: {
    weight: 1.05,
    words: ['bet', 'loser', 'slowpoke', 'scared', 'chicken', 'weak', 'nerd', 'dork',
      'make me', 'prove it', 'too easy', 'catch me', 'race you', 'gloat', 'brat'],
    phrases: [/bet you can'?t/i, /is that all/i, /you wish/i, /in your dreams/i, /bad at/i, /can'?t (even|beat)/i],
  },
  JOKE: {
    weight: 1,
    words: ['haha', 'hah', 'lol', 'lmao', 'joke', 'funny', 'hilarious', 'pun', 'knock knock', 'riddle'],
    phrases: [/why (did|do|does|don'?t|are)/i, /what do you call/i, /knock knock/i, /😂|🤣|😆|😹/],
  },
  ASK: {
    weight: 0.8,
    words: ['tell me', 'what about you', 'your favorite', 'how come', 'curious', 'wondering'],
    phrases: [/tell me about/i, /what'?s your/i, /how (was|is) your/i, /what do you (do|like|think)/i],
  },
  GREETING: {
    weight: 0.9,
    words: ['hi', 'hey', 'hello', 'yo', 'sup', 'heya', 'hiya', 'howdy', 'morning',
      'good morning', 'good evening', 'hows it going', "how's it going", 'whats up', "what's up"],
  },
  AGREE: {
    weight: 0.7,
    words: ['thanks', 'thank you', 'agreed', 'me too', 'same', 'for sure', 'totally',
      'okay', 'sounds good', 'sure', 'yes', 'yeah', 'yep', 'deal'],
  },
};

const HOSTILE = ['ugly', 'stupid', 'idiot', 'dumb', 'hate you', 'gross', 'boring', 'annoying',
  'shut up', 'worst', 'disgusting', 'creep', 'pathetic', 'loser ', 'lame', 'get lost'];
const POSITIVE = ['love', 'like', 'great', 'happy', 'fun', 'amazing', 'beautiful', 'sweet',
  'good', 'nice', 'yes', 'wonderful', 'gorgeous', 'cute', 'best', 'adore'];
const NEGATIVE = ['no', 'not', 'hate', 'never', 'bad', 'ugh', 'boring', 'annoying', 'gross', 'tired', 'sad'];

// Topics we can recognize and reflect. factKey ties a question to a profile fact.
const TOPICS = [
  { id: 'work',    factKey: 'job',      words: ['work', 'job', 'career', 'living', 'shift', 'boss', 'coworker'] },
  { id: 'home',    factKey: 'hometown', words: ['from', 'hometown', 'grow up', 'grew up', 'born', 'live', 'where are you from'] },
  { id: 'likes',   factKey: 'loves',    words: ['favorite', 'favourite', 'love', 'into', 'enjoy', 'passion', 'hobby', 'hobbies', 'fun'] },
  { id: 'dislikes',factKey: 'dislikes', words: ['hate', 'dislike', 'annoy', 'pet peeve', 'cant stand', "can't stand", 'worst'] },
  { id: 'quirk',   factKey: 'quirk',    words: ['secret', 'weird', 'quirk', 'fun fact', 'strange', 'unusual', 'random'] },
  { id: 'type',    factKey: 'type',     words: ['type', 'single', 'dating', 'attracted', 'interested in', 'crush on', 'seeing someone'] },
  { id: 'rel',     factKey: 'rel',      words: ['exclusive', 'monogamous', 'polyamorous', 'poly', 'open relationship', 'commitment', 'what are we'] },
  { id: 'food',    words: ['food', 'eat', 'hungry', 'taco', 'sushi', 'smoothie', 'fudge', 'dinner', 'lunch', 'snack', 'coffee', 'drink'] },
  { id: 'music',   words: ['music', 'song', 'band', 'vinyl', 'dj', 'dance', 'concert', 'playlist'] },
  { id: 'beach',   words: ['beach', 'surf', 'wave', 'ocean', 'swim', 'sand', 'sun', 'tan', 'water', 'sea'] },
  { id: 'stars',   words: ['star', 'stars', 'moon', 'sky', 'constellation', 'astrology', 'horoscope', 'zodiac', 'night sky'] },
  { id: 'looks',   words: ['smile', 'eyes', 'hair', 'outfit', 'swimsuit', 'bikini', 'body', 'tattoo', 'style'] },
  { id: 'feelings',words: ['feel', 'feeling', 'happy', 'sad', 'lonely', 'miss you', 'love you', 'heart'] },
];

const STOP = new Set(['a', 'an', 'the', 'you', 'your', 'youre', 'i', 'im', 'me', 'my', 'is', 'are',
  'am', 'do', 'does', 'did', 'to', 'of', 'and', 'but', 'so', 'it', 'that', 'this', 'with', 'for',
  'on', 'in', 'at', 'be', 'have', 'has', 'was', 'were', 'they', 'them', 'we', 'us', 'he', 'she',
  'really', 'very', 'just', 'like', 'think', 'feel', 'about', 'got', 'get', 'gonna', 'wanna', 'how',
  'what', 'why', 'when', 'who', 'where', 'can', 'could', 'would', 'will', 'not', 'no', 'yes']);

function normalize(text) {
  return ' ' + text.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}

function hits(hay, word) {
  return word.includes(' ') ? hay.includes(word) : hay.includes(' ' + word + ' ');
}

// A notable word to mirror back ("You think I'm *gorgeous*?").
function echoWord(text) {
  const toks = text.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean);
  const cand = toks.filter(w => w.length >= 4 && !STOP.has(w));
  if (!cand.length) return null;
  return cand.sort((a, b) => b.length - a.length)[0];
}

export function classify(text, c, player) {
  const hay = normalize(text);
  const lower = text.toLowerCase();
  const scores = {};

  for (const [intent, sig] of Object.entries(SIGNALS)) {
    let s = 0;
    for (const w of sig.words) if (hits(hay, w)) s += sig.weight;
    for (const rx of (sig.phrases || [])) if (rx.test(lower)) s += 1.5;
    if (s) scores[intent] = s;
  }

  const isQuestion = /\?/.test(text) ||
    /^(what|where|when|who|why|how|do|does|are|is|can|could|would|have|has|tell|whats|what's)\b/.test(text.trim().toLowerCase());
  if (isQuestion) scores.ASK = (scores.ASK || 0) + 1.3;

  // sentiment
  let sentiment = 0;
  for (const w of POSITIVE) if (hits(hay, w)) sentiment += 1;
  for (const w of NEGATIVE) if (hits(hay, w)) sentiment -= 1;
  let hostile = 0;
  for (const w of HOSTILE) if (hay.includes(w.trim())) hostile += 1;

  // topic + fact
  let topic = null, factKey = null;
  for (const tp of TOPICS) {
    if (tp.words.some(w => hits(hay, w))) { topic = tp.id; factKey = tp.factKey || null; break; }
  }
  // mention of the NPC's own job/quirk pulls those topics
  if (!topic && c) {
    if (hits(hay, (c.job || '').split(' ')[0])) { topic = 'work'; factKey = 'job'; }
  }

  // hostile wins if clearly mean and not romantic/playful
  if (hostile >= 1 && !scores.FLIRT && !scores.SPICY && !scores.TEASE && !scores.COMPLIMENT) {
    return { intent: 'INSULT', topic, factKey, sentiment: -2, echo: echoWord(text), isQuestion, raw: text };
  }

  const PRIORITY = ['SPICY', 'FLIRT', 'SERENADE', 'COMPLIMENT', 'TEASE', 'JOKE', 'ASK', 'GREETING', 'AGREE'];
  let best = null, bestScore = 0;
  for (const intent of PRIORITY) {
    const s = scores[intent] || 0;
    if (s > bestScore + 1e-6) { best = intent; bestScore = s; }
  }
  if (!best) best = isQuestion ? 'ASK' : 'SMALLTALK';

  return { intent: best, topic, factKey, sentiment, echo: echoWord(text), isQuestion, raw: text };
}

// Human-readable topic label for reflections.
export function topicLabel(topic, c) {
  const map = {
    work: c ? c.job : 'work', home: 'where you’re from', likes: 'your favorite things',
    dislikes: 'pet peeves', quirk: 'your secrets', type: 'your type', rel: 'us',
    food: 'food', music: 'music', beach: 'the beach', stars: 'the stars',
    looks: 'looks', feelings: 'feelings',
  };
  return map[topic] || topic;
}
