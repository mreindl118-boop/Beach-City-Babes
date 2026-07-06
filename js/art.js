// Procedural animated 2D portraits — "Sticker-Pop Cartoon" style, pure SVG.
// Every character reads like a die-cut sticker: a white outer stroke wraps the
// whole silhouette (feMorphology dilate), thick warm-brown interior outlines,
// flat cel shading (one hard shadow + white specular shines per region),
// two-tone hair (dark roots melting into a vivid accent), and accent-color
// coordination across iris, nails, sparkles and UI. Bodies are parametric —
// continuous bust/waist/hip/shoulder measurements plus a pose, so no two
// silhouettes repeat. Hips/thighs carry the dominant silhouette read.
// Idle animations (breathing, blinking, sway) are CSS-driven — see style.css.
import {
  SKIN_TONES, HAIR_COLORS, SUIT_COLORS, ACCENTS, ACCENT_NAMES,
} from './characters.js';
import { BODY_LABELS, GENDER_LABELS } from './data.js';

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const OUT = '#3b2a23'; // warm near-black interior outline

// ---------- hair: chunky sticker silhouettes, gradient root → accent ----------
const HAIR_BACK = {
  waves: 'M58 70 C38 92 38 152 52 180 Q60 190 70 180 Q68 194 82 192 Q94 202 100 190 Q106 202 118 192 Q132 194 130 180 Q140 190 148 180 C162 152 162 92 142 70 C128 42 72 42 58 70 Z',
  ponytail: 'M62 70 C50 82 48 104 56 118 L144 118 C152 104 150 82 138 70 C124 42 76 42 62 70 Z M134 76 C168 92 174 152 158 194 Q150 204 143 192 Q136 202 131 188 C142 154 142 116 124 94 Z',
  bob: 'M58 70 C44 90 46 130 60 146 Q66 156 76 146 L124 146 Q134 156 140 146 C154 130 156 90 142 70 C128 42 72 42 58 70 Z',
  curls: 'M56 76 C40 82 36 108 48 120 C36 132 42 156 58 160 C52 176 68 188 82 180 C88 194 112 194 118 180 C132 188 148 176 142 160 C158 156 164 132 152 120 C164 108 160 82 144 76 C136 46 64 46 56 76 Z',
  bun: 'M60 70 C50 82 48 102 56 116 L144 116 C152 102 150 82 140 70 C126 42 74 42 60 70 Z M82 34 A20 17 0 1 1 118 34 A20 17 0 1 1 82 34 Z',
  short: 'M60 68 C50 78 50 96 56 106 L144 106 C150 96 150 78 140 68 C126 42 74 42 60 68 Z',
  swoop: 'M58 70 C48 82 48 102 54 112 L146 112 C152 98 152 78 142 66 C126 38 72 44 58 70 Z',
  buzz: 'M64 66 C60 74 60 86 62 94 L138 94 C140 86 140 74 136 66 C124 42 76 42 64 66 Z',
  curlsShort: 'M56 70 C46 80 46 104 54 114 Q60 122 68 114 L132 114 Q140 122 146 114 C154 104 154 80 144 70 C128 40 72 40 56 70 Z',
  manbun: 'M60 68 C52 78 52 96 56 106 L144 106 C148 96 148 78 140 68 C126 42 74 42 60 68 Z M88 28 A13 11 0 1 1 112 28 A13 11 0 1 1 88 28 Z',
};

const HAIR_FRONT = {
  waves: 'M64 72 C66 46 88 38 100 38 C112 38 134 46 136 72 Q128 60 119 68 Q112 54 100 60 Q88 52 81 68 Q72 60 64 72 Z',
  ponytail: 'M64 70 C68 44 88 38 100 38 C112 38 132 44 136 70 Q126 58 114 64 Q104 52 92 62 Q80 56 64 70 Z',
  bob: 'M62 72 C66 44 86 36 100 36 C114 36 134 44 138 72 Q130 60 120 68 Q112 54 100 62 Q88 52 80 68 Q70 60 62 72 Z',
  curls: 'M62 74 C64 46 84 36 100 36 C116 36 136 46 138 74 Q130 62 121 70 Q114 56 103 64 Q94 54 85 66 Q74 60 62 74 Z',
  bun: 'M64 70 C68 44 86 38 100 38 C114 38 132 44 136 70 Q124 58 110 64 Q98 52 86 64 Q74 58 64 70 Z',
  short: 'M66 68 C70 46 88 40 100 40 C112 40 130 46 134 68 Q124 58 112 62 Q100 52 88 62 Q76 58 66 68 Z',
  swoop: 'M62 70 C66 42 86 36 100 36 C116 36 136 46 138 68 Q120 50 104 62 Q86 46 76 60 Q68 62 62 70 Z',
  buzz: 'M68 62 Q100 50 132 62 Q100 56 68 62 Z',
  curlsShort: 'M62 70 C64 42 84 34 100 34 C116 34 136 42 138 70 Q128 58 118 66 Q108 52 98 62 Q88 52 78 64 Q70 58 62 70 Z',
  manbun: 'M66 66 C70 46 88 40 100 40 C112 40 130 46 134 66 Q120 54 106 60 Q94 50 82 60 Q74 58 66 66 Z',
};

const AHOGE = { waves: 1, curls: 1, ponytail: 1, curlsShort: 1 };

// ---------- faces: adult, heavy-lidded, confident ----------
// brow: translateY · lids: droop 0..1 · pupil: dot|heart · teeth: grin band
const EMOTIONS = {
  neutral: { brow: 0,  lids: 0.18, blush: 0.15, pupil: 'dot',   teeth: false, mouth: 'M93 95 Q101 99 108 93.5' },
  smug:    { brow: -3, lids: 0.3,  blush: 0.35, pupil: 'dot',   teeth: false, mouth: 'M92 95.5 Q103 100 110 92.5' },
  teasing: { brow: -3, lids: 0.25, blush: 0.45, pupil: 'dot',   teeth: true,  mouth: 'M90 93.5 Q100 102 110 93.5 Q100 97 90 93.5 Z' },
  happy:   { brow: -2, lids: 0.05, blush: 0.3,  pupil: 'dot',   teeth: true,  mouth: 'M88 93 Q100 105 112 93 Q100 97 88 93 Z' },
  laugh:   { brow: -3, lids: 0.45, blush: 0.4,  pupil: 'dot',   teeth: true,  mouth: 'M86 92 Q100 110 114 92 Q100 98 86 92 Z' },
  shy:     { brow: 2,  lids: 0.3,  blush: 0.8,  pupil: 'dot',   teeth: false, mouth: 'M95 96 Q100 99 105 96' },
  love:    { brow: -2, lids: 0.2,  blush: 0.85, pupil: 'heart', teeth: true,  mouth: 'M89 93.5 Q100 104 111 93.5 Q100 97.5 89 93.5 Z' },
  sultry:  { brow: -3, lids: 0.55, blush: 1,    pupil: 'heart', teeth: false, mouth: 'M93 96 Q104 100.5 110 93.5' },
  annoyed: { brow: 5,  lids: 0.3,  blush: 0,    pupil: 'dot',   teeth: false, mouth: 'M92 98.5 Q100 94.5 108 98.5' },
  sad:     { brow: 4,  lids: 0.25, blush: 0.15, pupil: 'dot',   teeth: false, mouth: 'M92 98 Q100 95 108 98' },
  kiss:    { brow: -1, lids: 0.6,  blush: 0.95, pupil: 'heart', teeth: false, mouth: 'M96 95 Q100 92.5 104 95 Q100 100 96 95 Z' },
};

export function heatLevel(c, tier) {
  if (tier >= 3 || (tier >= 2 && c.desire >= 70)) return 2;
  if (tier >= 2 || (tier >= 1 && c.desire >= 50)) return 1;
  return 0;
}

// flat color fields, always duller than the character so the sticker pops
function backdrop(uid, heat, accent) {
  const bokeh = (cols, o) => cols.map(([x, y, r], i) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o + (i % 3) * 0.03}" class="tw tw-${i % 3}"/>`).join('');
  const vignette = `
    <radialGradient id="vg-${uid}" cx="50%" cy="42%" r="75%">
      <stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.22"/>
    </radialGradient>
    <rect width="200" height="300" fill="url(#vg-${uid})"/>`;
  if (heat >= 2) {
    return `
      <rect width="200" height="300" fill="#26222f"/>
      <radialGradient id="gl-${uid}" cx="50%" cy="46%" r="55%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <rect width="200" height="300" fill="url(#gl-${uid})"/>
      <circle cx="162" cy="42" r="13" fill="#e8e0c8" opacity="0.9"/>
      <circle cx="157" cy="38" r="11" fill="#26222f" opacity="0.7"/>
      ${bokeh([[24, 40, 4], [58, 22, 2.5], [176, 84, 3.5], [16, 120, 2.5], [186, 160, 2]], 0.08)}
      ${vignette}`;
  }
  if (heat === 1) {
    return `
      <rect width="200" height="300" fill="#b96f4e"/>
      <circle cx="100" cy="86" r="32" fill="#e8b06a" opacity="0.9"/>
      ${bokeh([[30, 60, 5], [166, 46, 4], [186, 130, 3], [16, 170, 3.5], [172, 210, 2.5]], 0.1)}
      ${vignette}`;
  }
  return `
    <rect width="200" height="300" fill="#dcb892"/>
    <circle cx="100" cy="96" r="72" fill="#ecd0ac" opacity="0.8"/>
    ${bokeh([[26, 50, 5], [172, 38, 4], [184, 118, 3], [18, 150, 3.5], [176, 226, 3]], 0.14)}
    ${vignette}`;
}

// ---------- the parametric figure (thigh-up) ----------
const Y = { shoulder: 128, bust: 156, waist: 190, hip: 230, bot: 300 };

function figure(c, heat, m, uid) {
  const skin = SKIN_TONES[c.look.skin];
  const skinD = shade(skin, -26);
  const suit = SUIT_COLORS[c.look.suit];
  const suitB = SUIT_COLORS[c.look.suitB];
  const accent = ACCENTS[c.look.accent ?? 0];
  const fem = c.presentation === 'fem';
  const hs = m.pose === 'sway-l' ? -8 : m.pose === 'sway-r' ? 8 : 0;
  const shW = (fem ? 24 : 30) * m.sh;
  const waistW = (fem ? 15 : 20) * m.waist;
  const hipW = (fem ? 40 : 30) * m.hips; // hips own the silhouette
  const legW = hipW * 0.46;
  const L = x => 100 - x, R = x => 100 + x;

  // one smooth chunky silhouette: small torso, ballooned hips/thighs
  const bodyPath = [
    `M${L(shW)} ${Y.shoulder}`,
    `C${L(shW + 3)} ${Y.shoulder + 12} ${L(waistW + 8)} ${Y.waist - 22} ${L(waistW)} ${Y.waist}`,
    `C${L(waistW + 2)} ${Y.waist + 8} ${L(hipW * 0.7) + hs} ${Y.hip - 26} ${L(hipW) + hs} ${Y.hip - 6}`,
    `C${L(hipW + 3) + hs} ${Y.hip + 14} ${L(hipW * 0.9) + hs} ${Y.hip + 40} ${L(hipW * 0.72) + hs} ${Y.bot - 22}`,
    `C${L(hipW * 0.62) + hs} ${Y.bot - 8} ${L(legW + 4) + hs} ${Y.bot - 2} ${L(legW) + hs} ${Y.bot}`,
    `L${100 + hs - 3} ${Y.bot}`, `Q${100 + hs} ${Y.bot - 16} ${100 + hs + 3} ${Y.bot}`,
    `L${R(legW) + hs} ${Y.bot}`,
    `C${R(legW + 4) + hs} ${Y.bot - 2} ${R(hipW * 0.62) + hs} ${Y.bot - 8} ${R(hipW * 0.72) + hs} ${Y.bot - 22}`,
    `C${R(hipW * 0.9) + hs} ${Y.hip + 40} ${R(hipW + 3) + hs} ${Y.hip + 14} ${R(hipW) + hs} ${Y.hip - 6}`,
    `C${R(hipW * 0.7) + hs} ${Y.hip - 26} ${R(waistW + 2)} ${Y.waist + 8} ${R(waistW)} ${Y.waist}`,
    `C${R(waistW + 8)} ${Y.waist - 22} ${R(shW + 3)} ${Y.shoulder + 12} ${R(shW)} ${Y.shoulder}`,
    `Q100 ${Y.shoulder - 10} ${L(shW)} ${Y.shoulder} Z`,
  ].join(' ');

  // flat cel: dark base + light copy offset inside a clip = one hard shadow crescent
  const body = `
    <clipPath id="bc-${uid}"><path d="${bodyPath}"/></clipPath>
    <path d="${bodyPath}" fill="${skinD}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
    <g clip-path="url(#bc-${uid})"><path d="${bodyPath}" transform="translate(-6 -4)" fill="${skin}"/></g>
    <ellipse cx="${L(hipW * 0.55) + hs}" cy="${Y.hip + 10}" rx="7" ry="3.5" fill="#fff" opacity="0.55" transform="rotate(-18 ${L(hipW * 0.55) + hs} ${Y.hip + 10})"/>
    <ellipse cx="${L(shW * 0.4)}" cy="${Y.shoulder + 8}" rx="5" ry="2.5" fill="#fff" opacity="0.5" transform="rotate(-14 ${L(shW * 0.4)} ${Y.shoulder + 8})"/>
    <ellipse cx="${100 + hs * 0.6}" cy="${Y.waist + 14}" rx="2" ry="3" fill="${skinD}" opacity="0.6"/>
    <ellipse cx="${L(hipW * 0.3) + hs}" cy="${Y.hip + 42}" rx="6" ry="4" fill="url(#blg-${uid})" opacity="0.5"/>
    <ellipse cx="${R(hipW * 0.3) + hs}" cy="${Y.hip + 42}" rx="6" ry="4" fill="url(#blg-${uid})" opacity="0.5"/>`;

  const neck = `<path d="M92 104 L92 124 Q100 132 108 124 L108 104 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>`;

  // arms: long and smooth, tiny hands, accent nails. Sway side goes akimbo.
  const armW = 9;
  const hand = (x, y) => `
    <circle cx="${x}" cy="${y}" r="4.6" fill="${skin}" stroke="${OUT}" stroke-width="2.4"/>
    <g fill="${accent}"><circle cx="${x - 2.4}" cy="${y + 3.4}" r="0.9"/><circle cx="${x}" cy="${y + 4.4}" r="0.9"/><circle cx="${x + 2.4}" cy="${y + 3.4}" r="0.9"/></g>`;
  const limb = d => `
    <path d="${d}" stroke="${OUT}" stroke-width="${armW + 4.5}" stroke-linecap="round" fill="none"/>
    <path d="${d}" stroke="${skin}" stroke-width="${armW}" stroke-linecap="round" fill="none"/>`;
  const hang = s => {
    const x2 = 100 + s * (hipW * 0.92) + hs;
    return limb(`M${100 + s * (shW - 2)} ${Y.shoulder + 4} C${100 + s * (shW + 8)} 166 ${100 + s * (waistW + 18)} 200 ${x2} 236`) + hand(x2, 242);
  };
  const akimbo = s => {
    const xh = 100 + s * (hipW - 9) + hs;
    return limb(`M${100 + s * (shW - 2)} ${Y.shoulder + 4} C${100 + s * (shW + 22)} 158 ${100 + s * (hipW + 24) + hs} 194 ${xh} ${Y.hip - 8}`) + hand(xh, Y.hip - 6);
  };
  const arms = m.pose === 'sway-l' ? akimbo(-1) + hang(1)
    : m.pose === 'sway-r' ? hang(-1) + akimbo(1)
    : hang(-1) + hang(1);

  // chest
  const bustR = 8 + 8 * m.bust;
  const bo = (9 + 11 * m.bust) * 0.62;
  const bl = 100 - bo, br = 100 + bo;
  const chest = fem ? `
    <circle cx="${bl}" cy="${Y.bust}" r="${bustR}" fill="${skinD}" stroke="${OUT}" stroke-width="3"/>
    <circle cx="${br}" cy="${Y.bust}" r="${bustR}" fill="${skinD}" stroke="${OUT}" stroke-width="3"/>
    <circle cx="${bl - 1.5}" cy="${Y.bust - 1.5}" r="${bustR - 2.2}" fill="${skin}"/>
    <circle cx="${br - 1.5}" cy="${Y.bust - 1.5}" r="${bustR - 2.2}" fill="${skin}"/>
    ${heat >= 1 ? `<path d="M100 ${Y.bust - bustR * 0.7} C97.5 ${Y.bust - 2} 97.5 ${Y.bust} 100 ${Y.bust + bustR * 0.4}" stroke="${OUT}" stroke-width="2.2" fill="none" opacity="0.75"/>` : ''}
    <ellipse cx="${bl - bustR * 0.3}" cy="${Y.bust - bustR * 0.5}" rx="${bustR * 0.34}" ry="${bustR * 0.16}" fill="#fff" opacity="0.7" transform="rotate(-16 ${bl} ${Y.bust})"/>
    <ellipse cx="${br - bustR * 0.3}" cy="${Y.bust - bustR * 0.5}" rx="${bustR * 0.34}" ry="${bustR * 0.16}" fill="#fff" opacity="0.7" transform="rotate(-16 ${br} ${Y.bust})"/>` : `
    <path d="M${L(shW * 0.8)} ${Y.bust - 4} Q${100 - shW * 0.25} ${Y.bust + 10} 100 ${Y.bust + 3} Q${100 + shW * 0.25} ${Y.bust + 10} ${R(shW * 0.8)} ${Y.bust - 4}" stroke="${skinD}" stroke-width="2.6" fill="none" opacity="0.8"/>
    <path d="M100 ${Y.bust + 4} L100 ${Y.waist + 2}" stroke="${skinD}" stroke-width="2.2" opacity="0.6"/>
    ${heat >= 1 ? `<path d="M${100 - waistW * 0.55} ${Y.waist - 14} h${waistW * 1.1} M${100 - waistW * 0.45} ${Y.waist} h${waistW * 0.9}" stroke="${skinD}" stroke-width="1.8" opacity="0.55"/>` : ''}
    ${heat >= 2 ? `<path d="M${L(hipW * 0.7) + hs} ${Y.hip - 4} Q${100 + hs} ${Y.hip + 18} ${100 + hs} ${Y.hip + 26} M${R(hipW * 0.7) + hs} ${Y.hip - 4} Q${100 + hs} ${Y.hip + 18} ${100 + hs} ${Y.hip + 26}" stroke="${skinD}" stroke-width="2" fill="none" opacity="0.55"/>` : ''}`;

  // ---------- swimwear (suit color, accent-coordinated trims) ----------
  let wear = '';
  if (fem) {
    const cup = (cx, sc) => `<path d="M${cx - bustR * sc} ${Y.bust - 2} Q${cx} ${Y.bust - bustR * sc * 1.4} ${cx + bustR * sc} ${Y.bust - 2} Q${cx + bustR * sc * 0.7} ${Y.bust + bustR * sc} ${cx} ${Y.bust + bustR * sc * 1.05} Q${cx - bustR * sc * 0.7} ${Y.bust + bustR * sc} ${cx - bustR * sc} ${Y.bust - 2} Z" fill="${suit}" stroke="${OUT}" stroke-width="2.4"/>`;
    if (heat === 0) {
      wear = `
        <path d="M${bl - bustR} ${Y.bust - 10} Q100 ${Y.bust - bustR - 6} ${br + bustR} ${Y.bust - 10}
          C${R(waistW + 1)} ${Y.waist - 6} ${R(hipW * 0.94) + hs} ${Y.hip - 14} ${R(hipW * 0.58) + hs} ${Y.hip + 8}
          L${100 + hs + 10} ${Y.hip + 22} L${100 + hs - 10} ${Y.hip + 22}
          L${L(hipW * 0.58) + hs} ${Y.hip + 8} C${L(hipW * 0.94) + hs} ${Y.hip - 14} ${L(waistW + 1)} ${Y.waist - 6} ${bl - bustR} ${Y.bust - 10} Z"
          fill="${suit}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M${bl - bustR + 3} ${Y.bust - 8} Q100 ${Y.bust + 5} ${br + bustR - 3} ${Y.bust - 8}" stroke="${suitB}" stroke-width="4" fill="none"/>
        <g stroke="${suit}" stroke-width="4" fill="none"><path d="M${bl} ${Y.bust - 12} L95 114"/><path d="M${br} ${Y.bust - 12} L105 114"/></g>`;
    } else if (heat === 1) {
      wear = `${cup(bl, 0.95)}${cup(br, 0.95)}
        <g stroke="${suit}" stroke-width="3" fill="none">
          <path d="M${bl} ${Y.bust - bustR} L96 112"/><path d="M${br} ${Y.bust - bustR} L104 112"/>
          <path d="M${bl - bustR * 0.95} ${Y.bust + 2} Q100 ${Y.bust + bustR * 0.6} ${br + bustR * 0.95} ${Y.bust + 2}"/>
        </g>
        <path d="M${L(hipW - 2) + hs} ${Y.hip - 10} Q${100 + hs} ${Y.hip + 2} ${R(hipW - 2) + hs} ${Y.hip - 10} L${100 + hs + 5} ${Y.hip + 24} Q${100 + hs} ${Y.hip + 28} ${100 + hs - 5} ${Y.hip + 24} Z" fill="${suit}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M${L(hipW - 2) + hs} ${Y.hip - 10} Q${100 + hs} ${Y.hip + 1} ${R(hipW - 2) + hs} ${Y.hip - 10}" stroke="${suitB}" stroke-width="3" fill="none"/>`;
    } else {
      const bow = x => `<g stroke="${suit}" stroke-width="2" fill="none">
          <circle cx="${x}" cy="${Y.hip - 8}" r="3.2"/><path d="M${x} ${Y.hip - 8} l-5.5 6.5 M${x} ${Y.hip - 8} l5.5 6.5"/></g>`;
      wear = `${cup(bl, 0.58)}${cup(br, 0.58)}
        <g stroke="${suit}" stroke-width="1.8" fill="none">
          <path d="M${bl} ${Y.bust - bustR * 0.62} L97 112"/><path d="M${br} ${Y.bust - bustR * 0.62} L103 112"/>
          <path d="M${bl - bustR * 0.6} ${Y.bust + 3} Q100 ${Y.bust + 8} ${br + bustR * 0.6} ${Y.bust + 3}"/>
          <path d="M${L(hipW) + hs} ${Y.hip - 8} Q${100 + hs} ${Y.hip + 2} ${R(hipW) + hs} ${Y.hip - 8}"/>
        </g>
        <path d="M${100 + hs - 8} ${Y.hip} Q${100 + hs} ${Y.hip - 4} ${100 + hs + 8} ${Y.hip} L${100 + hs + 3} ${Y.hip + 22} Q${100 + hs} ${Y.hip + 25} ${100 + hs - 3} ${Y.hip + 22} Z" fill="${suit}" stroke="${OUT}" stroke-width="2.2"/>
        ${bow(L(hipW) + hs)}${bow(R(hipW) + hs)}`;
    }
  } else {
    const trunks = y => `
      <path d="M${L(hipW - 1) + hs} ${y} Q${100 + hs} ${y + 9} ${R(hipW - 1) + hs} ${y} L${R(legW + 3) + hs} ${Y.bot} L${L(legW + 3) + hs} ${Y.bot} Z" fill="${suit}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M${L(hipW - 1) + hs} ${y} Q${100 + hs} ${y + 9} ${R(hipW - 1) + hs} ${y}" stroke="${suitB}" stroke-width="3.5" fill="none"/>
      <path d="M${100 + hs - 5} ${y + 9} l3 7 M${100 + hs + 5} ${y + 9} l-3 7" stroke="${suitB}" stroke-width="2" fill="none"/>`;
    if (heat === 0) {
      wear = `
        <path d="M${L(shW - 1)} ${Y.shoulder + 2} C${L(waistW + 10)} ${Y.bust} ${L(waistW - 1)} ${Y.waist - 10} ${L(waistW - 1)} ${Y.waist + 6} L${R(waistW - 1)} ${Y.waist + 6} C${R(waistW - 1)} ${Y.waist - 10} ${R(waistW + 10)} ${Y.bust} ${R(shW - 1)} ${Y.shoulder + 2} Q100 ${Y.shoulder - 8} ${L(shW - 1)} ${Y.shoulder + 2} Z"
          fill="${suit}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M${L(shW - 5)} ${Y.shoulder + 7} Q100 ${Y.shoulder - 2} ${R(shW - 5)} ${Y.shoulder + 7} L${R(shW - 9)} ${Y.shoulder + 16} Q100 ${Y.shoulder + 8} ${L(shW - 9)} ${Y.shoulder + 16} Z" fill="${suitB}"/>
        ${trunks(Y.hip - 12)}`;
    } else if (heat === 1) {
      wear = `
        <path d="M${L(shW - 1)} ${Y.shoulder + 2} C${L(shW + 3)} 170 ${L(waistW + 9)} 200 ${L(waistW + 2)} ${Y.hip - 12} L${L(waistW - 7)} ${Y.hip - 12} C${L(waistW - 3)} 198 ${L(shW * 0.55)} 152 ${100 - 11} ${Y.shoulder - 5} Z" fill="${suit}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M${R(shW - 1)} ${Y.shoulder + 2} C${R(shW + 3)} 170 ${R(waistW + 9)} 200 ${R(waistW + 2)} ${Y.hip - 12} L${R(waistW - 7)} ${Y.hip - 12} C${R(waistW - 3)} 198 ${R(shW * 0.55)} 152 ${100 + 11} ${Y.shoulder - 5} Z" fill="${suit}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
        ${trunks(Y.hip - 8)}`;
    } else {
      wear = `
        <path d="M90 118 Q100 132 110 118" stroke="#e8d8b0" stroke-width="3" fill="none"/>
        <path d="M97 128 L100 136 L103 128 Z" fill="#fff8e7" stroke="${OUT}" stroke-width="1.4"/>
        ${trunks(Y.hip + 2)}`;
    }
  }

  return neck + body + chest + wear + arms;
}

// ---------- face ----------
function stickerEye(cx, side, accent, skin) {
  const s = side === 'l' ? -1 : 1;
  return `
    <g>
      <path d="M${cx - 9.5} 72 Q${cx} 63.5 ${cx + 9.5} 72 Q${cx} 80.5 ${cx - 9.5} 72 Z" fill="#fff" stroke="${OUT}" stroke-width="2.4"/>
      <circle cx="${cx}" cy="73" r="5.8" fill="${accent}" stroke="${shade(accent, -70)}" stroke-width="1.4"/>
      <circle class="p-pupil" cx="${cx}" cy="73" r="2.7" fill="#1c1c20"/>
      <path class="p-heartpupil" d="M${cx} 71 c-1.7 -2.6 -5.4 -1.4 -5.4 1.6 c0 2.6 5.4 5.8 5.4 5.8 s5.4 -3.2 5.4 -5.8 c0 -3 -3.7 -4.2 -5.4 -1.6 Z" fill="#ff2d6f" opacity="0"/>
      <circle cx="${cx - 2.2}" cy="70.6" r="1.9" fill="#fff"/>
      <circle cx="${cx + 2.6}" cy="75.4" r="1" fill="#fff" opacity="0.85"/>
      <path d="M${cx + s * 9} 71.5 L${cx + s * 16} 65.5 L${cx + s * 7.5} 67.5 Z" fill="${OUT}"/>
      <path d="M${cx - 9.5} 70.5 Q${cx} 64.5 ${cx + 9.5} 70.5" stroke="${OUT}" stroke-width="2.2" fill="none"/>
      <rect class="p-lid" x="${cx - 10}" y="62.5" width="20" height="0" rx="3" fill="${skin}"/>
      <g class="p-blinklids" fill="${skin}">
        <rect x="${cx - 10}" y="61" width="20" height="24" rx="8"/>
      </g>
    </g>`;
}

export function portraitSVG(c, uid, tier = 0) {
  const m = c.measurements || { bust: 1, waist: 0.8, hips: 1.1, sh: 1, pose: 'square', lips: 1, lashes: true, beautyMark: false };
  const skin = SKIN_TONES[c.look.skin];
  const skinD = shade(skin, -26);
  const accent = ACCENTS[c.look.accent ?? 0];
  const root = shade(HAIR_COLORS[c.look.hairColor], -46);
  const suitB = SUIT_COLORS[c.look.suitB];
  const heat = heatLevel(c, tier);
  const acc = c.look.accessory;

  const accessory =
    acc === 'flower' ? `<g><circle cx="132" cy="52" r="8" fill="#ff6b9d" stroke="${OUT}" stroke-width="2.2"/><circle cx="132" cy="52" r="3" fill="#ffd166"/></g>` :
    acc === 'shades' ? `<rect x="70" y="46" width="60" height="9" rx="4.5" fill="#222" stroke="${OUT}" stroke-width="2"/>` :
    acc === 'hoops'  ? `<g stroke="#ffd166" stroke-width="2.5" fill="none"><circle cx="64" cy="94" r="6"/><circle cx="136" cy="94" r="6"/></g>` :
    acc === 'choker' ? `<rect x="89" y="110" width="22" height="6" rx="3" fill="${suitB}" stroke="${OUT}" stroke-width="1.8"/>` :
    acc === 'cap'    ? `<path d="M64 50 C68 32 132 32 136 50 L146 54 L136 59 C126 44 74 44 64 59 Z" fill="${suitB}" stroke="${OUT}" stroke-width="2.4"/>` :
    acc === 'stud'   ? `<circle cx="64" cy="92" r="2.6" fill="#ffd166" stroke="${OUT}" stroke-width="1.4"/>` : '';

  const ahoge = AHOGE[c.look.hairStyle]
    ? `<path d="M100 40 C95 28 108 22 103 12 C112 20 106 32 104 40 Z" fill="${accent}" stroke="${OUT}" stroke-width="2"/>` : '';

  const e = EMOTIONS.neutral;
  const heart = (x, y, s, fill) =>
    `<path class="tw" d="M${x} ${y} c${-2.6 * s} ${-3.8 * s} ${-8 * s} ${-2.2 * s} ${-8 * s} ${2.4 * s} c0 ${3.8 * s} ${8 * s} ${8.6 * s} ${8 * s} ${8.6 * s} s${8 * s} ${-4.8 * s} ${8 * s} ${-8.6 * s} c0 ${-4.6 * s} ${-5.4 * s} ${-6.2 * s} ${-8 * s} ${-2.4 * s} Z" fill="${fill}" stroke="#fff" stroke-width="2.4"/>`;
  const sparkle = (x, y, r) =>
    `<path class="tw tw-1" d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z" fill="${accent}" stroke="#fff" stroke-width="1.2"/>`;
  const flourishes =
    (heat >= 1 ? heart(170, 128, 1, '#ff5d8f') + heart(28, 176, 0.8, accent) : '') +
    (heat >= 2 ? sparkle(32, 116, 7) + sparkle(174, 210, 5.5) : '');

  return `
  <svg class="portrait sticker heat-${heat}" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Portrait of ${c.name}">
    <defs>
      <clipPath id="clip-${uid}"><rect x="0" y="0" width="200" height="300" rx="18"/></clipPath>
      <filter id="stk-${uid}" x="-15%" y="-10%" width="130%" height="120%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="dl"/>
        <feFlood flood-color="#ffffff"/>
        <feComposite in2="dl" operator="in" result="ring"/>
        <feMerge><feMergeNode in="ring"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="hg-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${root}"/><stop offset="42%" stop-color="${root}"/><stop offset="100%" stop-color="${accent}"/>
      </linearGradient>
      <radialGradient id="blg-${uid}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff7096" stop-opacity="0.8"/><stop offset="100%" stop-color="#ff7096" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g clip-path="url(#clip-${uid})">
      ${backdrop(uid, heat, accent)}
      <g filter="url(#stk-${uid})">
        <g class="p-sway">
          <path d="${HAIR_BACK[c.look.hairStyle]}" fill="url(#hg-${uid})" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
        </g>
        <g class="p-breathe">
          ${figure(c, heat, m, uid)}
        </g>
        <g class="p-head">
          <circle cx="66" cy="78" r="6" fill="${skin}" stroke="${OUT}" stroke-width="2.4"/>
          <circle cx="134" cy="78" r="6" fill="${skin}" stroke="${OUT}" stroke-width="2.4"/>
          <path d="M67 64 C67 36 133 36 133 64 C133 88 121 102 100 108 C79 102 67 88 67 64 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>
          <path d="M121 86 C115 97 106 103 100 105.5 C111 103.5 121 95 125 82 Z" fill="${skinD}" opacity="0.55"/>
          <g class="p-brows" fill="${OUT}">
            <path d="M74 59 Q84 53.5 93 57.5 L93 61 Q84 58 75 62.5 Z"/>
            <path d="M107 57.5 Q116 53.5 126 59 L125 62.5 Q116 58 107 61 Z"/>
          </g>
          ${stickerEye(84, 'l', accent, skin)}
          ${stickerEye(116, 'r', accent, skin)}
          <path d="M100 82.5 L102.5 87" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round"/>
          <g class="p-blush" opacity="${e.blush}">
            <ellipse cx="76" cy="84" rx="8.5" ry="5" fill="url(#blg-${uid})"/>
            <ellipse cx="124" cy="84" rx="8.5" ry="5" fill="url(#blg-${uid})"/>
            <g stroke="#e0517c" stroke-width="1.5" stroke-linecap="round" opacity="0.8">
              <path d="M71 82 l5 4.5 M76 80.5 l5 4.5"/>
              <path d="M119 80.5 l5 4.5 M124 82 l5 4.5"/>
            </g>
          </g>
          <path class="p-mouth" d="${e.mouth}" stroke="${OUT}" stroke-width="${2.6 * m.lips}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="p-teeth" d="M90.5 94 Q100 98.5 109.5 94 L108.5 96.2 Q100 100 91.5 96.2 Z" fill="#fff" opacity="0"/>
          ${m.beautyMark ? `<circle cx="111.5" cy="90" r="1.4" fill="${shade(skin, -70)}"/>` : ''}
          <g class="p-sway">
            <path d="${HAIR_FRONT[c.look.hairStyle]}" fill="url(#hg-${uid})" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
            <ellipse cx="86" cy="46" rx="10" ry="3.6" fill="#fff" opacity="0.65" transform="rotate(-12 86 46)"/>
            ${ahoge}
            ${accessory}
          </g>
        </g>
      </g>
      ${flourishes}
    </g>
  </svg>`;
}

export function setEmotion(container, emotion) {
  const e = EMOTIONS[emotion] || EMOTIONS.neutral;
  const svg = container.querySelector('svg.portrait');
  if (!svg) return;
  const mouth = svg.querySelector('.p-mouth');
  const teeth = svg.querySelector('.p-teeth');
  const blush = svg.querySelector('.p-blush');
  const brows = svg.querySelector('.p-brows');
  if (mouth) {
    mouth.setAttribute('d', e.mouth);
    mouth.setAttribute('fill', e.mouth.includes('Z') ? '#7c3644' : 'none');
  }
  if (teeth) teeth.setAttribute('opacity', e.teeth ? '1' : '0');
  if (blush) blush.setAttribute('opacity', e.blush);
  if (brows) brows.style.transform = `translateY(${e.brow}px)`;
  svg.querySelectorAll('.p-lid').forEach(l => l.setAttribute('height', String(15 * e.lids)));
  svg.querySelectorAll('.p-pupil').forEach(p => p.setAttribute('opacity', e.pupil === 'heart' ? '0' : '1'));
  svg.querySelectorAll('.p-heartpupil').forEach(p => p.setAttribute('opacity', e.pupil === 'heart' ? '1' : '0'));
}

// Confidence over shyness: the emotive canon is smug/teasing/cheerful.
export function emotionFor(c, tier = 0) {
  if (c.partner) return 'sultry';
  if (c.mood <= -2) return 'annoyed';
  if (c.mood === -1) return 'sad';
  if (tier >= 2 && c.desire >= 70) return 'sultry';
  if (c.desire >= 60) return 'love';
  if (c.desire >= 40) return c.archetype === 'shy' ? 'shy' : 'teasing';
  if (c.affection >= 55) return 'happy';
  if (c.affection >= 30) return 'smug';
  return 'neutral';
}

// ---------- generative-image prompting ----------
// Plain-English colour/style names so the prompt reads well to any image model
// (Flux/SD via Pollinations, gpt-image, a local SD WebUI, …). Indices line up
// with the palettes exported from characters.js.
const HAIR_NAMES = ['black', 'dark brown', 'chestnut brown', 'auburn', 'honey blonde',
  'golden blonde', 'wine red', 'purple', 'teal blue', 'pink'];
const EYE_NAMES = ['warm brown', 'forest green', 'ocean blue', 'violet', 'hazel', 'cool grey'];
const HAIRSTYLE_WORDS = {
  waves: 'long wavy hair', ponytail: 'high ponytail', bob: 'chin-length bob',
  curls: 'long curly hair', bun: 'messy hair bun', short: 'short tousled hair',
  swoop: 'short hair with a swept fringe', buzz: 'buzz cut', curlsShort: 'short curly hair',
  manbun: 'top-knot man-bun',
};
const EXPR_WORDS = {
  neutral: 'calm confident expression', smug: 'smug little smile', teasing: 'playful teasing smirk',
  happy: 'bright warm smile', laugh: 'laughing, eyes closed', shy: 'shy blush, glancing away',
  love: 'loving gaze with sparkling eyes', sultry: 'seductive half-lidded bedroom eyes, faint blush',
  annoyed: 'unimpressed arched-brow frown', sad: 'soft downcast expression', kiss: 'coy pursed-lip look',
};

// Danbooru-flavoured body tags from the continuous measurement genes, so bustier
// / curvier characters actually read differently in the generated art.
function bodyTags(c) {
  const m = c.measurements || { bust: 1, waist: 0.85, hips: 1.1, sh: 1 };
  const t = [];
  if (c.presentation === 'fem') {
    t.push(m.bust >= 1.25 ? 'large breasts' : m.bust >= 0.85 ? 'medium breasts' : 'small breasts');
  } else {
    t.push(c.body === 'muscular' ? 'muscular pecs, defined abs'
      : c.body === 'athletic' ? 'lean toned chest' : 'natural build');
  }
  t.push(m.hips >= 1.2 ? 'wide hips, thick thighs' : m.hips >= 0.9 ? 'curvy hips' : 'slim hips');
  t.push(m.waist <= 0.8 ? 'slim waist' : 'soft waist');
  const bodyWord = { slim: 'slender figure', curvy: 'hourglass curvy figure',
    athletic: 'athletic figure', soft: 'soft plush figure', muscular: 'muscular figure' };
  t.push(bodyWord[c.body] || `${BODY_LABELS[c.body]} figure`);
  return t.join(', ');
}

// A deterministic seed so a given character keeps the same generated face across
// re-renders, but shifts as heat rises (new outfit/scene per tier).
export function portraitSeed(c, heat = 0) {
  let h = 2166136261;
  const s = String(c.id ?? c.name ?? 'bcb');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) + heat * 1000;
}

// Quality/safety guardrails handed to providers that accept a negative prompt.
export const NEGATIVE_PROMPT =
  'lowres, bad anatomy, bad hands, ' +
  'extra limbs, extra fingers, fused fingers, deformed, disfigured, watermark, signature, ' +
  'text, jpeg artifacts, ugly, blurry, child, underage, loli, shota';

// Session-dynamic scenery: the backdrop follows where the conversation is
// actually happening and the lighting follows the in-game clock, so the art
// tracks the play session rather than a fixed beach postcard.
const SCENE_BACKDROPS = {
  beach: 'a beautiful beach with turquoise water',
  pier: 'a wooden fishing pier over the ocean',
  smoothie: 'a colorful beachside smoothie hut',
  boardwalk: 'a lively boardwalk with a ferris wheel',
  gym: 'a bright beach gym',
  studio: 'an art studio full of canvases',
  tiki: 'a cozy tiki lounge with bamboo and cocktails',
  market: 'a glowing night market with paper lanterns',
  club: 'a neon-lit dance club',
  shop: 'a moody boutique with neon signage',
  clinic: 'a clean seaside clinic lobby',
  home: 'a cozy beach-house living room',
};
const PHASE_LIGHT = {
  dawn: 'soft pink dawn light',
  morning: 'bright morning sun',
  afternoon: 'clear blue afternoon light',
  evening: 'golden-hour sunset light, warm rim light',
  night: 'moonlit night, soft neon glow',
  late: 'deep night, dim neon glow',
};

// The prompt handed to window.BCB_PORTRAIT_PROVIDER (the built-in AI-Art
// providers, or one the player wires up themselves). Encodes an anime pin-up
// style plus every one of this character's genes, and — via ctx — the live
// session: their current emotion, the location, and the time of day. ctx is
// structured game state only (never raw chat text). Suggestive swimwear only —
// the tone ceiling applies to the art exactly as it does to the writing.
export function describeCharacter(c, tier = 0, ctx = {}) {
  const heat = heatLevel(c, tier);
  const accentName = ACCENT_NAMES[c.look.accent ?? 0];
  const hairBase = HAIR_NAMES[c.look.hairColor] ?? 'dark';
  const eyeName = EYE_NAMES[c.look.eyes] ?? accentName;
  const hairStyle = HAIRSTYLE_WORDS[c.look.hairStyle] || 'stylish hair';
  const expr = EXPR_WORDS[ctx.emotion] || EXPR_WORDS[emotionFor(c, tier)] || EXPR_WORDS.neutral;
  const gender = GENDER_LABELS[c.gender].toLowerCase();
  const outfit = c.presentation === 'fem'
    ? ['a sporty one-piece swimsuit', 'a cute two-piece bikini', 'a daring string bikini and sheer sarong'][heat]
    : ['a fitted rash guard and boardshorts', 'an open beach shirt and swim trunks', 'bare toned chest, shell necklace and low swim trunks'][heat]
    ;
  const accessory = { flower: 'a hibiscus flower in the hair', shades: 'stylish sunglasses',
    hoops: 'gold hoop earrings', choker: 'a black choker', cap: 'a snapback cap',
    stud: 'a small ear stud' }[c.look.accessory];
  // scene = where the session actually is + in-game time; heat-based fallback
  // keeps external callers with no ctx working exactly as before
  const backdrop = SCENE_BACKDROPS[ctx.locationId];
  const light = PHASE_LIGHT[ctx.phase];
  const scene = backdrop
    ? `${backdrop}, ${light || 'bright natural light'}`
    : ['a bright sunny beach with turquoise water',
       'a golden-hour sunset beach, warm rim light',
       'a moonlit beach at night, soft neon glow'][heat];
  return [
    'masterpiece, best quality, highly detailed anime illustration, ecchi pin-up art style,',
    'clean cel shading, vibrant saturated colors, soft rim lighting, cinematic,',
    `a beautiful adult ${gender}, early-to-mid 20s,`,
    `${bodyTags(c)},`,
    `${hairStyle}, two-tone ${hairBase} hair with vivid ${accentName} tips, large expressive ${eyeName} eyes,`,
    `${expr},`,
    accessory ? `wearing ${outfit}, ${accessory},` : `wearing ${outfit},`,
    `full-body pin-up pose, ${scene} in the background,`,
    'dynamic flattering composition, glossy skin highlights, suggestive but tasteful, swimwear only, safe-for-work',
  ].join(' ');
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
// Sunset dissolves to night, bonfire, the couple melts into a kiss, hearts
// rise, fireworks pop — sticker-outlined, fade to starlight.
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
      <filter id="fin-stk" x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="dl"/>
        <feFlood flood-color="#ffffff"/>
        <feComposite in2="dl" operator="in" result="ring"/>
        <feMerge><feMergeNode in="ring"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
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
    <!-- the couple leans into a kiss, sticker-outlined -->
    <g transform="translate(230 216)" filter="url(#fin-stk)">
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
        <path d="M15 -46 c-3 -5 -11 -3 -11 3 c0 5 11 11 11 11 s11 -6 11 -11 c0 -6 -8 -8 -11 -3 Z" fill="#ff5d8f" stroke="#fff" stroke-width="2"/>
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
