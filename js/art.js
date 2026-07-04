// Procedural animated 2D portraits — anime/ecchi styling, pure SVG.
// Big gradient eyes (heart pupils when smitten), pointy chin, blush stripes,
// strandy hair with shine, cheesecake proportions. Outfits get more daring and
// the backdrop shifts day → sunset → sultry night as heat rises.
// Idle animations (breathing, blinking, sway) are CSS-driven — see style.css.
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, SUIT_COLORS } from './characters.js';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Body geometry: shoulder half-width, waist half-width, bust scale (anime-exaggerated).
const BODY_GEO = {
  slim:     { sh: 30, wa: 20, bust: 0.9 },
  curvy:    { sh: 32, wa: 18, bust: 1.5 },
  athletic: { sh: 40, wa: 20, bust: 1.05 },
  soft:     { sh: 38, wa: 32, bust: 1.3 },
  muscular: { sh: 48, wa: 26, bust: 1.15 },
};

// Hair: big anime silhouettes (back) + jagged bangs (front). ahoge = antenna.
const HAIR_BACK = {
  waves: 'M50 90 C26 118 26 196 40 226 L52 208 L60 228 L72 210 L82 230 L118 230 L128 210 L140 228 L148 208 L160 226 C174 196 174 118 150 90 C130 58 70 58 50 90 Z',
  ponytail: 'M58 88 C44 104 42 132 50 152 L150 152 C158 124 154 100 142 88 C122 60 76 60 58 88 Z M138 92 C172 104 178 168 162 214 L150 200 L154 226 L138 206 C146 168 146 128 130 104 Z',
  bob: 'M52 90 C36 116 38 160 54 178 L64 166 L70 180 L130 180 L136 166 L146 178 C162 160 164 116 148 90 C128 58 72 58 52 90 Z',
  curls: 'M48 94 C24 124 28 200 50 220 L60 206 L68 224 L132 224 L140 206 L150 220 C172 200 176 124 152 94 C132 56 68 56 48 94 Z',
  bun: 'M56 90 C46 108 46 130 52 146 L148 146 C154 130 154 108 144 90 C124 58 76 58 56 90 Z M76 54 A26 22 0 1 1 124 54 A26 22 0 1 1 76 54 Z',
  short: 'M56 90 C48 102 48 118 52 130 L148 130 C152 118 152 102 144 90 C124 56 76 56 56 90 Z',
  swoop: 'M54 92 C46 106 46 124 52 134 L148 134 C154 120 154 100 144 88 C124 54 72 58 54 92 Z',
  buzz: 'M60 90 C54 100 54 112 58 120 L142 120 C146 112 146 100 140 90 C124 62 76 62 60 90 Z',
  curlsShort: 'M54 90 C44 102 44 124 52 136 L148 136 C156 124 156 102 146 90 C126 54 74 54 54 90 Z',
  manbun: 'M56 90 C50 100 50 116 54 126 L146 126 C150 116 150 100 144 90 C124 58 76 58 56 90 Z M84 50 A17 15 0 1 1 116 50 A17 15 0 1 1 84 50 Z',
};

const HAIR_FRONT = {
  waves: 'M52 96 C56 66 82 56 100 56 C118 56 144 66 148 96 L138 86 L132 98 L122 82 L112 96 L100 78 L88 96 L78 82 L68 98 L62 86 Z',
  ponytail: 'M54 94 C60 64 84 56 100 56 C116 56 140 64 146 94 L134 84 L124 94 L110 78 L96 94 L82 80 L70 94 L60 86 Z',
  bob: 'M52 96 C58 64 82 54 100 54 C118 54 142 64 148 96 L136 88 L128 98 L116 82 L104 96 L92 80 L80 96 L68 84 L60 96 Z',
  curls: 'M50 98 C54 64 80 54 100 54 C120 54 146 64 150 98 L138 86 L130 100 L118 84 L106 98 L94 82 L82 98 L70 86 L60 100 Z',
  bun: 'M54 94 C60 62 84 54 100 54 C116 54 140 62 146 94 L132 84 L120 94 L104 78 L90 94 L76 82 L64 94 Z',
  short: 'M56 92 C62 62 84 56 100 56 C116 56 138 62 144 92 L132 82 L120 90 L106 76 L92 90 L78 80 L66 92 Z',
  swoop: 'M54 94 C60 60 84 54 100 54 C120 54 142 64 146 92 L128 72 L110 88 L88 70 L74 86 L62 82 Z',
  buzz: 'M60 88 C66 68 84 62 100 62 C116 62 134 68 140 88 L124 80 L108 84 L92 78 L74 84 Z',
  curlsShort: 'M54 92 C58 60 82 52 100 52 C118 52 142 60 146 92 L134 82 L124 94 L112 78 L98 92 L86 78 L74 92 L62 82 Z',
  manbun: 'M58 90 C64 62 84 56 100 56 C116 56 136 62 142 90 L126 78 L110 86 L92 76 L74 86 L64 90 Z',
};

const AHOGE = { waves: 1, curls: 1, ponytail: 1, curlsShort: 1 }; // styles that get the antenna

// Emotion table: brow tilt, mouth path, blush 0..1, lid droop 0..1, pupil shape.
const EMOTIONS = {
  neutral: { brow: 0,  mouth: 'M93 132 Q100 136 107 132',                    blush: 0.15, lids: 0,    pupil: 'dot' },
  happy:   { brow: -2, mouth: 'M90 130 Q100 142 110 130',                    blush: 0.3,  lids: 0,    pupil: 'dot' },
  laugh:   { brow: -3, mouth: 'M88 128 Q100 146 112 128 Q100 138 88 128 Z',  blush: 0.4,  lids: 0.4,  pupil: 'dot' },
  shy:     { brow: 3,  mouth: 'M94 134 Q100 138 106 134',                    blush: 0.8,  lids: 0.3,  pupil: 'dot' },
  love:    { brow: -2, mouth: 'M90 130 Q100 143 110 130',                    blush: 0.85, lids: 0.2,  pupil: 'heart' },
  sultry:  { brow: -3, mouth: 'M92 132 Q102 140 110 130',                    blush: 1,    lids: 0.5,  pupil: 'heart' },
  smirk:   { brow: -4, mouth: 'M92 133 Q103 139 110 129',                    blush: 0.45, lids: 0.2,  pupil: 'dot' },
  annoyed: { brow: 6,  mouth: 'M92 137 Q100 131 108 137',                    blush: 0,    lids: 0.3,  pupil: 'dot' },
  sad:     { brow: 5,  mouth: 'M92 137 Q100 132 108 137',                    blush: 0.15, lids: 0.25, pupil: 'dot' },
  kiss:    { brow: -1, mouth: 'M96 131 Q100 128 104 131 Q100 138 96 131 Z',  blush: 0.95, lids: 0.6,  pupil: 'heart' },
};

function backdrop(uid, heat) {
  // heat 0: pastel beach day · 1: golden sunset · 2: sultry night
  if (heat >= 2) {
    return `
      <radialGradient id="bg-${uid}" cx="50%" cy="30%" r="85%">
        <stop offset="0%" stop-color="#4a2a6b"/><stop offset="100%" stop-color="#1d1035"/>
      </radialGradient>
      <rect width="200" height="260" fill="url(#bg-${uid})"/>
      <circle cx="160" cy="40" r="14" fill="#ffe9c4" opacity="0.9"/>
      <circle cx="154" cy="36" r="12" fill="#1d1035" opacity="0.55"/>
      ${[[22, 30], [58, 18], [96, 44], [130, 22], [178, 66], [40, 66], [12, 92]].map(([x, y], i) =>
        `<circle cx="${x}" cy="${y}" r="${1 + (i % 3) * 0.7}" fill="#fff" opacity="0.8" class="tw tw-${i % 3}"/>`).join('')}
      <rect width="200" height="260" fill="#ff5d8f" opacity="0.07"/>
      <g class="tw" fill="#ffd1e8" opacity="0.9">
        <path d="M24 150 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 Z"/>
        <path d="M176 120 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z"/>
      </g>`;
  }
  if (heat === 1) {
    return `
      <linearGradient id="bg-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffb26b"/><stop offset="60%" stop-color="#ff7d9c"/><stop offset="100%" stop-color="#c86b9b"/>
      </linearGradient>
      <rect width="200" height="260" fill="url(#bg-${uid})"/>
      <circle cx="100" cy="70" r="30" fill="#ffe9a8" opacity="0.7"/>`;
  }
  return `
    <radialGradient id="bg-${uid}" cx="50%" cy="35%" r="80%">
      <stop offset="0%" stop-color="#ffeef5"/><stop offset="100%" stop-color="#ffc4d6"/>
    </radialGradient>
    <rect width="200" height="260" fill="url(#bg-${uid})"/>
    <circle cx="100" cy="250" r="92" fill="#ffffff" opacity="0.4"/>`;
}

// Torso + outfit, parametrized by body geometry, presentation and heat tier.
function torso(c, heat) {
  const g = BODY_GEO[c.body];
  const skin = SKIN_TONES[c.look.skin];
  const skinD = shade(skin, -30);
  const skinL = shade(skin, 22);
  const suit = SUIT_COLORS[c.look.suit];
  const suitB = SUIT_COLORS[c.look.suitB];
  const L = 100 - g.sh, R = 100 + g.sh;
  const wL = 100 - g.wa, wR = 100 + g.wa;
  // anime shoulders: slope from neck, pinched waist
  const bodyPath = `M${wL} 260 C${wL - 2} 224 ${L} 206 ${L + 4} 198 C${L + 10} 190 ${R - 10} 190 ${R - 4} 198 C${R} 206 ${wR + 2} 224 ${wR} 260 Z`;
  const bodyFill = `<path d="${bodyPath}" fill="${skin}"/>
    <path d="${bodyPath}" fill="url(#sheen)" opacity="${heat >= 1 ? 0.5 : 0.2}"/>`;
  const neck = `<path d="M91 148 L91 176 Q100 184 109 176 L109 148 Z" fill="${skin}"/>
    <path d="M91 150 Q100 160 109 150 L109 156 Q100 165 91 156 Z" fill="${skinD}" opacity="0.45"/>`;
  const bw = 15 * g.bust;

  if (c.presentation === 'fem') {
    // anime bust: two circles + cleavage line at heat>=1
    const bustY = 218, bustR = 8 + 7 * g.bust;
    const bust = `
      <circle cx="${100 - bw * 0.62}" cy="${bustY}" r="${bustR}" fill="${skin}"/>
      <circle cx="${100 + bw * 0.62}" cy="${bustY}" r="${bustR}" fill="${skin}"/>
      ${heat >= 1 ? `<path d="M100 ${bustY - bustR * 0.55} C97 ${bustY - 2} 97 ${bustY + 2} 100 ${bustY + bustR * 0.5}" stroke="${skinD}" stroke-width="2.2" fill="none" opacity="0.6"/>` : ''}
      <ellipse cx="${100 - bw * 0.72}" cy="${bustY - bustR * 0.45}" rx="${bustR * 0.36}" ry="${bustR * 0.2}" fill="${skinL}" opacity="0.7"/>
      <ellipse cx="${100 + bw * 0.5}" cy="${bustY - bustR * 0.45}" rx="${bustR * 0.36}" ry="${bustR * 0.2}" fill="${skinL}" opacity="0.7"/>`;
    if (heat === 0) {
      // cute one-piece with a bow
      return `${bodyFill}${bust}
        <path d="M${wL + 2} 260 C${wL + 2} 228 ${L + 8} 210 100 206 C${R - 8} 210 ${wR - 2} 228 ${wR - 2} 260 Z" fill="${suit}"/>
        <path d="M${100 - bw - 6} 210 Q100 200 ${100 + bw + 6} 210 L${100 + bw} 236 Q100 228 ${100 - bw} 236 Z" fill="${suitB}"/>
        <path d="M96 206 l-7 -5 1 6 -6 2 6 2 -1 6 7 -5 7 5 -1 -6 6 -2 -6 -2 1 -6 Z" fill="#fff" opacity="0.9"/>
        ${neck}`;
    }
    if (heat === 1) {
      // classic bikini
      return `${bodyFill}${bust}
        <g stroke="${suit}" stroke-width="3" fill="none">
          <path d="M${100 - bw * 0.62} ${bustY - bustR} L93 160"/><path d="M${100 + bw * 0.62} ${bustY - bustR} L107 160"/>
        </g>
        <path d="M${100 - bw * 0.62 - bustR} ${bustY - 4} Q${100 - bw * 0.62} ${bustY - bustR - 3} ${100 - 2} ${bustY - 2} L${100 - bw * 0.62 + 2} ${bustY + bustR - 1} Q${100 - bw * 0.62 - bustR - 1} ${bustY + bustR * 0.5} ${100 - bw * 0.62 - bustR} ${bustY - 4} Z" fill="${suit}"/>
        <path d="M${100 + bw * 0.62 + bustR} ${bustY - 4} Q${100 + bw * 0.62} ${bustY - bustR - 3} ${100 + 2} ${bustY - 2} L${100 + bw * 0.62 - 2} ${bustY + bustR - 1} Q${100 + bw * 0.62 + bustR + 1} ${bustY + bustR * 0.5} ${100 + bw * 0.62 + bustR} ${bustY - 4} Z" fill="${suit}"/>
        <circle cx="100" cy="${bustY}" r="3.2" fill="${suitB}"/>
        ${neck}`;
    }
    // daring string micro-bikini + sparkles
    return `${bodyFill}${bust}
      <g stroke="${suit}" stroke-width="1.8" fill="none" opacity="0.95">
        <path d="M${100 - bw * 0.62} ${bustY - bustR + 2} L95 160"/><path d="M${100 + bw * 0.62} ${bustY - bustR + 2} L105 160"/>
        <path d="M${100 - bw * 0.62 - bustR} ${bustY} L${100 - g.sh - 2} 212"/><path d="M${100 + bw * 0.62 + bustR} ${bustY} L${100 + g.sh + 2} 212"/>
      </g>
      <path d="M${100 - bw * 0.62 - bustR * 0.7} ${bustY - 2} Q${100 - bw * 0.62} ${bustY - bustR * 0.9} ${100 - 4} ${bustY} L${100 - bw * 0.62 + 1} ${bustY + bustR * 0.8} Q${100 - bw * 0.62 - bustR * 0.8} ${bustY + bustR * 0.4} ${100 - bw * 0.62 - bustR * 0.7} ${bustY - 2} Z" fill="${suit}"/>
      <path d="M${100 + bw * 0.62 + bustR * 0.7} ${bustY - 2} Q${100 + bw * 0.62} ${bustY - bustR * 0.9} ${100 + 4} ${bustY} L${100 + bw * 0.62 - 1} ${bustY + bustR * 0.8} Q${100 + bw * 0.62 + bustR * 0.8} ${bustY + bustR * 0.4} ${100 + bw * 0.62 + bustR * 0.7} ${bustY - 2} Z" fill="${suit}"/>
      <g fill="#fff" opacity="0.95" class="tw">
        <path d="M${100 - bw - 12} 206 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 Z"/>
        <path d="M${100 + bw + 8} 240 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" class="tw-1"/>
      </g>
      ${neck}`;
  }

  // masc presentation: pecs + abs, anime shading
  const pecs = `
    <path d="M${100 - bw - 6} 212 Q${100 - bw * 0.4} 226 ${100 - 2} 216 M${100 + 2} 216 Q${100 + bw * 0.4} 226 ${100 + bw + 6} 212"
      stroke="${skinD}" stroke-width="2.4" fill="none" opacity="0.6"/>
    <path d="M100 214 L100 246" stroke="${skinD}" stroke-width="2" opacity="0.4"/>
    ${heat >= 1 ? `<path d="M92 232 h16 M92 244 h16" stroke="${skinD}" stroke-width="1.8" opacity="0.4"/>` : ''}`;
  if (heat === 0) {
    return `${bodyFill}
      <path d="M${wL + 2} 260 C${wL + 2} 222 ${L + 4} 204 100 200 C${R - 4} 204 ${wR - 2} 222 ${wR - 2} 260 Z" fill="${suit}"/>
      <path d="M${L + 10} 207 Q100 198 ${R - 10} 207 L${R - 14} 218 Q100 210 ${L + 14} 218 Z" fill="${suitB}"/>
      ${neck}`;
  }
  if (heat === 1) {
    return `${bodyFill}${pecs}
      <path d="M${L - 2} 260 C${L - 2} 216 ${L + 2} 202 ${100 - 12} 197 L${100 - bw * 0.5} 260 Z" fill="${suit}"/>
      <path d="M${R + 2} 260 C${R + 2} 216 ${R - 2} 202 ${100 + 12} 197 L${100 + bw * 0.5} 260 Z" fill="${suit}"/>
      ${neck}`;
  }
  return `${bodyFill}${pecs}
    <path d="M88 166 Q100 182 112 166" stroke="#e8d8b0" stroke-width="3" fill="none"/>
    <path d="M97 179 L100 187 L103 179 Z" fill="#fff8e7"/>
    <g fill="#fff" opacity="0.95" class="tw">
      <path d="M${L - 6} 210 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 Z"/>
    </g>
    ${neck}`;
}

// heat level for art: relationship tier + a desire kicker.
export function heatLevel(c, tier) {
  if (tier >= 3 || (tier >= 2 && c.desire >= 70)) return 2;
  if (tier >= 2 || (tier >= 1 && c.desire >= 50)) return 1;
  return 0;
}

function animeEye(cx, eyeGrad, uid) {
  // tall anime eye: white, big gradient iris, dot & heart pupils, twin highlights
  return `
    <g class="p-eyeball">
      <path d="M${cx - 12} 104 Q${cx} 88 ${cx + 12} 104 Q${cx + 11} 120 ${cx} 121 Q${cx - 11} 120 ${cx - 12} 104 Z" fill="#fff"/>
      <ellipse cx="${cx}" cy="106" rx="8.6" ry="11.5" fill="url(#iris-${uid})"/>
      <ellipse class="p-pupil" cx="${cx}" cy="107" rx="3.6" ry="5" fill="#151515"/>
      <path class="p-heartpupil" d="M${cx} 103 c-2.4 -3.6 -7.6 -2 -7.6 2.2 c0 3.6 7.6 8.2 7.6 8.2 s7.6 -4.6 7.6 -8.2 c0 -4.2 -5.2 -5.8 -7.6 -2.2 Z" fill="#ff2d6f" opacity="0"/>
      <circle cx="${cx - 3.4}" cy="99" r="3.1" fill="#fff" opacity="0.95"/>
      <circle cx="${cx + 4}" cy="112" r="1.7" fill="#fff" opacity="0.85"/>
    </g>`;
}

export function portraitSVG(c, uid, tier = 0) {
  const skin = SKIN_TONES[c.look.skin];
  const skinD = shade(skin, -30);
  const hair = HAIR_COLORS[c.look.hairColor];
  const hairD = shade(hair, -26);
  const hairL = shade(hair, 40);
  const eye = EYE_COLORS[c.look.eyes];
  const eyeL = shade(eye, 60);
  const suitB = SUIT_COLORS[c.look.suitB];
  const acc = c.look.accessory;
  const heat = heatLevel(c, tier);

  const accessory =
    acc === 'flower' ? `<g><circle cx="140" cy="80" r="9" fill="#ff6b9d"/><circle cx="140" cy="80" r="3.5" fill="#ffd166"/></g>` :
    acc === 'shades' ? `<rect x="66" y="58" width="68" height="10" rx="5" fill="#222" opacity="0.85"/>` :
    acc === 'hoops'  ? `<g stroke="#ffd166" stroke-width="2.5" fill="none"><circle cx="60" cy="122" r="7"/><circle cx="140" cy="122" r="7"/></g>` :
    acc === 'choker' ? `<rect x="88" y="152" width="24" height="6" rx="3" fill="${suitB}"/>` :
    acc === 'cap'    ? `<path d="M60 70 C64 50 136 50 140 70 L150 74 L140 79 C130 64 70 64 60 79 Z" fill="${suitB}"/>` :
    acc === 'stud'   ? `<circle cx="60" cy="120" r="3" fill="#ffd166"/>` : '';

  const ahoge = AHOGE[c.look.hairStyle]
    ? `<path class="p-ahoge" d="M100 56 C96 44 108 38 104 28 C112 36 106 48 104 56 Z" fill="${hair}"/>` : '';

  return `
  <svg class="portrait heat-${heat}" viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Portrait of ${c.name}">
    <defs>
      <clipPath id="clip-${uid}"><rect x="0" y="0" width="200" height="260" rx="18"/></clipPath>
      <linearGradient id="iris-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${shade(eye, -50)}"/><stop offset="55%" stop-color="${eye}"/><stop offset="100%" stop-color="${eyeL}"/>
      </linearGradient>
      <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#fff" stop-opacity="0"/><stop offset="45%" stop-color="#fff" stop-opacity="0.25"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#clip-${uid})">
      ${backdrop(uid, heat)}
      <g class="p-sway">
        <path d="${HAIR_BACK[c.look.hairStyle]}" fill="${hairD}"/>
      </g>
      <g class="p-breathe">
        ${torso(c, heat)}
      </g>
      <g class="p-head">
        <!-- anime head: round crown, tapered chin -->
        <path d="M57 96 C57 58 143 58 143 96 C143 122 126 146 100 154 C74 146 57 122 57 96 Z" fill="${skin}"/>
        <path d="M57 96 C57 58 143 58 143 96 C143 100 142 104 141 108 L59 108 C58 104 57 100 57 96 Z" fill="${skin}"/>
        <!-- brows -->
        <g class="p-brows" stroke="${hairD}" stroke-width="3" stroke-linecap="round" fill="none">
          <path d="M68 86 Q80 80 92 84"/>
          <path d="M108 84 Q120 80 132 86"/>
        </g>
        ${animeEye(80, eye, uid)}
        ${animeEye(120, eye, uid)}
        <!-- heavy top lash lines -->
        <g stroke="#191919" stroke-width="3.4" stroke-linecap="round" fill="none">
          <path d="M68 100 Q80 90 92 100"/><path d="M108 100 Q120 90 132 100"/>
          <path d="M66 101 l-4 -3 M134 101 l4 -3" stroke-width="2.6"/>
        </g>
        <!-- lids (droop) + blink -->
        <g fill="${skin}">
          <rect class="p-lid" x="66" y="90" width="28" height="0" rx="5"/>
          <rect class="p-lid" x="106" y="90" width="28" height="0" rx="5"/>
        </g>
        <g class="p-blinklids" fill="${skin}">
          <rect x="66" y="92" width="28" height="28" rx="9"/>
          <rect x="106" y="92" width="28" height="28" rx="9"/>
        </g>
        <!-- tiny anime nose -->
        <path d="M99 119 L101 123" stroke="${skinD}" stroke-width="2" stroke-linecap="round"/>
        <!-- blush: soft pad + anime stripes -->
        <g class="p-blush" opacity="0.2">
          <ellipse cx="72" cy="122" rx="10" ry="5.5" fill="#ff7096" opacity="0.55"/>
          <ellipse cx="128" cy="122" rx="10" ry="5.5" fill="#ff7096" opacity="0.55"/>
          <g stroke="#e0517c" stroke-width="1.6" stroke-linecap="round">
            <path d="M66 119 l7 6 M72 117 l7 6 M78 115 l7 6"/>
            <path d="M120 115 l7 6 M126 117 l7 6 M132 119 l7 6"/>
          </g>
        </g>
        <path class="p-mouth" d="${EMOTIONS.neutral.mouth}" stroke="#c2405e" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- bangs + shine + ahoge + accessory -->
        <g class="p-sway">
          <path d="${HAIR_FRONT[c.look.hairStyle]}" fill="${hair}"/>
          <path d="M64 78 Q100 60 136 78 Q100 68 64 78 Z" fill="${hairL}" opacity="0.65"/>
          ${ahoge}
          ${accessory}
        </g>
      </g>
    </g>
  </svg>`;
}

export function setEmotion(container, emotion) {
  const e = EMOTIONS[emotion] || EMOTIONS.neutral;
  const svg = container.querySelector('svg.portrait');
  if (!svg) return;
  const mouth = svg.querySelector('.p-mouth');
  const blush = svg.querySelector('.p-blush');
  const brows = svg.querySelector('.p-brows');
  const lids = svg.querySelectorAll('.p-lid');
  if (mouth) {
    mouth.setAttribute('d', e.mouth);
    mouth.setAttribute('fill', e.mouth.includes('Z') ? '#e8607e' : 'none');
  }
  if (blush) blush.setAttribute('opacity', e.blush);
  if (brows) brows.style.transform = `translateY(${e.brow}px)`;
  lids.forEach(l => l.setAttribute('height', String(28 * e.lids)));
  svg.querySelectorAll('.p-pupil').forEach(p => p.setAttribute('opacity', e.pupil === 'heart' ? '0' : '1'));
  svg.querySelectorAll('.p-heartpupil').forEach(p => p.setAttribute('opacity', e.pupil === 'heart' ? '1' : '0'));
}

export function emotionFor(c, tier = 0) {
  if (c.partner) return 'sultry';
  if (c.mood <= -2) return 'annoyed';
  if (c.mood === -1) return 'sad';
  if (tier >= 2 && c.desire >= 70) return 'sultry';
  if (c.desire >= 60) return 'love';
  if (c.desire >= 40) return 'shy';
  if (c.affection >= 55) return 'happy';
  if (c.affection >= 30) return 'smirk';
  return 'neutral';
}

// Floating heart burst over an element (feedback for good moves).
export function heartBurst(el, n = 6, symbol = '💗') {
  const rect = el.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const h = document.createElement('div');
    h.className = 'heart-float';
    h.textContent = symbol;
    h.style.left = `${rect.left + rect.width * (0.25 + Math.random() * 0.5)}px`;
    h.style.top = `${rect.top + rect.height * (0.3 + Math.random() * 0.3)}px`;
    h.style.animationDelay = `${i * 90}ms`;
    h.style.fontSize = `${14 + Math.random() * 16}px`;
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 2400 + i * 90);
  }
}

// ---------- Finale scene ----------
// The big finish: sunset dissolves to night, bonfire, the couple melts into a
// kiss, hearts rise, fireworks pop — then a knowing fade to starlight.
export function finaleSVG(c) {
  const skin = SKIN_TONES[c.look.skin];
  const hair = HAIR_COLORS[c.look.hairColor];
  const suit = SUIT_COLORS[c.look.suit];
  return `
  <svg class="finale-svg" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fin-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2b1a4e"><animate attributeName="stop-color" values="#ff9e6d;#b8577e;#2b1a4e" dur="9s" fill="freeze"/></stop>
        <stop offset="55%" stop-color="#4a2a6b"><animate attributeName="stop-color" values="#ffd27f;#d86a8a;#4a2a6b" dur="9s" fill="freeze"/></stop>
        <stop offset="100%" stop-color="#7a3b6e"><animate attributeName="stop-color" values="#ffe9a8;#f08a7a;#7a3b6e" dur="9s" fill="freeze"/></stop>
      </linearGradient>
      <radialGradient id="fin-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd166" stop-opacity="0.9"/><stop offset="100%" stop-color="#ffd166" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="300" fill="url(#fin-sky)"/>
    <circle cx="320" cy="90" r="26" fill="#ffd166">
      <animate attributeName="cy" values="90;210" dur="9s" fill="freeze"/>
      <animate attributeName="opacity" values="1;1;0" dur="9s" fill="freeze"/>
    </circle>
    <g class="fin-stars">
      ${Array.from({ length: 24 }, (_, i) => {
        const x = (i * 61) % 390 + 5, y = (i * 37) % 140 + 8, d = (i % 5) * 0.6;
        return `<circle cx="${x}" cy="${y}" r="${1 + (i % 3) * 0.6}" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;0;0.9;0.4;0.9" dur="9s" begin="${d}s" fill="freeze"/></circle>`;
      }).join('')}
    </g>
    <rect y="200" width="400" height="100" fill="#1d3557" opacity="0.9"/>
    <path class="fin-wave" d="M0 205 Q50 197 100 205 T200 205 T300 205 T400 205 V300 H0 Z" fill="#2a5b8a" opacity="0.8"/>
    <path d="M0 258 Q200 240 400 262 V300 H0 Z" fill="#e9c46a"/>
    <g transform="translate(90 244)">
      <path d="M-16 12 L16 12 L10 18 L-10 18 Z" fill="#6b4423"/>
      <g class="fin-flame">
        <path d="M0 12 C-12 0 -8 -14 0 -24 C8 -14 12 0 0 12 Z" fill="#ff9f1c"/>
        <path d="M0 10 C-6 2 -4 -6 0 -13 C4 -6 6 2 0 10 Z" fill="#ffd166"/>
      </g>
      <circle r="34" cy="-6" fill="url(#fin-glow)" class="fin-flicker"/>
    </g>
    <!-- the couple leans into a kiss -->
    <g transform="translate(230 216)">
      <g class="fin-her">
        <path d="M-4 44 C-14 20 -12 4 -2 -6 C6 -12 10 -20 8 -28 A10 10 0 1 0 -6 -22 C-16 -10 -22 12 -16 44 Z" fill="#241a33"/>
        <path d="M-4 44 C-14 20 -12 4 -2 -6 C6 -12 10 -20 8 -28 A10 10 0 1 0 -6 -22 C-16 -10 -22 12 -16 44 Z" fill="${suit}" opacity="0.55"/>
        <circle cx="1" cy="-30" r="9" fill="${skin}"/>
        <path d="M-9 -34 C-8 -44 8 -46 11 -34 C12 -26 8 -22 6 -16 C2 -22 -8 -24 -9 -34 Z" fill="${hair}"/>
      </g>
      <g class="fin-him">
        <path d="M34 44 C44 20 42 4 32 -6 C24 -12 20 -20 22 -28 A10 10 0 1 1 36 -22 C46 -10 52 12 46 44 Z" fill="#241a33"/>
        <circle cx="29" cy="-30" r="9" fill="#c68642"/>
        <path d="M20 -34 C22 -43 37 -43 39 -33 C39 -28 36 -26 35 -22 C30 -27 21 -28 20 -34 Z" fill="#2b2118"/>
      </g>
      <g class="fin-kissheart" opacity="0">
        <path d="M15 -46 c-3 -5 -11 -3 -11 3 c0 5 11 11 11 11 s11 -6 11 -11 c0 -6 -8 -8 -11 -3 Z" fill="#ff5d8f"/>
      </g>
    </g>
  </svg>`;
}

export function spawnFireworks(container, bursts = 5) {
  const colors = ['#ff5d8f', '#ffd166', '#06d6a0', '#3a86ff', '#ff9f1c'];
  for (let b = 0; b < bursts; b++) {
    setTimeout(() => {
      const cx = 10 + Math.random() * 80;
      const cy = 8 + Math.random() * 40;
      const color = colors[b % colors.length];
      for (let i = 0; i < 14; i++) {
        const p = document.createElement('div');
        p.className = 'fw-particle';
        const ang = (i / 14) * Math.PI * 2;
        const dist = 34 + Math.random() * 30;
        p.style.left = `${cx}%`;
        p.style.top = `${cy}%`;
        p.style.background = color;
        p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
        p.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
        container.appendChild(p);
        setTimeout(() => p.remove(), 1600);
      }
    }, b * 700 + Math.random() * 300);
  }
}
