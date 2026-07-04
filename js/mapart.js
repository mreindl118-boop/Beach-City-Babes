// Illustrated, clickable Beach City map (pure SVG). Top-down cartoon town:
// ocean and pier up top, sandy shore, then streets of little buildings — one
// per location. Time of day repaints the sky, water, and window-glow. Each
// location is a <g class="map-hot" data-loc> hotspot the UI wires for travel.
import { LOCATIONS, isOpen, phaseInfo, isNightPhase } from './world.js';

// per-phase palette
const SKY = {
  dawn:      ['#ffd9a8', '#ffb0c4'],
  morning:   ['#bfe9ff', '#eaf7ff'],
  afternoon: ['#a6dcff', '#d8f2ff'],
  evening:   ['#ffb27a', '#ff7fa6'],
  night:     ['#243066', '#3a2a63'],
  late:      ['#141a3a', '#241f47'],
};
const SEA = {
  dawn: '#5aa9c8', morning: '#39a7d8', afternoon: '#2b9fd6',
  evening: '#4a6db0', night: '#1c2a63', late: '#141d44',
};
const SAND = {
  dawn: '#f2d9a8', morning: '#f6dfab', afternoon: '#f4d89a',
  evening: '#d9b184', night: '#6a5a52', late: '#4c4048',
};
const GROUND = {
  dawn: '#cfe0b8', morning: '#d6ebb8', afternoon: '#cfe6ad',
  evening: '#a88f8a', night: '#3b3358', late: '#2c2743',
};

function buildingShape(l, x, y, night, open) {
  const w = 34, h = 26;
  const wall = open ? '#fff6f0' : '#e6dfe0';
  const roof = {
    sand: '#ffd166', pier: '#c98a5a', hut: '#57b56b', fun: '#ff5d8f',
    shop: '#7b6cff', club: '#ff2d6f', home: '#2ec4b6',
  }[l.kind] || '#ff9f1c';
  const glow = night && open ? '#ffe28a' : '#bcd0e0';
  const lit = night && open;
  if (l.kind === 'sand') {
    // beach umbrella + towel instead of a building
    return `
      <g>
        <ellipse cx="${x}" cy="${y + 12}" rx="20" ry="7" fill="#00000022"/>
        <path d="M${x - 16} ${y + 4} Q${x} ${y - 16} ${x + 16} ${y + 4} Z" fill="#ff5d8f"/>
        <path d="M${x - 16} ${y + 4} Q${x - 8} ${y - 3} ${x} ${y + 4} Q${x + 8} ${y - 3} ${x + 16} ${y + 4}" fill="#fff" opacity="0.5"/>
        <line x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 12}" stroke="#8a5a2b" stroke-width="2.5"/>
      </g>`;
  }
  if (l.kind === 'pier') {
    return `
      <g>
        <rect x="${x - 8}" y="${y - 2}" width="16" height="40" rx="2" fill="#b07a44"/>
        <rect x="${x - 18}" y="${y - 14}" width="36" height="18" rx="4" fill="${wall}" stroke="#c98a5a" stroke-width="2"/>
        <path d="M${x - 20} ${y - 14} L${x} ${y - 24} L${x + 20} ${y - 14} Z" fill="${roof}"/>
        <rect x="${x - 6}" y="${y - 8}" width="5" height="6" fill="${glow}"/><rect x="${x + 2}" y="${y - 8}" width="5" height="6" fill="${glow}"/>
      </g>`;
  }
  // generic little building
  return `
    <g>
      <ellipse cx="${x}" cy="${y + h / 2 + 3}" rx="${w / 2 + 2}" ry="5" fill="#00000022"/>
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="4" fill="${wall}" stroke="#00000018" stroke-width="1.5"/>
      <path d="M${x - w / 2 - 3} ${y - h / 2 + 2} L${x} ${y - h / 2 - 12} L${x + w / 2 + 3} ${y - h / 2 + 2} Z" fill="${roof}"/>
      <rect x="${x - 9}" y="${y - 4}" width="7" height="8" rx="1" fill="${glow}" opacity="${lit ? 1 : 0.7}"/>
      <rect x="${x + 3}" y="${y - 4}" width="7" height="8" rx="1" fill="${glow}" opacity="${lit ? 1 : 0.7}"/>
      <rect x="${x - 3.5}" y="${y + 4}" width="7" height="9" rx="1" fill="${roof}" opacity="0.85"/>
      ${l.kind === 'fun' ? `<circle cx="${x}" cy="${y - h / 2 - 20}" r="9" fill="none" stroke="${roof}" stroke-width="2"/><circle cx="${x}" cy="${y - h / 2 - 20}" r="2.4" fill="${roof}"/>` : ''}
      ${lit ? `<circle cx="${x}" cy="${y - h / 2 - 14}" r="16" fill="${roof}" opacity="0.14"/>` : ''}
    </g>`;
}

// label ribbon width from text length (emoji + chars), and keep it on-canvas
const labelW = name => Math.max(34, name.length * 4.7 + 18);
const clampX = (mx, name) => Math.max(labelW(name) / 2 + 2, Math.min(320 - labelW(name) / 2 - 2, mx));

export function mapSVG(state) {
  const { phase, playerLoc, presenceByLoc } = state;
  const night = isNightPhase(phase);
  const [s0, s1] = SKY[phase] || SKY.morning;
  const sea = SEA[phase], sand = SAND[phase], ground = GROUND[phase];

  const stars = night ? Array.from({ length: 26 }, (_, i) => {
    const x = (i * 71) % 316 + 2, y = (i * 29) % 40 + 4;
    return `<circle cx="${x}" cy="${y}" r="${0.8 + (i % 3) * 0.5}" fill="#fff" opacity="${0.5 + (i % 4) * 0.12}"/>`;
  }).join('') : '';

  const roads = `
    <g stroke="${night ? '#00000030' : '#ffffff66'}" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M20 118 H300"/><path d="M150 96 V226"/><path d="M60 150 H260"/>
    </g>`;

  const markers = LOCATIONS.map(l => {
    const open = isOpen(l, phase);
    const here = l.id === playerLoc;
    const people = presenceByLoc[l.id] || [];
    const dots = people.slice(0, 4).map((_, i) =>
      `<circle cx="${l.mx - 12 + i * 8}" cy="${l.my + 20}" r="3.2" fill="#ff5d8f" stroke="#fff" stroke-width="1"/>`).join('');
    return `
    <g class="map-hot ${open ? '' : 'closed'} ${here ? 'here' : ''}" data-loc="${l.id}" tabindex="0" role="button" aria-label="${l.name}${open ? '' : ', closed'}">
      <rect x="${l.mx - 26}" y="${l.my - 34}" width="52" height="64" rx="8" fill="transparent" class="hot-target"/>
      ${here ? `<circle cx="${l.mx}" cy="${l.my - 2}" r="30" fill="#ffd166" opacity="0.22" class="here-pulse"/>` : ''}
      ${buildingShape(l, l.mx, l.my, night, open)}
      <g transform="translate(${clampX(l.mx, l.name)} ${l.my - 30})">
        <rect x="${-labelW(l.name) / 2}" y="-8.5" width="${labelW(l.name)}" height="15" rx="7.5" fill="${open ? (night ? '#2a2350dd' : '#ffffffe6') : '#9a929644'}"/>
        <text x="0" y="2.5" text-anchor="middle" font-size="8" font-weight="700" fill="${open ? (night ? '#ffe9f1' : '#33202c') : '#00000055'}">${l.emoji} ${l.name}</text>
      </g>
      ${dots}
      ${here ? `<text x="${l.mx}" y="${l.my + 34}" text-anchor="middle" font-size="8" font-weight="800" fill="#e0a000">📍 YOU</text>`
        : !open ? `<text x="${l.mx}" y="${l.my + 22}" text-anchor="middle" font-size="7.5" fill="#00000066">🔒 closed</text>` : ''}
    </g>`;
  }).join('');

  const ph = phaseInfo(phase);
  return `
  <svg class="citymap" viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of Beach City">
    <defs>
      <linearGradient id="mapsky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s0}"/><stop offset="100%" stop-color="${s1}"/>
      </linearGradient>
      <linearGradient id="mapsea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${sea}"/><stop offset="100%" stop-color="${sand}"/>
      </linearGradient>
    </defs>
    <rect width="320" height="240" fill="url(#mapsky)"/>
    ${stars}
    ${night ? '<circle cx="270" cy="34" r="14" fill="#f2ecd0"/><circle cx="264" cy="30" r="11" fill="url(#mapsky)"/>'
            : `<circle cx="270" cy="34" r="16" fill="#fff3b0" opacity="0.95"/>`}
    <!-- ocean -->
    <path d="M0 0 H320 V70 Q240 84 160 74 Q80 64 0 78 Z" fill="url(#mapsea)" opacity="0.96"/>
    <g stroke="#ffffff66" stroke-width="2" fill="none" opacity="0.5">
      <path d="M10 40 q14 -6 28 0 t28 0 t28 0"/><path d="M180 30 q14 -6 28 0 t28 0 t28 0"/>
    </g>
    <!-- sandy shore band -->
    <path d="M0 72 Q80 60 160 72 Q240 84 320 66 V120 H0 Z" fill="${sand}"/>
    <!-- town ground -->
    <rect y="112" width="320" height="128" fill="${ground}"/>
    ${roads}
    ${markers}
    <!-- title ribbon -->
    <g>
      <rect x="8" y="8" width="150" height="20" rx="10" fill="${night ? '#2a2350cc' : '#ffffffcc'}"/>
      <text x="18" y="22" font-size="11" font-weight="800" fill="${night ? '#ffe9f1' : '#d94571'}">🍑 Beach City · ${ph.emoji} ${ph.label}</text>
    </g>
  </svg>`;
}
