// Overworld: Beach City locations, a day/night cycle, and NPC schedules.
// You can't summon anyone — you travel to a place and meet whoever is there
// this time of day. People follow routines built from their job and the hour.
import { RNG } from './rng.js';

// ---------- day/night cycle ----------
export const PHASES = [
  { id: 'dawn',      label: 'Dawn',       emoji: '🌅', tint: '#ffcf9e' },
  { id: 'morning',   label: 'Morning',    emoji: '☀️', tint: '#ffe7a8' },
  { id: 'afternoon', label: 'Afternoon',  emoji: '🌤️', tint: '#ffd6b0' },
  { id: 'evening',   label: 'Evening',    emoji: '🌇', tint: '#ff9e88' },
  { id: 'night',     label: 'Night',      emoji: '🌙', tint: '#5b4b8a' },
  { id: 'late',      label: 'Late Night', emoji: '🌌', tint: '#2f2a55' },
];

export function phaseOf(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  if (h >= 21 || h < 2) return 'night';
  return 'late';
}
export const phaseInfo = id => PHASES.find(p => p.id === id) || PHASES[1];
export const isNightPhase = id => id === 'night' || id === 'late' || id === 'dawn';

// ---------- locations ----------
// open: phases the place is active. jobs: whose workplace it is (they're here
// during work hours). acts/hustle/adult/clinic: what you can do on the spot.
export const LOCATIONS = [
  { id: 'beach',    name: 'The Beach',       emoji: '🏖️', col: 0, row: 0,
    open: ['dawn', 'morning', 'afternoon', 'evening'], vibe: 'sun-drenched and easy',
    jobs: ['lifeguard', 'surf coach', 'marine biologist', 'beach volleyball pro'], acts: ['walk', 'surf'] },
  { id: 'smoothie', name: 'Smoothie Hut',    emoji: '🥤', col: 1, row: 0,
    open: ['morning', 'afternoon', 'evening'], vibe: 'blender roar and citrus',
    jobs: ['smoothie barista'], acts: ['smoothie'] },
  { id: 'gym',      name: 'Sweat Beach Gym', emoji: '🏋️', col: 2, row: 0,
    open: ['morning', 'afternoon', 'evening'], vibe: 'mirrors and effort',
    jobs: ['yoga instructor'], hustle: 'gym', acts: ['yoga'] },
  { id: 'boardwalk',name: 'The Boardwalk',   emoji: '🎡', col: 0, row: 1,
    open: ['afternoon', 'evening', 'night'], vibe: 'neon, funnel cake, possibility',
    jobs: ['photographer', 'jewelry maker', 'skate shop owner'], acts: ['arcade'] },
  { id: 'studio',   name: 'Ink & Paint Studio', emoji: '🎨', col: 1, row: 1,
    open: ['morning', 'afternoon', 'evening'], vibe: 'turpentine and good playlists',
    jobs: ['tattoo artist', 'muralist'] },
  { id: 'pier',     name: 'The Pier',        emoji: '🎣', col: 2, row: 1,
    open: ['dawn', 'morning', 'evening', 'night'], vibe: 'salt wind and quiet',
    jobs: ['aquarium diver'], acts: ['stars'] },
  { id: 'tiki',     name: 'Tiki Lounge',     emoji: '🍹', col: 0, row: 2,
    open: ['evening', 'night', 'late'], vibe: 'rum, torchlight, bad decisions',
    jobs: ['bartender at the tiki lounge', 'mixologist'], acts: ['dance'], hustle: 'tiki' },
  { id: 'club',     name: 'Neon Club',       emoji: '💃', col: 1, row: 2,
    open: ['night', 'late'], vibe: 'bass you feel in your teeth',
    jobs: ['DJ'], acts: ['dance'] },
  { id: 'market',   name: 'Night Market',    emoji: '🏮', col: 2, row: 2,
    open: ['evening', 'night'], vibe: 'lantern light and street food',
    jobs: ['pastry chef'], acts: ['sushi'] },
  { id: 'shop',     name: 'Afterglow', emoji: '🔞', col: 0, row: 3,
    open: ['evening', 'night', 'late'], vibe: 'velvet ropes and no judgment', adult: true },
  { id: 'clinic',   name: 'Bay Health Clinic', emoji: '🏥', col: 1, row: 3,
    open: ['morning', 'afternoon'], vibe: 'clean, kind, confidential', clinic: true },
  { id: 'home',     name: 'Your Place',      emoji: '🏠', col: 2, row: 3,
    open: ['dawn', 'morning', 'afternoon', 'evening', 'night', 'late'], vibe: 'yours', home: true, rest: true },
];
export const locationById = id => LOCATIONS.find(l => l.id === id);
export const isOpen = (loc, phase) => loc.open.includes(phase);

// Social spots people drift to after work, weighted by phase.
const SOCIAL = {
  evening: ['boardwalk', 'tiki', 'market', 'beach', 'pier'],
  night:   ['tiki', 'club', 'market', 'boardwalk'],
  late:    ['club', 'tiki', 'home'],
  dawn:    ['home', 'beach', 'pier'],
  morning: ['smoothie', 'gym', 'beach'],
  afternoon: ['beach', 'boardwalk', 'gym', 'studio'],
};

// Build a stable daily routine for an NPC: phase -> location id.
// Work phases put them at their workplace; off-hours they socialize; a few are
// night owls or early birds. Seeded so it's consistent across a save.
export function ensureSchedule(c, seed) {
  if (c.schedule) return c.schedule;
  const rng = new RNG((seed ^ hashId(c.id)) >>> 0);
  const workplace = LOCATIONS.find(l => (l.jobs || []).includes(c.job));
  const owl = rng.chance(0.35); // night owls flip their active hours
  const sched = {};
  for (const p of PHASES) {
    let loc;
    if ((p.id === 'morning' || p.id === 'afternoon') && workplace && !owl) loc = workplace.id;
    else if ((p.id === 'evening' || p.id === 'night') && workplace && owl) loc = workplace.id;
    else if (p.id === 'late' || p.id === 'dawn') loc = rng.chance(0.7) ? 'home' : rng.pick(SOCIAL[p.id] || ['home']);
    else loc = rng.pick(SOCIAL[p.id] || ['beach']);
    sched[p.id] = loc;
  }
  c.schedule = sched;
  return sched;
}

export function npcLocation(c, phase, seed) {
  ensureSchedule(c, seed);
  return c.schedule[phase];
}

// Who is physically at a location right now (excludes those who walked off).
export function whoIsAt(npcs, locId, phase, seed) {
  return npcs.filter(c => !c.walkedToday && npcLocation(c, phase, seed) === locId);
}

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
