// src/render.js
// Procedural 2x (768x432) renderer for logical 384x216 world:
// tile materials, oblique 2.5D architecture, traps, items, articulated IK figures,
// Swiss railway station clock, HUD, title screen, and story cards.

import { drawBackdrop, drawTitleBackdrop } from './backdrops.js';
import {
  VIEW_W, VIEW_H, PLAY_H, HUD_H, COLS, ROWS, TILE_W, TILE_H, FLOOR_THICK,
  floorY, tileCenterX,
} from './level.js';
import { TITLE_TEXT, LEVEL_INTROS, DEATH_SUBLINES } from './story.js';
import { drawCharacter } from './character.js';

export const RENDER_SCALE = 2;
export { drawCharacter };

// ---------------------------------------------------------------------------
// Per-level architectural palettes (10 Swiss locations harmonized with backdrops.js)
// ---------------------------------------------------------------------------

const LEVEL_THEMES = [
  // 0: Paradeplatz Vaults, Zurich (emerald marble + warm brass)
  {
    material: 'marble',
    wallFill: '#17261f',
    wallDark: '#0d1712',
    wallHi: '#2a4236',
    wallTrim: '#7a602c',
    floorTop: '#56685d',
    floorFace: '#27352d',
    floorDark: '#121a16',
    floorTrim: '#8b6f34',
    gateBar: '#8f7741',
    gateHi: '#c8ac64',
    exitFrame: '#9c7c38',
    exitInner: '#09120e',
    spikeCol: '#b7c2bc',
    slicerCol: '#c9a64c',
  },
  // 1: Olten SBB Gleis 0, Solothurn (brushed transit concrete + SBB cobalt + sodium ochre)
  {
    material: 'concrete_sbb',
    wallFill: '#2d3338',
    wallDark: '#171b1f',
    wallHi: '#454e56',
    wallTrim: '#1e467a',
    floorTop: '#6c757d',
    floorFace: '#394047',
    floorDark: '#181c20',
    floorTrim: '#d49a38',
    gateBar: '#5c6670',
    gateHi: '#9ca8b5',
    exitFrame: '#1e467a',
    exitInner: '#0b1118',
    spikeCol: '#c8d0d8',
    slicerCol: '#c9242b',
  },
  // 2: Gotthard Reduit Fortress, Uri/Ticino (blast concrete + hazard ochre)
  {
    material: 'bunker',
    wallFill: '#292e2c',
    wallDark: '#161a19',
    wallHi: '#3d4542',
    wallTrim: '#7b6324',
    floorTop: '#646c68',
    floorFace: '#363c3a',
    floorDark: '#191d1c',
    floorTrim: '#8c6f27',
    gateBar: '#5c6662',
    gateHi: '#8a9690',
    exitFrame: '#7c857e',
    exitInner: '#0d100f',
    spikeCol: '#c6ccc8',
    slicerCol: '#d49a38',
  },
  // 3: Grande Dixence Dam Galleries, Valais (brutalist concrete + hydro-teal)
  {
    material: 'dam',
    wallFill: '#2b333a',
    wallDark: '#161c21',
    wallHi: '#424e59',
    wallTrim: '#1a4d5c',
    floorTop: '#6c7a86',
    floorFace: '#35414c',
    floorDark: '#172028',
    floorTrim: '#3fa7b8',
    gateBar: '#4c6573',
    gateHi: '#7db5c7',
    exitFrame: '#3fa7b8',
    exitInner: '#091820',
    spikeCol: '#bdd4de',
    slicerCol: '#3fa7b8',
  },
  // 4: Chateau de Chillon Viaduct Vaults, Vaud (Savoyard limestone + turquoise hydro)
  {
    material: 'limestone',
    wallFill: '#383129',
    wallDark: '#1f1b16',
    wallHi: '#544a3e',
    wallTrim: '#265359',
    floorTop: '#7d7060',
    floorFace: '#463e34',
    floorDark: '#201c17',
    floorTrim: '#48939c',
    gateBar: '#527073',
    gateHi: '#8cbac0',
    exitFrame: '#8c785c',
    exitInner: '#12100d',
    spikeCol: '#cfc6b8',
    slicerCol: '#48b8c4',
  },
  // 5: CERN Ring Sector 4, Geneva (cryo-steel + cyan/magenta photonics)
  {
    material: 'cryosteel',
    wallFill: '#182742',
    wallDark: '#0d1628',
    wallHi: '#2a4470',
    wallTrim: '#3498c8',
    floorTop: '#4e6f99',
    floorFace: '#213659',
    floorDark: '#0e192d',
    floorTrim: '#40c4e8',
    gateBar: '#507aa8',
    gateHi: '#8ad4f5',
    exitFrame: '#45a8d4',
    exitInner: '#071020',
    spikeCol: '#b2e4f8',
    slicerCol: '#ff427a',
  },
  // 6: Bundeshaus Sub-Archives & Federal Mint, Bern (Bernese green-gold sandstone + brass)
  {
    material: 'sandstone',
    wallFill: '#2d3326',
    wallDark: '#181c14',
    wallHi: '#464f3b',
    wallTrim: '#a68642',
    floorTop: '#6e755c',
    floorFace: '#3d4232',
    floorDark: '#1c1f16',
    floorTrim: '#a68642',
    gateBar: '#7d6938',
    gateHi: '#c4a85c',
    exitFrame: '#a68642',
    exitInner: '#10140d',
    spikeCol: '#cfd4c4',
    slicerCol: '#c49b40',
  },
  // 7: Eigerwand North-Face Gallery, Jungfraubahn (black slate + frost brass)
  {
    material: 'slate',
    wallFill: '#1b1f29',
    wallDark: '#0f1218',
    wallHi: '#31384a',
    wallTrim: '#8a7a52',
    floorTop: '#4e5668',
    floorFace: '#282d3a',
    floorDark: '#13161e',
    floorTrim: '#a8b8d0',
    gateBar: '#566075',
    gateHi: '#99a8c4',
    exitFrame: '#9c8346',
    exitInner: '#0a0e16',
    spikeCol: '#d6e2f2',
    slicerCol: '#6cb8e8',
  },
  // 8: Jungfraujoch Ice Palace, Aletsch Glacier (glacial cyan ice + frost white)
  {
    material: 'ice',
    wallFill: '#264b6e',
    wallDark: '#132a42',
    wallHi: '#5a94c2',
    wallTrim: '#9fd8f5',
    floorTop: '#9be0ff',
    floorFace: '#4888b8',
    floorDark: '#1e4263',
    floorTrim: '#d8f4ff',
    gateBar: '#7eb7db',
    gateHi: '#d4f2ff',
    exitFrame: '#8ecae8',
    exitInner: '#0e2236',
    spikeCol: '#dff7ff',
    slicerCol: '#7ce8ff',
  },
  // 9: Sphinx Observatory Summit, 3,571m (alpine slate + summit brass + beacon red)
  {
    material: 'summit',
    wallFill: '#232833',
    wallDark: '#13161e',
    wallHi: '#3c4557',
    wallTrim: '#b38c46',
    floorTop: '#6b7485',
    floorFace: '#323947',
    floorDark: '#171b24',
    floorTrim: '#c79e52',
    gateBar: '#8591a6',
    gateHi: '#c6d1e3',
    exitFrame: '#c79e52',
    exitInner: '#0e1422',
    spikeCol: '#d0d8e6',
    slicerCol: '#ff5268',
  },
];

// ---------------------------------------------------------------------------
// Oblique (Cabinet-Style) 2.5D Projection Constants & Palette Shading Helpers
// ---------------------------------------------------------------------------
// Front plane is z = 0; back wall is z = 1, receding +ISO_DX right and ISO_DY up.
// Light comes consistently from top-right-front so exposed 9px right side faces
// read clearly as sculpted 3D masonry against dark backdrops:
//   TOP faces = lightest, RIGHT SIDE faces = lit (with gradient into back-wall AO),
//   FRONT faces = mid masonry, CEILING SOFFITS & LEFT INNER REVEALS = deep shadow.

const ISO_DX = 9;
const ISO_DY = -8;
const SLAB_FRONT_OFF = 2; // Front-top lip sits at floorY + 2 so character feet sit on the top face
const SLAB_FRONT_H = 4;   // Front face height = 4px -> slab bottom sits cleanly at (row + 1) * TILE_H
const WALL_REVEAL_L = 6;  // Shadowed left inner reveal thickness on right-side walls/openings
const WALL_SOFFIT_H = 6;  // Shadowed ceiling underside soffit thickness on overhanging walls

function parseHex(hex) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r, g, b) {
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + ((1 << 24) + (cl(r) << 16) + (cl(g) << 8) + cl(b)).toString(16).slice(1);
}

function mixHex(a, b, t) {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function hexRgba(hex, alpha) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Derive harmonized 3D shading tones for each of the 10 level themes
const ISO_THEMES = LEVEL_THEMES.map((t) => ({
  ...t,
  // Wall top faces match the floor slab top-face look so walkable wall tops join seamlessly
  wallTop: mixHex(t.floorTop, t.wallHi, 0.20),
  wallTopBack: mixHex(t.floorTop, t.floorDark, 0.42),
  // Lit right side face (brighter at front arris, darkening smoothly toward back-wall AO)
  wallSideLit: mixHex(t.wallHi, t.floorTop, 0.34),
  wallSideMid: mixHex(t.wallFill, t.wallHi, 0.32),
  wallSideBack: mixHex(t.wallDark, t.wallFill, 0.35),
  // Shadowed inner reveals (left-facing room walls & ceiling undersides)
  wallRevealFront: mixHex(t.wallFill, t.wallDark, 0.48),
  wallRevealBack: mixHex(t.wallDark, '#030508', 0.45),
  wallSoffitFront: mixHex(t.wallFill, t.wallDark, 0.62),
  wallSoffitBack: mixHex(t.wallDark, '#020406', 0.62),
  wallArrisHi: mixHex(t.wallHi, '#ffffff', 0.24),
  wallSide: mixHex(t.wallHi, t.wallFill, 0.42),
  floorTopHi: mixHex(t.floorTop, '#ffffff', 0.16),
  floorTopBack: mixHex(t.floorTop, t.floorDark, 0.42),
  floorSide: mixHex(t.floorTop, t.floorFace, 0.48),
  floorSideBack: mixHex(t.floorFace, t.floorDark, 0.55),
  floorEdgeBevel: mixHex(t.floorTop, '#ffffff', 0.30),
  recessDark: mixHex(t.wallDark, '#020406', 0.55),
  pilasterFill: hexRgba(t.wallDark, 0.48),
  pilasterHi: hexRgba(t.wallFill, 0.32),
  backTint: hexRgba(t.wallDark, 0.22),
}));

// Offscreen static room geometry cache (keyed by "levelId:roomId")
const MAX_ROOM_CACHE = 64;
const roomStaticCache = new Map();

function createOffscreen(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(w, h);
      const cctx = c.getContext('2d');
      if (cctx) return { canvas: c, ctx: cctx };
    } catch (_) {
      // Fall through to DOM canvas
    }
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cctx = c.getContext('2d');
    if (cctx) return { canvas: c, ctx: cctx };
  }
  return null;
}

function fillQuad(ctx, x1, y1, x2, y2, x3, y3, x4, y4, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

function drawIsoLine(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Character rendering has been moved to src/character.js (re-exported above).

// ---------------------------------------------------------------------------
// SBB Swiss Railway Station Clock (Mondaine iconic style)
// ---------------------------------------------------------------------------

export function drawSwissClock(ctx, cx, cy, r, timeRemainingSec) {
  // Elapsed since 23:00 (0..3600s)
  const elapsed = Math.max(0, Math.min(3600, 3600 - timeRemainingSec));
  const mins = elapsed / 60; // 0..60
  const secs = elapsed % 60;

  ctx.save();
  // Outer brushed metal casing + subtle bezel specular
  ctx.fillStyle = '#1b1f26';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#363c47';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Crisp white dial
  ctx.fillStyle = '#f5f4ef';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 0.45;
  ctx.stroke();

  // Hour ticks (crisp 2x Mondaine batons)
  ctx.strokeStyle = '#15171a';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const major = i % 3 === 0;
    const inner = r * (major ? 0.66 : 0.78);
    ctx.lineWidth = major ? Math.max(0.85, r * 0.1) : Math.max(0.55, r * 0.055);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * (r * 0.92), cy + Math.sin(a) * (r * 0.92));
    ctx.stroke();
  }

  // Hour hand (from 11:00 -> 12:00)
  const hourAngle = ((11 + mins / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#141619';
  ctx.lineWidth = Math.max(1.05, r * 0.135);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(hourAngle) * r * 0.16, cy - Math.sin(hourAngle) * r * 0.16);
  ctx.lineTo(cx + Math.cos(hourAngle) * r * 0.56, cy + Math.sin(hourAngle) * r * 0.56);
  ctx.stroke();

  // Minute hand (0 -> 60 -> 12:00)
  const minAngle = (mins / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.lineWidth = Math.max(0.85, r * 0.095);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(minAngle) * r * 0.19, cy - Math.sin(minAngle) * r * 0.19);
  ctx.lineTo(cx + Math.cos(minAngle) * r * 0.81, cy + Math.sin(minAngle) * r * 0.81);
  ctx.stroke();

  // Iconic SBB red lollipop second hand: authentic 58.5s sweep + 1.5s pause at 12 o'clock!
  const sbbSec = Math.min(60, (secs / 58.5) * 60);
  const secAngle = (sbbSec / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#d92626';
  ctx.lineWidth = Math.max(0.55, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(secAngle) * r * 0.24, cy - Math.sin(secAngle) * r * 0.24);
  ctx.lineTo(cx + Math.cos(secAngle) * r * 0.68, cy + Math.sin(secAngle) * r * 0.68);
  ctx.stroke();

  ctx.fillStyle = '#d92626';
  ctx.beginPath();
  ctx.arc(cx + Math.cos(secAngle) * r * 0.66, cy + Math.sin(secAngle) * r * 0.66, Math.max(1.0, r * 0.115), 0, Math.PI * 2);
  ctx.fill();
  // Center pin
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.65, r * 0.06), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Oblique 2.5D Static Room Cache & Procedural Architectural Geometry
// ---------------------------------------------------------------------------

function isStaticWalkable(ch) {
  return ch !== '.' && ch !== '#' && ch !== 'L';
}

function getIsoTheme(levelId) {
  return ISO_THEMES[((levelId % ISO_THEMES.length) + ISO_THEMES.length) % ISO_THEMES.length];
}

function getWallGeom(level, room, c, r) {
  const leftWall = level.getTile(room.id, c - 1, r) === '#';
  const rightWall = level.getTile(room.id, c + 1, r) === '#';
  const upWall = level.getTile(room.id, c, r - 1) === '#';
  const downWall = (r === ROWS - 1 && room.links.down === null)
    ? true
    : level.getTile(room.id, c, r + 1) === '#';
  const isPillar = !leftWall && !rightWall;
  // Right-side walls & right edges of openings show a shadowed 6px left inner reveal
  // (convex standalone pillars keep a single consistent 9px right side face)
  const hasLeftReveal = !leftWall && rightWall && c >= 0;
  const hasRightSide = !rightWall;
  const hasSoffit = !downWall;
  const hasTopFace = !upWall;
  // Row 0 ceiling band gets a deep 6px soffit; lower-row overhangs use 4px (= SLAB_FRONT_H)
  // so their cornice aligns flush to the exact pixel with adjacent floor slab fronts!
  const soffitH = hasSoffit ? (r === 0 ? WALL_SOFFIT_H : SLAB_FRONT_H) : 0;
  // Top-right inner corner block directly above a right wall with a 6px left inner reveal
  const notchBL = leftWall && downWall && c >= 0 && r < ROWS - 1 &&
    level.getTile(room.id, c - 1, r + 1) !== '#' &&
    level.getTile(room.id, c, r + 1) === '#' &&
    level.getTile(room.id, c + 1, r + 1) === '#';
  const notchBLH = notchBL ? (r === 0 ? WALL_SOFFIT_H : SLAB_FRONT_H) : 0;
  return {
    leftWall, rightWall, upWall, downWall, isPillar,
    hasLeftReveal, hasRightSide, hasSoffit, hasTopFace, soffitH, notchBL, notchBLH,
  };
}

function tileHasLeftReveal(level, room, c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  if (level.getTile(room.id, c, r) !== '#') return false;
  return getWallGeom(level, room, c, r).hasLeftReveal;
}

function drawWallMaterialDetail(ctx, fx, topY, fw, fh, theme, c, r) {
  const mat = theme.material;
  const seed = ((c * 31 + r * 17) & 15);
  if (mat === 'marble') {
    // Organic subtle emerald marble veining (broken asymmetric mineral veins)
    ctx.strokeStyle = 'rgba(185, 235, 210, 0.055)';
    ctx.lineWidth = 0.5;
    if ((seed & 3) !== 0) {
      const vx0 = fx + 3 + (seed % 9);
      const vy0 = topY + 2 + ((seed * 3) % 5);
      ctx.beginPath();
      ctx.moveTo(vx0, vy0);
      ctx.lineTo(Math.min(fx + fw - 3, vx0 + 5), Math.min(topY + fh - 3, vy0 + 4));
      ctx.lineTo(Math.min(fx + fw - 2, vx0 + 9), Math.min(topY + fh - 2, vy0 + 10));
      ctx.stroke();
    }
    if (fh > 22 && (seed & 1) === 0) {
      const vx1 = fx + fw - 3 - ((seed * 5) % 8);
      ctx.beginPath();
      ctx.moveTo(vx1, topY + 18);
      ctx.lineTo(Math.max(fx + 3, vx1 - 4), topY + 23);
      ctx.lineTo(Math.max(fx + 2, vx1 - 10), Math.min(topY + fh - 2, topY + 28));
      ctx.stroke();
    }
  } else if (mat === 'concrete_sbb' || mat === 'bunker') {
    // Board-formed shuttering micro-lines + recessed corner form-tie bolts
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 5; y < fh - 3; y += 6) {
      ctx.fillRect(fx + 1, topY + y, fw - 2, 0.5);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    if (fh > 12) {
      ctx.fillRect(fx + 3, topY + 4, 1, 1);
      ctx.fillRect(fx + fw - 4, topY + 4, 1, 1);
    }
    if (fh > 28) {
      ctx.fillRect(fx + 3, topY + 20, 1, 1);
      ctx.fillRect(fx + fw - 4, topY + 20, 1, 1);
    }
  } else if (mat === 'dam') {
    // Brutalist cyclopean formwork seams + damp seepage streaks
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(fx + 6 + (seed % 5), topY + 1, 0.5, fh - 2);
    if (seed % 3 === 0) {
      const dg = ctx.createLinearGradient(0, topY + 15, 0, topY + Math.min(fh, 36));
      dg.addColorStop(0, 'rgba(24, 90, 108, 0.22)');
      dg.addColorStop(1, 'rgba(24, 90, 108, 0)');
      ctx.fillStyle = dg;
      ctx.fillRect(fx + 8 + (seed % 10), topY + 15, 2.5, Math.min(fh - 15, 20));
    }
  } else if (mat === 'limestone' || mat === 'sandstone') {
    // Dressed stone micro-speckling & warm chiseled ashlar facets
    ctx.fillStyle = 'rgba(255, 242, 210, 0.06)';
    ctx.fillRect(fx + 2 + (seed % 11), topY + 3, 6, 1);
    if (fh > 20) ctx.fillRect(fx + 4 + ((seed * 3) % 12), topY + 19, 7, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(fx + 5 + ((seed * 5) % 14), topY + 9, 1.5, 1);
    if (fh > 28) ctx.fillRect(fx + 3 + ((seed * 7) % 16), topY + 25, 1.5, 1);
  } else if (mat === 'cryosteel') {
    // Machined cryo-steel bevelled panels + hex bolts
    ctx.strokeStyle = 'rgba(130, 210, 255, 0.14)';
    ctx.lineWidth = 0.5;
    if (fw > 10 && fh > 14) {
      ctx.strokeRect(fx + 2.25, topY + 2.25, fw - 4.5, Math.min(11, fh - 4.5));
    }
    if (fw > 10 && fh > 30) {
      ctx.strokeRect(fx + 2.25, topY + 17.25, fw - 4.5, Math.min(12, fh - 19.5));
    }
    ctx.fillStyle = 'rgba(130, 210, 255, 0.35)';
    ctx.fillRect(fx + 3.5, topY + 3.5, 0.8, 0.8);
    ctx.fillRect(fx + fw - 4.3, topY + 3.5, 0.8, 0.8);
  } else if (mat === 'slate' || mat === 'summit') {
    // Hewn alpine slate strata & crisp frost rime flecks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(fx + 2, topY + 7 + (seed % 4));
    ctx.lineTo(fx + fw - 3, topY + 5 + (seed % 4));
    if (fh > 24) {
      ctx.moveTo(fx + 3, topY + 23 + (seed % 4));
      ctx.lineTo(fx + fw - 2, topY + 21 + (seed % 4));
    }
    ctx.stroke();
    if (mat === 'summit' && fh > 12) {
      ctx.fillStyle = hexRgba(theme.wallTrim, 0.38);
      ctx.fillRect(fx + 3, topY + 4, 1, 1);
      ctx.fillRect(fx + fw - 4, topY + 4, 1, 1);
    }
  } else if (mat === 'ice') {
    // Translucent glacial crystal refraction facets & frost speculars!
    ctx.fillStyle = 'rgba(215, 248, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(fx + 2 + (seed % 6), topY + 2);
    ctx.lineTo(fx + Math.min(fw - 2, 13 + (seed % 6)), topY + 2);
    ctx.lineTo(fx + Math.min(fw - 2, 7 + (seed % 6)), topY + Math.min(fh - 2, 14));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(235, 252, 255, 0.26)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(fx + fw - 4, topY + 4);
    ctx.lineTo(fx + Math.max(2, fw - 12), topY + Math.min(fh - 2, 18));
    ctx.stroke();
  }
}

function drawWallFrontFace(ctx, x, topY, theme, geom, c, r) {
  const { leftWall, rightWall, upWall, downWall, isPillar, hasLeftReveal, hasSoffit, soffitH, notchBL, notchBLH } = geom;
  const fx = x + (hasLeftReveal ? WALL_REVEAL_L : 0);
  const fw = TILE_W - (hasLeftReveal ? WALL_REVEAL_L : 0);
  const fh = TILE_H - soffitH;

  if (notchBL) {
    // Clip out the 6x(notchBLH) bottom-left inner corner so ceiling soffit & right reveal miter cleanly!
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fx, topY);
    ctx.lineTo(fx + fw, topY);
    ctx.lineTo(fx + fw, topY + fh);
    ctx.lineTo(fx + WALL_REVEAL_L, topY + fh);
    ctx.lineTo(fx + WALL_REVEAL_L, topY + fh - notchBLH);
    ctx.lineTo(fx, topY + fh - notchBLH);
    ctx.closePath();
    ctx.clip();
  }

  if (isPillar) {
    // Architectural 3D column/pillar (capital, fluted shaft, plinth base)
    const padL = 2;
    const padR = 2;
    const px = fx + padL;
    const pw = fw - padL - padR;

    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(fx, topY, fw, fh);

    ctx.fillStyle = theme.wallFill;
    ctx.fillRect(px, topY, pw, fh);
    // Shaded left edge, lit right arris (consistent with top-right-front light)
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(px, topY, 2, fh);
    ctx.fillStyle = theme.wallHi;
    ctx.fillRect(px + pw - 3, topY, 3, fh);
    ctx.fillStyle = theme.wallArrisHi;
    ctx.fillRect(px + pw - 0.5, topY, 0.5, fh);
    // Central fluted grooves
    const flTop = topY + (upWall ? 0 : 7);
    const flH = Math.max(4, fh - (upWall ? 0 : 7) - (downWall ? 0 : 7));
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(px + 6, flTop, 2, flH);
    ctx.fillRect(px + 13, flTop, 2, flH);
    ctx.fillRect(px + 20, flTop, 2, flH);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(px + 8, flTop, 0.5, flH);
    ctx.fillRect(px + 15, flTop, 0.5, flH);
    ctx.fillRect(px + 22, flTop, 0.5, flH);

    // Capital crown when exposed at top
    if (!upWall) {
      ctx.fillStyle = theme.wallHi;
      ctx.fillRect(fx, topY, fw, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(fx, topY, fw, 0.5);
      ctx.fillStyle = theme.wallTrim;
      ctx.fillRect(fx + 1, topY + 3, fw - 2, 2);
      ctx.fillStyle = theme.wallDark;
      ctx.fillRect(fx + 1, topY + 5, fw - 2, 2);
    }
    // Plinth / soffit cornice when exposed at bottom
    if (!downWall) {
      ctx.fillStyle = theme.wallTrim;
      ctx.fillRect(fx + 1, topY + fh - 5, fw - 2, 2);
      ctx.fillStyle = theme.wallHi;
      ctx.fillRect(fx, topY + fh - 3, fw, 1);
      ctx.fillStyle = theme.wallDark;
      ctx.fillRect(fx, topY + fh - 2, fw, 2);
    }
    if (notchBL) ctx.restore();
    return;
  }

  // Solid masonry/concrete wall block front face
  ctx.fillStyle = theme.wallFill;
  ctx.fillRect(fx, topY, fw, fh);

  // Subtle vertical shading gradient across the face
  const g = ctx.createLinearGradient(fx, topY, fx, topY + fh);
  g.addColorStop(0, 'rgba(255,255,255,0.06)');
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.20)');
  ctx.fillStyle = g;
  ctx.fillRect(fx, topY, fw, fh);

  // Per-level 2x material surface grain / veining / panels
  drawWallMaterialDetail(ctx, fx, topY, fw, fh, theme, c, r);

  // Crisp 2x coursed ashlar / panel horizontal & vertical joints
  for (const cy of [15, 31]) {
    if (cy < fh - 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(fx, topY + cy, fw, 0.75);
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(fx, topY + cy + 0.75, fw, 0.5);
    }
  }
  const j1 = 10 + ((c * 7 + r * 5) & 7);
  const j2 = 4 + ((c * 11 + r * 3) & 7);
  const j3 = 18 + ((c * 5 + r * 9) & 7);
  const drawVertJoint = (jx, y0, h) => {
    if (jx <= fx + 1 || jx >= fx + fw - 1 || h <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.fillRect(jx, y0, 0.75, h);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(jx + 0.75, y0, 0.5, h);
  };
  drawVertJoint(x + j1, topY + (upWall ? 0 : 2), Math.min(15, fh) - (upWall ? 0 : 2));
  if (fh > 16) drawVertJoint(x + j2, topY + 16, Math.min(15, fh - 16));
  if (fh > 32) drawVertJoint(x + j3, topY + 32, Math.max(0, fh - 32));

  // Crisp 2x 3D edge bevels ONLY on exposed outer edges (no double seams between adjacent walls!)
  if (!upWall) {
    ctx.fillStyle = theme.wallHi;
    ctx.fillRect(fx, topY, fw, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(fx, topY, fw, 0.5);
  }
  if (!rightWall) {
    // Crisp lit vertical front arris where front face turns onto the 9px lit right side face
    ctx.fillStyle = theme.wallHi;
    ctx.fillRect(fx + fw - 1.5, topY, 1.5, fh);
    ctx.fillStyle = theme.wallArrisHi;
    ctx.fillRect(fx + fw - 0.5, topY, 0.5, fh);
  }
  if (!leftWall) {
    // Crisp corner crease where front face turns into the shadowed left inner reveal
    ctx.fillStyle = theme.wallHi;
    ctx.fillRect(fx, topY, 0.75, fh);
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.fillRect(fx + 0.75, topY, 0.75, fh);
  }
  if (hasSoffit) {
    // Architectural lower cornice rim where front face turns under into the ceiling soffit
    ctx.fillStyle = hexRgba(theme.wallTrim, 0.65);
    ctx.fillRect(fx, topY + fh - 2.5, fw, 0.75);
    ctx.fillStyle = theme.wallHi;
    ctx.fillRect(fx, topY + fh - 1.75, fw, 0.75);
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(fx, topY + fh - 1, fw, 1);
  }
  if (notchBL) {
    // Continue the ceiling cornice cleanly into the top-right miter corner
    ctx.fillStyle = hexRgba(theme.wallTrim, 0.65);
    ctx.fillRect(fx, topY + fh - notchBLH - 2.5, WALL_REVEAL_L + 1, 0.75);
    ctx.fillStyle = theme.wallHi;
    ctx.fillRect(fx, topY + fh - notchBLH - 1.75, WALL_REVEAL_L + 1, 0.75);
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(fx, topY + fh - notchBLH - 1, WALL_REVEAL_L, 1);
    ctx.restore();
  }
}

function drawWallBlock(ctx, level, room, c, r, theme) {
  const x = c * TILE_W;
  const topY = r * TILE_H;
  const botY = topY + TILE_H;
  const W = TILE_W;

  const geom = getWallGeom(level, room, c, r);
  const { leftWall, rightWall, upWall, downWall, isPillar, hasLeftReveal, hasRightSide, hasSoffit, hasTopFace, soffitH, notchBL, notchBLH } = geom;

  const fx0 = x + (hasLeftReveal ? WALL_REVEAL_L : 0);
  const fx1 = x + W;
  const fy1 = botY - soffitH;

  // Check if ceiling overhang sits diagonally above-right or above-left for exact room-box corner miters
  const ceilAboveRight = upWall && hasRightSide &&
    level.getTile(room.id, c + 1, r - 1) === '#' &&
    level.getTile(room.id, c + 1, r) !== '#';
  const ceilAboveLeft = upWall && hasLeftReveal &&
    level.getTile(room.id, c - 1, r - 1) === '#' &&
    level.getTile(room.id, c - 1, r) !== '#';
  const aboveSoffitH = (r - 1 === 0) ? WALL_SOFFIT_H : SLAB_FRONT_H;
  const leftTileCh = level.getTile(room.id, c - 1, r);
  const rightTileCh = level.getTile(room.id, c + 1, r);

  // 1. Lit TOP face (visible whenever tile above is not a solid wall — matches floor slab top-face look!)
  if (hasTopFace) {
    const tg = ctx.createLinearGradient(x, topY + ISO_DY, x, topY);
    tg.addColorStop(0, theme.wallTopBack);
    tg.addColorStop(0.7, theme.wallTop);
    tg.addColorStop(1, theme.floorTopHi);
    const lxBack = hasLeftReveal ? x : x + ISO_DX;
    const rxBack = rightWall ? x + W : x + W + ISO_DX;
    fillQuad(ctx, fx0, topY, lxBack, topY + ISO_DY, rxBack, topY + ISO_DY, fx1, topY, tg);
    fillQuad(ctx, lxBack, topY + ISO_DY + 2, lxBack, topY + ISO_DY, rxBack, topY + ISO_DY, rxBack, topY + ISO_DY + 2, 'rgba(0,0,0,0.24)');
    if (leftWall) {
      drawIsoLine(ctx, x + 0.5, topY, x + ISO_DX + 0.5, topY + ISO_DY, 'rgba(0,0,0,0.22)', 1);
    }
    const midTopBack = Math.min(rxBack, x + 16 + ISO_DX);
    drawIsoLine(ctx, x + 16, topY, midTopBack, topY + ISO_DY, 'rgba(0,0,0,0.12)', 1);
    if (!rightWall) {
      drawIsoLine(ctx, fx1, topY, fx1 + ISO_DX, topY + ISO_DY, 'rgba(255,255,255,0.22)', 1);
    }
  }

  // 2. Lit 9px RIGHT SIDE face (extruded masonry thickness wherever open space is to the right)
  if (hasRightSide) {
    const sideTopFrontY = ceilAboveRight ? topY - aboveSoffitH : topY;
    const sideTopBackY = ceilAboveRight ? topY : topY + ISO_DY;
    const sideBotFrontY = fy1;
    const sideBotBackY = hasSoffit ? botY : botY + ISO_DY;

    const sg = ctx.createLinearGradient(fx1, topY, fx1 + ISO_DX, topY);
    sg.addColorStop(0, theme.wallSideLit);
    sg.addColorStop(0.58, theme.wallSideMid);
    sg.addColorStop(1, theme.wallSideBack);
    fillQuad(
      ctx,
      fx1, sideTopFrontY,
      fx1 + ISO_DX, sideTopBackY,
      fx1 + ISO_DX, sideBotBackY,
      fx1, sideBotFrontY,
      sg
    );

    fillQuad(
      ctx,
      fx1, topY + 15,
      fx1 + ISO_DX, topY + 15 + ISO_DY,
      fx1 + ISO_DX, Math.min(sideBotBackY, topY + 31 + ISO_DY),
      fx1, Math.min(sideBotFrontY, topY + 31),
      'rgba(0,0,0,0.10)'
    );

    for (const cy of [15, 31]) {
      if (topY + cy < sideBotFrontY - 1) {
        drawIsoLine(ctx, fx1, topY + cy + 0.5, fx1 + ISO_DX, topY + cy + 0.5 + ISO_DY, 'rgba(0,0,0,0.34)', 1);
        drawIsoLine(ctx, fx1, topY + cy + 1.5, fx1 + ISO_DX, topY + cy + 1.5 + ISO_DY, 'rgba(255,255,255,0.09)', 1);
      }
    }
    if (isPillar && !upWall) {
      drawIsoLine(ctx, fx1, topY + 4, fx1 + ISO_DX, topY + 4 + ISO_DY, hexRgba(theme.wallTrim, 0.7), 2);
    }
    if (isPillar && !downWall) {
      drawIsoLine(ctx, fx1, fy1 - 4, fx1 + ISO_DX, sideBotBackY - 4, hexRgba(theme.wallTrim, 0.65), 2);
    }

    const aoG = ctx.createLinearGradient(fx1 + ISO_DX - 4, 0, fx1 + ISO_DX, 0);
    aoG.addColorStop(0, 'rgba(0,0,0,0)');
    aoG.addColorStop(1, 'rgba(0,0,0,0.46)');
    fillQuad(ctx, fx1 + ISO_DX - 4, sideTopBackY + 3, fx1 + ISO_DX, sideTopBackY, fx1 + ISO_DX, sideBotBackY, fx1 + ISO_DX - 4, sideBotBackY + 3, aoG);

    if (rightTileCh !== '.' && rightTileCh !== '#') {
      const yF = floorY(r) + SLAB_FRONT_OFF;
      const yB = yF + ISO_DY;
      fillQuad(ctx, fx1, yF, fx1 + ISO_DX, yB, fx1 + ISO_DX, yB - 4, fx1, yF - 4, 'rgba(0,0,0,0.28)');
    }
    if (ceilAboveRight) {
      drawIsoLine(ctx, fx1, sideTopFrontY, fx1 + ISO_DX, sideTopBackY, 'rgba(0,0,0,0.45)', 1.2);
    }
  }

  // 3. Shadowed 6px LEFT INNER REVEAL (on right room boundary walls & right sides of shafts/openings)
  if (hasLeftReveal) {
    const revTopFrontY = ceilAboveLeft ? topY - aboveSoffitH : topY;
    const revTopBackY = topY;
    const revBotFrontY = fy1;
    const revBotBackY = botY;

    const leftIsStaticFloor = isStaticWalkable(leftTileCh);
    const fYF = floorY(r) + SLAB_FRONT_OFF;
    const fYB = fYF + ISO_DY;
    const bFrontY = leftIsStaticFloor ? Math.min(revBotFrontY, fYF) : revBotFrontY;
    const bBackY = leftIsStaticFloor ? fYB : revBotBackY;

    const rg = ctx.createLinearGradient(fx0, topY, x, topY);
    rg.addColorStop(0, theme.wallRevealFront);
    rg.addColorStop(0.65, theme.wallDark);
    rg.addColorStop(1, theme.wallRevealBack);
    fillQuad(ctx, fx0, revTopFrontY, x, revTopBackY, x, bBackY, fx0, bFrontY, rg);

    for (const cy of [15, 31]) {
      if (topY + cy < bFrontY - 1) {
        const yBackCourse = Math.min(bBackY, topY + cy + (leftIsStaticFloor ? -2 : 0));
        drawIsoLine(ctx, fx0, topY + cy + 0.5, x, yBackCourse + 0.5, 'rgba(0,0,0,0.40)', 1);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(x, revTopBackY, 2, Math.max(0, bBackY - revTopBackY));
    if (leftIsStaticFloor) {
      fillQuad(ctx, fx0, fYF, x, fYB, x, fYB - 4, fx0, fYF - 4, 'rgba(0,0,0,0.34)');
    }
    if (ceilAboveLeft) {
      drawIsoLine(ctx, fx0, revTopFrontY, x, revTopBackY, 'rgba(0,0,0,0.48)', 1.2);
    }
  }

  // 4. Shadowed CEILING SOFFIT REVEAL (underside of ceiling band & overhanging walls)
  if (hasSoffit) {
    const leftBelowIsLeftWall = leftWall && level.getTile(room.id, c - 1, r + 1) === '#';
    const rightBelowIsRightWall = rightWall && tileHasLeftReveal(level, room, c + 1, r + 1);

    const sLxFront = fx0;
    const sLxBack = hasLeftReveal ? x : (leftBelowIsLeftWall ? x + ISO_DX : (leftWall ? x : x + ISO_DX));
    const sRxFront = rightBelowIsRightWall ? fx1 + WALL_REVEAL_L : fx1;
    const sRxBack = rightBelowIsRightWall ? fx1 : (rightWall ? fx1 : fx1 + ISO_DX);

    const cg = ctx.createLinearGradient(0, fy1, 0, botY);
    cg.addColorStop(0, theme.wallSoffitFront);
    cg.addColorStop(1, theme.wallSoffitBack);
    fillQuad(ctx, sLxFront, fy1, sRxFront, fy1, sRxBack, botY, sLxBack, botY, cg);

    if (!hasLeftReveal && leftWall && !leftBelowIsLeftWall) {
      drawIsoLine(ctx, x + 0.5, fy1, x + 0.5, botY, 'rgba(0,0,0,0.28)', 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(Math.min(sLxBack, sRxBack), botY - 1, Math.abs(sRxBack - sLxBack), 1);
  }

  // 4b. Top-right inner corner miter inside notchBL (cleanly joins ceiling soffit & right wall reveal!)
  if (notchBL) {
    const ny0 = botY - notchBLH;
    const cg = ctx.createLinearGradient(0, ny0, 0, botY);
    cg.addColorStop(0, theme.wallSoffitFront);
    cg.addColorStop(1, theme.wallSoffitBack);
    fillQuad(ctx, x, ny0, x + WALL_REVEAL_L, ny0, x, botY, x, botY, cg);

    const rg = ctx.createLinearGradient(x + WALL_REVEAL_L, 0, x, 0);
    rg.addColorStop(0, theme.wallRevealFront);
    rg.addColorStop(0.65, theme.wallDark);
    rg.addColorStop(1, theme.wallRevealBack);
    fillQuad(ctx, x + WALL_REVEAL_L, ny0, x + WALL_REVEAL_L, botY, x, botY, x, botY, rg);

    drawIsoLine(ctx, x + WALL_REVEAL_L, ny0, x, botY, 'rgba(0,0,0,0.50)', 1.2);
  }

  // 5. FRONT face
  drawWallFrontFace(ctx, x, topY, theme, geom, c, r);
}

function getSlabEdgeFlags(level, room, c, r) {
  let climbLeft = false;
  let climbRight = false;
  let dropLeft = false;
  let dropRight = false;
  if (c >= 0 && c < COLS) {
    const leftRaw = c - 1 >= 0 ? room.grid[r][c - 1] : level.getTile(room.id, c - 1, r);
    if (leftRaw === '.') {
      if (level.hasFloor(room.id, c - 1, r + 1) && !level.isWall(room.id, c - 1, r + 1)) climbLeft = true;
      else dropLeft = true;
    }
    const rightRaw = c + 1 < COLS ? room.grid[r][c + 1] : level.getTile(room.id, c + 1, r);
    if (rightRaw === '.') {
      if (level.hasFloor(room.id, c + 1, r + 1) && !level.isWall(room.id, c + 1, r + 1)) climbRight = true;
      else dropRight = true;
    }
  }
  return { climbLeft, climbRight, dropLeft, dropRight };
}

function drawFloorSlabFront(ctx, fx, fyy, theme, {
  isLoose = false, leftHasFloor = false, climbLeft = false, climbRight = false, dropLeft = false, dropRight = false, extraRightW = 0,
} = {}) {
  const yF = fyy + SLAB_FRONT_OFF;
  const W = TILE_W + extraRightW;

  ctx.fillStyle = theme.floorFace;
  ctx.fillRect(fx, yF, W, SLAB_FRONT_H);
  // Crisp 2x front-top specular chamfer edge
  ctx.fillStyle = theme.floorEdgeBevel;
  ctx.fillRect(fx, yF, W, 0.75);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(fx, yF, W, 0.4);
  // Dark underside rim + subtle lower lip
  ctx.fillStyle = theme.floorDark;
  ctx.fillRect(fx, yF + SLAB_FRONT_H - 0.85, W, 0.85);

  // Subtle vertical masonry joints (0.5px precision at 2x)
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  if (leftHasFloor || isLoose) {
    ctx.fillRect(fx, yF + 0.75, 0.75, SLAB_FRONT_H - 0.75);
  }
  ctx.fillRect(fx + 16, yF + 0.75, 0.75, SLAB_FRONT_H - 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(fx + 16.75, yF + 0.75, 0.5, SLAB_FRONT_H - 1.5);
  if (extraRightW > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(fx + TILE_W, yF + 0.75, 0.75, SLAB_FRONT_H - 1.5);
  }

  if (isLoose) {
    // Vertical fracture notches on the front face aligned with the top-face cracks
    ctx.fillStyle = '#05070a';
    ctx.fillRect(fx + 1, yF, 1, SLAB_FRONT_H);
    ctx.fillRect(fx + TILE_W - 2, yF, 1, SLAB_FRONT_H);
    ctx.fillRect(fx + 8.5, yF, 1.5, SLAB_FRONT_H);
    ctx.fillRect(fx + 20.5, yF, 1.5, SLAB_FRONT_H);
    ctx.fillStyle = '#ede0c4';
    ctx.fillRect(fx + 6.5, yF, 2, 0.75);
    ctx.fillRect(fx + 18.5, yF, 2, 0.75);
    ctx.fillStyle = theme.floorTrim;
    ctx.fillRect(fx + 2, yF + 2, 3, 0.75);
    ctx.fillRect(fx + TILE_W - 5, yF + 2, 3, 0.75);
  }

  // Preserve front brass corner brackets with fine rivets on climbable/drop ledges
  if (climbLeft) {
    ctx.fillStyle = theme.floorTrim;
    ctx.fillRect(fx, yF, 5, 3);
    ctx.fillStyle = '#fff5d4';
    ctx.fillRect(fx, yF, 5, 0.75);
    ctx.fillRect(fx, yF, 0.75, SLAB_FRONT_H);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(fx + 3, yF + 1.5, 0.75, 0.75);
  } else if (dropLeft) {
    ctx.fillStyle = theme.floorTrim;
    ctx.fillRect(fx, yF, 3, 2);
  }
  if (climbRight) {
    ctx.fillStyle = theme.floorTrim;
    ctx.fillRect(fx + TILE_W - 5, yF, 5, 3);
    ctx.fillStyle = '#fff5d4';
    ctx.fillRect(fx + TILE_W - 5, yF, 5, 0.75);
    ctx.fillRect(fx + TILE_W - 0.75, yF, 0.75, SLAB_FRONT_H);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(fx + TILE_W - 3.75, yF + 1.5, 0.75, 0.75);
  } else if (dropRight) {
    ctx.fillStyle = theme.floorTrim;
    ctx.fillRect(fx + TILE_W - 3, yF, 3, 2);
  }
}

function drawFloorSlab(ctx, level, room, c, r, fx, fyy, theme, opts = {}) {
  const isLoose = !!opts.isLoose;
  const isStaticPass = !!opts.isStaticPass;
  const ch = opts.ch ?? (c >= 0 && c < COLS ? room.grid[r][c] : level.getTile(room.id, c, r));
  const W = TILE_W;
  const yF = fyy + SLAB_FRONT_OFF;
  const yB = yF + ISO_DY;
  const yBot = yF + SLAB_FRONT_H;
  const yBotB = yBot + ISO_DY;

  const leftCh = level.getTile(room.id, c - 1, r);
  const rightCh = level.getTile(room.id, c + 1, r);
  const belowCh = level.getTile(room.id, c, r + 1);

  const rightIsWall = rightCh === '#';
  const rightWallHasReveal = rightIsWall && tileHasLeftReveal(level, room, c + 1, r);
  const extraRightW = rightWallHasReveal ? WALL_REVEAL_L : 0;
  const rightHasFloor = isStaticPass
    ? isStaticWalkable(rightCh)
    : (rightCh !== '.' && rightCh !== '#');
  const leftHasFloor = leftCh !== '.' && leftCh !== '#';

  // 1. Underside shadow & 3D corbel brackets (only when not sitting directly on a wall)
  if (belowCh !== '#') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.fillRect(fx, yBot, W + extraRightW, 2);
    if (!isLoose && r < ROWS - 1) {
      for (const cxOff of [2, W - 6]) {
        ctx.fillStyle = theme.wallDark;
        ctx.fillRect(fx + cxOff, yBot, 3, 3);
        ctx.fillStyle = theme.floorFace;
        ctx.fillRect(fx + cxOff, yBot, 1, 2);
        fillQuad(
          ctx,
          fx + cxOff + 3, yBot,
          fx + cxOff + 6, yBot - 3,
          fx + cxOff + 6, yBot,
          fx + cxOff + 3, yBot + 3,
          theme.floorSideBack
        );
      }
    }
  }

  // 2. Lit 9px RIGHT SIDE face of slab (visible when open air or loose floor sits to the right)
  if (!rightIsWall && !rightHasFloor) {
    const sg = ctx.createLinearGradient(fx + W, yF, fx + W + ISO_DX, yF);
    sg.addColorStop(0, theme.floorSide);
    sg.addColorStop(1, theme.floorSideBack);
    fillQuad(
      ctx,
      fx + W, yF,
      fx + W + ISO_DX, yB,
      fx + W + ISO_DX, yBotB,
      fx + W, yBot,
      sg
    );
    drawIsoLine(ctx, fx + W, yBot - 0.5, fx + W + ISO_DX, yBotB - 0.5, 'rgba(0,0,0,0.45)', 1);
  }

  // 3. Lit TOP face (oblique parallelogram receding +9 right, -8 up; meets right wall reveal seamlessly)
  const rxFront = fx + W + extraRightW;
  const rxBack = rightIsWall ? fx + W : fx + W + ISO_DX;
  const tg = ctx.createLinearGradient(fx, yB, fx, yF);
  tg.addColorStop(0, theme.floorTopBack);
  tg.addColorStop(0.65, theme.floorTop);
  tg.addColorStop(1, theme.floorTopHi);
  fillQuad(ctx, fx, yF, fx + ISO_DX, yB, rxBack, yB, rxFront, yF, tg);

  // Subtle back-wall ambient occlusion strip along the very back of the top face
  fillQuad(ctx, fx + ISO_DX - 1, yB + 2, fx + ISO_DX, yB, rxBack, yB, rxBack - 1, yB + 2, 'rgba(0,0,0,0.26)');

  // Oblique tile stone joints on top face
  if (leftHasFloor || leftCh === '#') {
    drawIsoLine(ctx, fx + 0.5, yF, fx + ISO_DX + 0.5, yB, 'rgba(0,0,0,0.24)', 1);
  }
  const midBackX = Math.min(rxBack, fx + 16 + ISO_DX);
  drawIsoLine(ctx, fx + 16, yF, midBackX, yB, 'rgba(0,0,0,0.14)', 1);
  // Mid-depth horizontal paving course line
  const midY = Math.round((yF + yB) * 0.5);
  const midX0 = fx + Math.round(ISO_DX * 0.5);
  const midX1 = rightIsWall ? Math.round((rxFront + rxBack) * 0.5) : midX0 + W;
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(midX0, midY, Math.max(0, midX1 - midX0), 1);

  // Cast shadow onto floor top face from a wall standing immediately to the right (shadow side)
  if (rightIsWall) {
    const shG = ctx.createLinearGradient(rxFront, 0, rxFront - 12, 0);
    shG.addColorStop(0, 'rgba(0,0,0,0.34)');
    shG.addColorStop(1, 'rgba(0,0,0,0)');
    fillQuad(ctx, rxFront, yF, rxBack, yB, Math.max(fx + ISO_DX, rxBack - 10), yB, Math.max(fx, rxFront - 12), yF, shG);
  }
  // Subtle contact shadow crease where a left-side wall meets this floor slab
  if (leftCh === '#') {
    const lG = ctx.createLinearGradient(fx, 0, fx + 6, 0);
    lG.addColorStop(0, 'rgba(0,0,0,0.28)');
    lG.addColorStop(1, 'rgba(0,0,0,0)');
    fillQuad(ctx, fx, yF, fx + ISO_DX, yB, fx + ISO_DX + 5, yB, fx + 5, yF, lG);
  }

  // Crisp 1px bright edge highlight along exposed left edge (next to open air)
  if (leftCh === '.') {
    drawIsoLine(ctx, fx + 0.5, yF, fx + ISO_DX + 0.5, yB, 'rgba(255,255,255,0.26)', 1);
  }

  // Ice specular streaks in Level 9 (Jungfraujoch Ice Palace)
  if (level.ice && ch === '_') {
    drawIsoLine(ctx, fx + 5, yF - 1, fx + 13, yB + 1, 'rgba(235, 250, 255, 0.55)', 1.5);
    drawIsoLine(ctx, fx + 19, yF - 1, fx + 27, yB + 2, 'rgba(235, 250, 255, 0.42)', 1);
  }

  // Loose floor top-face jagged cracks
  if (isLoose) {
    ctx.strokeStyle = '#07090d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fx + 9, yF);
    ctx.lineTo(fx + 11, yF - 3);
    ctx.lineTo(fx + 16, yF - 5);
    ctx.lineTo(fx + 17, yB);
    ctx.moveTo(fx + 21, yF);
    ctx.lineTo(fx + 24, yF - 4);
    ctx.lineTo(fx + 29, yB);
    ctx.moveTo(fx + 11, yF - 3);
    ctx.lineTo(fx + 18, yF - 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(240, 228, 198, 0.55)';
    ctx.fillRect(fx + 12, yF - 4, 2, 1);
    ctx.fillRect(fx + 25, yF - 5, 2, 1);
  }

  const edgeFlags = getSlabEdgeFlags(level, room, c, r);

  // 4. FRONT face (includes crisp brass corner brackets on climbable/drop ledges)
  drawFloorSlabFront(ctx, fx, fyy, theme, { isLoose, leftHasFloor, extraRightW, ...edgeFlags });

  // 5. Oblique top-face ledge trim along edges bordering open air ('.')
  if (edgeFlags.climbLeft || edgeFlags.dropLeft) {
    const ex = fx;
    if (edgeFlags.climbLeft) {
      const lg = ctx.createRadialGradient(ex + 3, yF - 3, 1, ex + 3, yF - 3, 9);
      lg.addColorStop(0, 'rgba(255, 234, 165, 0.24)');
      lg.addColorStop(1, 'rgba(255, 234, 165, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(ex - 6, yB - 4, 18, 16);
      fillQuad(ctx, ex, yF, ex + ISO_DX, yB, ex + 3 + ISO_DX, yB, ex + 3, yF, theme.floorTrim);
      drawIsoLine(ctx, ex + 0.5, yF, ex + ISO_DX + 0.5, yB, '#fff3cf', 1.1);
    } else {
      drawIsoLine(ctx, ex + 0.5, yF, ex + ISO_DX + 0.5, yB, theme.floorTrim, 1.2);
    }
  }
  if (edgeFlags.climbRight || edgeFlags.dropRight) {
    const ex = fx + W;
    if (edgeFlags.climbRight) {
      const lg = ctx.createRadialGradient(ex + 2, yF - 3, 1, ex + 2, yF - 3, 9);
      lg.addColorStop(0, 'rgba(255, 234, 165, 0.24)');
      lg.addColorStop(1, 'rgba(255, 234, 165, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(ex - 7, yB - 4, 18, 16);
      fillQuad(ctx, ex - 3, yF, ex - 3 + ISO_DX, yB, ex + ISO_DX, yB, ex, yF, theme.floorTrim);
      drawIsoLine(ctx, ex - 0.5, yF, ex + ISO_DX - 0.5, yB, '#fff3cf', 1.1);
    } else {
      drawIsoLine(ctx, ex - 0.5, yF, ex + ISO_DX - 0.5, yB, theme.floorTrim, 1.2);
    }
  }
}

function drawStaticRoomBase(ctx, level, room, theme) {
  // 1. Back-wall depth pushback: subtle vertical atmospheric darkening & corner ambient occlusion
  for (let r = 0; r < ROWS; r++) {
    const topY = r * TILE_H;
    const fy = floorY(r);
    const yB = fy + SLAB_FRONT_OFF + ISO_DY; // where floor top meets back wall

    const vg = ctx.createLinearGradient(0, topY, 0, topY + TILE_H);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
    vg.addColorStop(0.28, 'rgba(0, 0, 0, 0.08)');
    vg.addColorStop(0.72, 'rgba(0, 0, 0, 0.10)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, topY, VIEW_W, TILE_H);

    for (let c = 0; c < COLS; c++) {
      if (room.grid[r][c] === '#') continue;
      const aboveCh = level.getTile(room.id, c, r - 1);
      const hasCeil = aboveCh !== '.';
      const hasFlr = isStaticWalkable(room.grid[r][c]);
      const bx = c * TILE_W + ISO_DX;

      if (hasCeil && hasFlr && (c % 3 === 1)) {
        ctx.fillStyle = theme.pilasterFill;
        ctx.fillRect(bx + 1, topY, 5, Math.max(0, yB - topY));
        ctx.fillStyle = theme.pilasterHi;
        ctx.fillRect(bx + 1, topY, 1, Math.max(0, yB - topY));
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(bx + 6, topY, 2, Math.max(0, yB - topY));
      }

      // Ceiling-to-back-wall ambient occlusion under overhead slabs/walls
      if (hasCeil) {
        const cg = ctx.createLinearGradient(0, topY - 1, 0, topY + 9);
        cg.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
        cg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = cg;
        ctx.fillRect(c * TILE_W, topY - 1, TILE_W + ISO_DX, 10);
      }

      // Floor-to-back-wall ambient occlusion rising from back edge of floor top face
      if (hasFlr) {
        const fg = ctx.createLinearGradient(0, yB - 8, 0, yB + 1);
        fg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        fg.addColorStop(1, 'rgba(0, 0, 0, 0.46)');
        ctx.fillStyle = fg;
        ctx.fillRect(bx, yB - 8, TILE_W, 9);
      }
    }

    // Wall-to-back-wall ambient occlusion on BOTH left-wall back corners and right-wall back corners
    for (let c = -1; c < COLS; c++) {
      if (level.getTile(room.id, c, r) === '#' && level.getTile(room.id, c + 1, r) !== '#') {
        const sx = (c + 1) * TILE_W + ISO_DX;
        const wg = ctx.createLinearGradient(sx, 0, sx + 9, 0);
        wg.addColorStop(0, 'rgba(0, 0, 0, 0.44)');
        wg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = wg;
        ctx.fillRect(sx, topY, 9, TILE_H);
      }
      if (c > 0 && tileHasLeftReveal(level, room, c, r) && level.getTile(room.id, c - 1, r) !== '#') {
        const sx = c * TILE_W;
        const wg = ctx.createLinearGradient(sx, 0, sx - 8, 0);
        wg.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
        wg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = wg;
        ctx.fillRect(sx - 8, topY, 8, TILE_H);
      }
    }
  }

  // 2. Ceiling overhang slabs & upward shaft openings when room links upward
  if (room.links.up !== null) {
    const upRoom = level.getRoom(room.links.up);
    if (upRoom) {
      for (let c = -1; c < COLS; c++) {
        const upCh = c < 0 ? level.getTile(room.links.up, c, ROWS - 1) : upRoom.grid[ROWS - 1][c];
        const nextUpCh = level.getTile(room.links.up, c + 1, ROWS - 1);
        const x = c * TILE_W;
        if (upCh !== '.') {
          ctx.fillStyle = theme.wallSoffitBack;
          ctx.fillRect(x, 0, TILE_W, 4);
          ctx.fillStyle = upCh === '#' ? theme.wallFill : theme.floorFace;
          ctx.fillRect(x, 0, TILE_W, 2);
          ctx.fillStyle = theme.floorDark;
          ctx.fillRect(x, 3, TILE_W, 1);
          // 3D right side bevel at ceiling shaft opening
          if (nextUpCh === '.') {
            fillQuad(ctx, x + TILE_W, 0, x + TILE_W + 5, 0, x + TILE_W + 5, 2, x + TILE_W, 4, theme.floorSide);
          }
        } else if (c >= 0) {
          const sg = ctx.createLinearGradient(0, 0, 0, 22);
          sg.addColorStop(0, 'rgba(200, 225, 255, 0.14)');
          sg.addColorStop(1, 'rgba(200, 225, 255, 0)');
          ctx.fillStyle = sg;
          ctx.fillRect(x + 2, 0, TILE_W - 4, 22);

          const leftCh = level.getTile(room.links.up, c - 1, ROWS - 1);
          const rightCh = level.getTile(room.links.up, c + 1, ROWS - 1);
          if (leftCh !== '#' && level.hasFloor(room.links.up, c - 1, ROWS - 1)) {
            ctx.fillStyle = theme.floorTrim;
            ctx.fillRect(x - 3, 0, 4, 3);
            ctx.fillStyle = '#fff3cf';
            ctx.fillRect(x - 2, 1, 2, 1);
          }
          if (rightCh !== '#' && level.hasFloor(room.links.up, c + 1, ROWS - 1)) {
            ctx.fillStyle = theme.floorTrim;
            ctx.fillRect(x + TILE_W - 1, 0, 4, 3);
            ctx.fillStyle = '#fff3cf';
            ctx.fillRect(x + TILE_W, 1, 2, 1);
          }
        }
      }
    }
  }

  // 3. All static walls, pillars, and non-loose floor slabs in strict painter's order:
  //    bottom-to-top by row (r = ROWS - 1 .. 0), left-to-right by column (c = -1 .. COLS - 1).
  for (let r = ROWS - 1; r >= 0; r--) {
    const fy = floorY(r);
    for (let c = -1; c < COLS; c++) {
      const ch = c < 0 ? level.getTile(room.id, c, r) : room.grid[r][c];
      if (ch === '.') continue;
      if (ch === '#') {
        drawWallBlock(ctx, level, room, c, r, theme);
        continue;
      }
      if (c >= 0 && ch === 'L') continue;
      drawFloorSlab(ctx, level, room, c, r, c * TILE_W, fy, theme, {
        isLoose: false,
        isStaticPass: true,
        ch,
      });
    }
  }
}

function drawStaticRoomFg(ctx, level, room, theme) {
  // Foreground solid wall FRONT faces ONLY (never wall side faces or inner reveals, so characters
  // standing near a wall always draw cleanly in front of the wall's recessed side reveal!)
  for (let r = ROWS - 1; r >= 0; r--) {
    const topY = r * TILE_H;
    for (let c = 0; c < COLS; c++) {
      if (room.grid[r][c] !== '#') continue;
      const geom = getWallGeom(level, room, c, r);
      drawWallFrontFace(ctx, c * TILE_W, topY, theme, geom, c, r);
    }
  }
  // Ceiling overhang front lip
  if (room.links.up !== null) {
    const upRoom = level.getRoom(room.links.up);
    if (upRoom) {
      for (let c = 0; c < COLS; c++) {
        const upCh = upRoom.grid[ROWS - 1][c];
        if (upCh === '.') continue;
        const x = c * TILE_W;
        ctx.fillStyle = upCh === '#' ? theme.wallFill : theme.floorFace;
        ctx.fillRect(x, 0, TILE_W, 2);
        ctx.fillStyle = theme.floorDark;
        ctx.fillRect(x, 2, TILE_W, 1);
      }
    }
  }
}

function getStaticRoomLayers(level, room, theme) {
  const key = `${level.id}:${room.id}@${RENDER_SCALE}`;
  let entry = roomStaticCache.get(key);
  if (entry) return entry;

  const pw = VIEW_W * RENDER_SCALE;
  const ph = PLAY_H * RENDER_SCALE;
  const base = createOffscreen(pw, ph);
  const fg = createOffscreen(pw, ph);
  if (!base || !fg) {
    return null;
  }

  base.ctx.imageSmoothingEnabled = true;
  fg.ctx.imageSmoothingEnabled = true;
  base.ctx.scale(RENDER_SCALE, RENDER_SCALE);
  fg.ctx.scale(RENDER_SCALE, RENDER_SCALE);
  drawStaticRoomBase(base.ctx, level, room, theme);
  drawStaticRoomFg(fg.ctx, level, room, theme);

  entry = { baseCanvas: base.canvas, fgCanvas: fg.canvas };
  if (roomStaticCache.size >= MAX_ROOM_CACHE) {
    const oldest = roomStaticCache.keys().next().value;
    roomStaticCache.delete(oldest);
  }
  roomStaticCache.set(key, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Room Tiles, Props, Items, HUD, Overlays
// ---------------------------------------------------------------------------

export function renderGame(ctx, game) {
  const { mode, time, level, player, enemies } = game;
  const sx = ctx.canvas && ctx.canvas.width ? ctx.canvas.width / VIEW_W : RENDER_SCALE;
  const sy = ctx.canvas && ctx.canvas.height ? ctx.canvas.height / VIEW_H : RENDER_SCALE;

  ctx.save();
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.imageSmoothingEnabled = false;

  if (mode === 'title') {
    renderTitle(ctx, game);
    ctx.restore();
    return;
  }
  if (mode === 'level_select') {
    renderLevelSelect(ctx, game);
    ctx.restore();
    return;
  }
  if (mode === 'intro' || mode === 'interlude' || mode === 'victory' || mode === 'timeout') {
    renderStoryScreen(ctx, game);
    ctx.restore();
    return;
  }

  const room = level.getRoom(player.roomId);
  if (!room) {
    ctx.restore();
    return;
  }
  const theme = getIsoTheme(level.id);

  // Camera shake
  ctx.save();
  if (game.shakeTimer > 0) {
    const mag = Math.min(3, game.shakeTimer * 12);
    ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
  }

  // 1. Procedural backdrop behind tiles (full 384x192 logical / 768x384 physical clipped to play area)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, PLAY_H);
  ctx.clip();
  drawBackdrop(ctx, level.id, VIEW_W, PLAY_H, time, room.seed);

  // 2. Cached static 2.5D room geometry at 2x (back-wall pushback/AO, pilasters, walls, pillars, static slabs)
  const cached = getStaticRoomLayers(level, room, theme);
  if (cached) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cached.baseCanvas, 0, 0, VIEW_W, PLAY_H);
  } else {
    drawStaticRoomBase(ctx, level, room, theme);
  }

  // 3. Back-wall decor (torches/lamps with soft floor light pools, banners, signs, notes, 3D CRT, console)
  drawDecor(ctx, level, room, theme, time, level.id);

  // 4. Dynamic floor-plane objects (loose floors, plates, recessed exit doors, spikes, back frames of gates/slicers/mirror)
  drawDynamicRoomElements(ctx, level, room, theme, time);

  // 5. Collectible items resting on the floor's top face (sword, elixirs)
  drawItems(ctx, room, time);

  // 6. Falling loose-floor debris (3D oblique slabs)
  for (const d of level.fallingDebris) {
    if (d.roomId !== room.id) continue;
    const dx = Math.round(d.x - 14);
    const dy = Math.round(d.y);
    const dw = 28;
    const yF = dy + SLAB_FRONT_OFF;
    const yB = yF + ISO_DY;
    fillQuad(ctx, dx + dw, yF, dx + dw + ISO_DX, yB, dx + dw + ISO_DX, yB + SLAB_FRONT_H, dx + dw, yF + SLAB_FRONT_H, theme.floorSide);
    fillQuad(ctx, dx, yF, dx + ISO_DX, yB, dx + dw + ISO_DX, yB, dx + dw, yF, theme.floorTop);
    ctx.fillStyle = theme.floorFace;
    ctx.fillRect(dx, yF, dw, SLAB_FRONT_H);
    ctx.fillStyle = theme.floorEdgeBevel;
    ctx.fillRect(dx, yF, dw, 0.75);
  }

  // 7. Enemies, Celine NPC, and Player (articulated 2x IK figures)
  for (const enemy of enemies) {
    if (enemy.roomId !== room.id) continue;
    if (!enemy.alive && enemy.animT >= 1 && enemy.hiddenAfterDeath) continue;
    drawCharacter(ctx, enemy, time);
  }
  drawForegroundDecor(ctx, room, time);
  drawCharacter(ctx, player, time);

  // 8. Foreground depth occluders: solid wall fronts + ceiling lip + foreground slab fronts
  if (cached) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cached.fgCanvas, 0, 0, VIEW_W, PLAY_H);
  } else {
    drawStaticRoomFg(ctx, level, room, theme);
  }
  drawForegroundSlabFronts(ctx, level, room, player, theme, time);

  // 9. Foreground 3D gates, slicers, mirror front & Alpine Foehn wind streaks
  drawRoomForegroundTraps(ctx, level, room, theme, time);
  drawWindOverlay(ctx, level, room, time);

  // 9b. Climb cue: when the hero can climb from where he stands, mark the 3D ledge corner
  drawClimbCue(ctx, level, player, time);

  // 10. Particles (sparks, dust, shatter — rounded crisp 2x motes)
  for (const pt of level.particles) {
    if (pt.roomId !== room.id) continue;
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    const r = Math.max(0.6, pt.size * 0.55);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 11. Room hint / floating banner inside play area (crisp pixel font with auto-wrap)
  if (game.bannerTimer > 0 && game.bannerText) {
    const alpha = Math.min(1, game.bannerTimer * 2);
    const wrapped = wrapPixelText(game.bannerText, 64);
    const boxH = wrapped.length > 1 ? 26 : 18;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(6, 9, 14, 0.90)';
    ctx.fillRect(16, 5, VIEW_W - 32, boxH);
    ctx.strokeStyle = theme.floorTrim;
    ctx.lineWidth = 0.75;
    ctx.strokeRect(16.25, 5.25, VIEW_W - 32.5, boxH - 0.5);
    for (let i = 0; i < wrapped.length; i++) {
      const ly = wrapped.length > 1 ? 10 + i * 9 : 11;
      drawPixelText(ctx, wrapped[i], VIEW_W / 2, ly, { color: '#f3f1ea', align: 'center', shadow: '#05070a' });
    }
    ctx.restore();
  }

  // Screen flash (merge / mirror / hit)
  if (game.flashTimer > 0) {
    ctx.fillStyle = game.flashColor || `rgba(255,255,255,${Math.min(0.6, game.flashTimer * 2)})`;
    ctx.globalAlpha = Math.min(0.65, game.flashTimer * 2.2);
    ctx.fillRect(0, 0, VIEW_W, PLAY_H);
    ctx.globalAlpha = 1;
  }

  ctx.restore(); // end playfield clip
  ctx.restore(); // end shake

  // 12. Bottom HUD Bar (y = 192..216)
  drawHUD(ctx, game);

  // 13. Overlays (Pause or Death prompt)
  if (mode === 'paused') {
    drawPauseOverlay(ctx, game);
  } else if (mode === 'dead') {
    drawDeathOverlay(ctx, game);
  }

  ctx.restore(); // end 2x transform
}

const CLIMB_CUE_STATES = new Set(['idle', 'run', 'run_start', 'skid', 'careful', 'turn', 'land', 'crouch']);

function drawClimbCue(ctx, level, player, time) {
  if (!player.alive || !player.grounded || !CLIMB_CUE_STATES.has(player.state)) return;
  if (typeof player._findJumpUpLedge !== 'function') return;
  const ledge = player._findJumpUpLedge(level);
  if (!ledge) return;
  const cornerX = ledge.facing > 0 ? (ledge.openCol + 1) * TILE_W : ledge.openCol * TILE_W;
  const ly = ledge.crossUp ? 0 : floorY(ledge.row);
  const pulse = 0.55 + 0.45 * Math.sin(time * 6);
  const ax = cornerX - ledge.facing * 7;
  const ay = Math.max(6, ly - 10 - Math.round(pulse * 2));
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.45 * pulse;
  ctx.fillStyle = '#fff1c2';
  // small up-chevron above the ledge corner
  ctx.fillRect(ax - 1, ay, 2, 1);
  ctx.fillRect(ax - 2, ay + 1, 4, 1);
  ctx.fillRect(ax - 3, ay + 2, 2, 1);
  ctx.fillRect(ax + 1, ay + 2, 2, 1);
  ctx.globalAlpha = 0.42 * pulse;
  if (ledge.crossUp) {
    ctx.fillRect(cornerX - (ledge.facing > 0 ? 6 : 0), 0, 6, 2);
  } else {
    // Highlight hugs the oblique 3D ledge edge
    const yF = ly + SLAB_FRONT_OFF;
    drawIsoLine(ctx, cornerX, yF, cornerX + ISO_DX, yF + ISO_DY, '#fff1c2', 1.6);
    ctx.fillRect(cornerX - (ledge.facing > 0 ? 0 : 6), yF - 1, 6, 2);
  }
  ctx.restore();
}

function drawFloorLightPool(ctx, cx, fy, innerRgba, outerRgba, rx = 20, ry = 3.6) {
  ctx.save();
  ctx.transform(1, 0, ISO_DX / ISO_DY, 1, cx + 2.5, fy - 2.0);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
  g.addColorStop(0, innerRgba);
  g.addColorStop(0.55, innerRgba);
  g.addColorStop(1, outerRgba);
  ctx.fillStyle = g;
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDecor(ctx, level, room, theme, time, levelId) {
  for (const d of room.decor) {
    const cx = tileCenterX(d.col);
    const fy = floorY(d.row);
    // Back-wall anchor point (receded into z = 1 plane)
    const bx = cx + ISO_DX;
    const bfy = fy + ISO_DY;
    const hasFloorHere = level.hasFloor(room.id, d.col, d.row);

    if (d.type === 'torch') {
      const ty = bfy - 18;
      if (levelId === 5) {
        // CERN cryo-photonic wall lamp (cool cyan LED bar) on back wall
        const pulse = 0.85 + 0.15 * Math.sin(time * 7 + d.col);
        if (hasFloorHere) {
          drawFloorLightPool(ctx, cx, fy, `rgba(70, 220, 255, ${(0.22 * pulse).toFixed(2)})`, 'rgba(40, 150, 255, 0)');
        }
        ctx.fillStyle = '#121d30';
        ctx.fillRect(bx - 6, ty - 2, 12, 6);
        ctx.fillStyle = '#253957';
        ctx.fillRect(bx - 5, ty - 2, 10, 4);
        const g = ctx.createRadialGradient(bx, ty, 1, bx, ty, 20);
        g.addColorStop(0, `rgba(70, 220, 255, ${(0.32 * pulse).toFixed(2)})`);
        g.addColorStop(1, 'rgba(40, 150, 255, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - 22, ty - 20, 44, 40);
        ctx.fillStyle = '#68e8ff';
        ctx.fillRect(bx - 4, ty - 1, 8, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 2, ty - 1, 4, 1);
      } else if (levelId === 3) {
        // Grande Dixence damp hydro fluorescent tube
        if (hasFloorHere) {
          drawFloorLightPool(ctx, cx, fy, 'rgba(95, 212, 226, 0.20)', 'rgba(40, 140, 160, 0)');
        }
        ctx.fillStyle = '#192832';
        ctx.fillRect(bx - 7, ty - 2, 14, 5);
        ctx.fillStyle = '#2e4554';
        ctx.fillRect(bx - 6, ty - 2, 12, 3);
        const g = ctx.createRadialGradient(bx, ty, 1, bx, ty, 22);
        g.addColorStop(0, 'rgba(95, 212, 226, 0.30)');
        g.addColorStop(1, 'rgba(40, 140, 160, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - 22, ty - 22, 44, 44);
        ctx.fillStyle = '#7de0ee';
        ctx.fillRect(bx - 5, ty - 1, 10, 2);
      } else if (levelId === 6) {
        // Bundeshaus green-shaded federal accountant lamp on back wall
        if (hasFloorHere) {
          drawFloorLightPool(ctx, cx, fy, 'rgba(130, 220, 155, 0.22)', 'rgba(80, 160, 100, 0)');
        }
        ctx.fillStyle = '#5c4920';
        ctx.fillRect(bx - 2, ty + 2, 4, 5);
        ctx.fillStyle = '#7a632c';
        ctx.fillRect(bx - 1, ty, 2, 6);
        ctx.fillStyle = '#1d6b42';
        ctx.fillRect(bx - 5, ty - 3, 10, 4);
        ctx.fillStyle = '#2c8a58';
        ctx.fillRect(bx - 4, ty - 3, 8, 1);
        const g = ctx.createRadialGradient(bx, ty + 2, 1, bx, ty + 4, 22);
        g.addColorStop(0, 'rgba(130, 220, 155, 0.30)');
        g.addColorStop(1, 'rgba(80, 160, 100, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - 22, ty - 16, 44, 40);
        ctx.fillStyle = '#d8f5bc';
        ctx.fillRect(bx - 3, ty + 1, 6, 1);
      } else if (levelId === 8) {
        // Jungfraujoch frosted crystal ice lantern
        if (hasFloorHere) {
          drawFloorLightPool(ctx, cx, fy, 'rgba(170, 238, 255, 0.24)', 'rgba(90, 180, 240, 0)');
        }
        ctx.fillStyle = '#264561';
        ctx.fillRect(bx - 3, ty - 6, 6, 2);
        ctx.fillRect(bx - 3, ty + 2, 6, 2);
        const g = ctx.createRadialGradient(bx, ty - 1, 1, bx, ty - 1, 22);
        g.addColorStop(0, 'rgba(170, 238, 255, 0.34)');
        g.addColorStop(1, 'rgba(90, 180, 240, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - 22, ty - 22, 44, 44);
        ctx.fillStyle = '#9be8ff';
        ctx.fillRect(bx - 2, ty - 4, 4, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 1, ty - 3, 2, 4);
      } else if (levelId === 9 || levelId === 7) {
        // Sphinx / Eigerwand alpine summit floodlight on back-wall mast
        if (hasFloorHere) {
          drawFloorLightPool(ctx, cx, fy, 'rgba(255, 242, 195, 0.26)', 'rgba(255, 220, 140, 0)', 20, 3.8);
        }
        ctx.fillStyle = '#384152';
        ctx.fillRect(bx - 1, bfy - 22, 2, 22);
        ctx.fillStyle = '#1e2430';
        ctx.fillRect(bx - 4, bfy - 25, 8, 4);
        const g = ctx.createRadialGradient(bx, bfy - 23, 1, bx, bfy - 16, 26);
        g.addColorStop(0, 'rgba(255, 242, 195, 0.36)');
        g.addColorStop(1, 'rgba(255, 220, 140, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - 26, bfy - 40, 52, 46);
        ctx.fillStyle = '#fff5cc';
        ctx.fillRect(bx - 3, bfy - 24, 6, 2);
      } else {
        // Classic Paradeplatz / Olten / Gotthard / Chillon warm wall sconce with soft multi-layer glow & teardrop flame
        const flick = Math.sin(time * 13 + d.col * 3) * 1.4;
        const sway = Math.sin(time * 9.5 + d.col * 5) * 0.7;
        if (hasFloorHere) {
          drawFloorLightPool(ctx, cx, fy, `rgba(255, 195, 85, ${(0.24 + flick * 0.015).toFixed(2)})`, 'rgba(255, 120, 30, 0)', 22, 4.0);
        }
        // Wide soft ambient halo
        const outerG = ctx.createRadialGradient(bx, ty - 2, 2, bx, ty - 2, 32 + flick);
        outerG.addColorStop(0, 'rgba(255, 185, 75, 0.22)');
        outerG.addColorStop(0.5, 'rgba(255, 130, 35, 0.08)');
        outerG.addColorStop(1, 'rgba(255, 100, 20, 0)');
        ctx.fillStyle = outerG;
        ctx.beginPath();
        ctx.arc(bx, ty - 2, 32 + flick, 0, Math.PI * 2);
        ctx.fill();
        // Back wall iron mounting plate & sculpted torch sconce cup
        ctx.fillStyle = '#241c13';
        ctx.fillRect(bx - 2, ty + 2, 4, 6.5);
        ctx.fillStyle = '#6b5330';
        ctx.fillRect(bx - 1, ty + 0.5, 2, 7);
        ctx.fillStyle = '#8c6f3e';
        ctx.fillRect(bx - 2.5, ty - 0.5, 5, 1.5);
        // Inner warm core glow
        const g = ctx.createRadialGradient(bx, ty - 2.5, 0.5, bx, ty - 2.5, 14 + flick * 0.6);
        g.addColorStop(0, 'rgba(255, 225, 130, 0.48)');
        g.addColorStop(0.55, 'rgba(255, 150, 40, 0.16)');
        g.addColorStop(1, 'rgba(255, 120, 30, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, ty - 2.5, 14 + flick * 0.6, 0, Math.PI * 2);
        ctx.fill();
        // Teardrop animated outer flame + bright inner flame + rising ember
        ctx.fillStyle = '#ff8a1f';
        ctx.beginPath();
        ctx.moveTo(bx - 2.0, ty - 0.5);
        ctx.quadraticCurveTo(bx - 2.2, ty - 3.6, bx + sway, ty - 6.2 - flick * 0.4);
        ctx.quadraticCurveTo(bx + 2.2, ty - 3.6, bx + 2.0, ty - 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff3ad';
        ctx.beginPath();
        ctx.moveTo(bx - 1.0, ty - 0.7);
        ctx.quadraticCurveTo(bx - 1.1, ty - 2.6, bx + sway * 0.6, ty - 4.4 - flick * 0.25);
        ctx.quadraticCurveTo(bx + 1.1, ty - 2.6, bx + 1.0, ty - 0.7);
        ctx.closePath();
        ctx.fill();
        // Tiny rising ember spark
        const emP = (time * 1.6 + d.col * 0.43) % 1;
        ctx.fillStyle = `rgba(255, 210, 110, ${(1 - emP).toFixed(2)})`;
        ctx.fillRect(bx + Math.sin(emP * 8 + d.col) * 2.2, ty - 6 - emP * 9, 0.75, 0.75);
      }
    } else if (d.type === 'crt') {
      // 1979 Reduit amber copper-line CRT terminal with 3D oblique cabinet sitting on top face
      const tx = cx - 6;
      const tyBase = fy - 2;
      // Skewed floor shadow
      ctx.save();
      ctx.transform(1, 0, ISO_DX / ISO_DY, 1, cx + 2, fy - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Pedestal (front + shadow right side)
      ctx.fillStyle = '#38403b';
      ctx.fillRect(tx + 3, tyBase - 7, 8, 7);
      fillQuad(ctx, tx + 11, tyBase - 7, tx + 14, tyBase - 11, tx + 14, tyBase - 4, tx + 11, tyBase, '#1e2420');
      // Monitor body (top face + right side + front bezel)
      fillQuad(ctx, tx, tyBase - 20, tx + 3, tyBase - 24, tx + 17, tyBase - 24, tx + 14, tyBase - 20, '#4a544e');
      fillQuad(ctx, tx + 14, tyBase - 20, tx + 17, tyBase - 24, tx + 17, tyBase - 11, tx + 14, tyBase - 7, '#1b211e');
      ctx.fillStyle = '#2b322e';
      ctx.fillRect(tx, tyBase - 20, 14, 13);
      ctx.fillStyle = '#121a14';
      ctx.fillRect(tx + 2, tyBase - 18, 10, 8);
      const blink = Math.sin(time * 5) > 0;
      ctx.fillStyle = '#e8a838';
      ctx.fillRect(tx + 3, tyBase - 16, 7, 1);
      ctx.fillRect(tx + 3, tyBase - 14, 5, 1);
      if (blink) ctx.fillRect(tx + 3, tyBase - 12, 3, 1);
      // Warm amber glow pool on floor
      if (hasFloorHere) {
        drawFloorLightPool(ctx, cx, fy, 'rgba(232, 168, 56, 0.16)', 'rgba(232, 168, 56, 0)', 12, 2.6);
      }
    } else if (d.type === 'note') {
      // Celine's bright yellow scribbled audit note pinned to the back wall
      const ny = bfy - 22;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(bx - 4, ny + 1, 10, 11);
      ctx.fillStyle = '#f2d95c';
      ctx.fillRect(bx - 5, ny, 10, 11);
      ctx.fillStyle = '#d9b538';
      ctx.fillRect(bx - 5, ny, 10, 2);
      ctx.fillStyle = '#2a3326';
      ctx.fillRect(bx - 3, ny + 4, 6, 1);
      ctx.fillRect(bx - 3, ny + 6, 5, 1);
      ctx.fillRect(bx - 3, ny + 8, 6, 1);
      ctx.fillStyle = '#d62828';
      ctx.fillRect(bx - 1, ny - 1, 2, 2);
    } else if (d.type === 'banner') {
      // Swiss banner hanging flat against the recessed back wall
      const by = bfy - 30;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(bx - 5, by + 2, 12, 21);
      ctx.fillStyle = '#4a3a22';
      ctx.fillRect(bx - 7, by - 1, 14, 2);
      ctx.fillStyle = '#8a1c22';
      ctx.fillRect(bx - 6, by, 12, 21);
      ctx.fillStyle = '#a8262e';
      ctx.fillRect(bx - 6, by, 2, 21);
      ctx.fillStyle = '#f0eee8';
      ctx.fillRect(bx - 1, by + 6, 2, 8);
      ctx.fillRect(bx - 4, by + 9, 8, 2);
    } else if (d.type === 'sign') {
      // Swiss metallic directional/warning plaque mounted on back wall (shifted +3 to avoid right wall edge)
      const sx = cx + 3;
      const sy = bfy - 24;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(sx - 11, sy + 1, 24, 11);
      ctx.fillStyle = '#18202c';
      ctx.fillRect(sx - 12, sy, 24, 11);
      ctx.strokeStyle = theme.floorTrim;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 11.5, sy + 0.5, 23, 10);
      // Mini Swiss red-cross badge on left + hazard/arrow bars on right
      ctx.fillStyle = '#c92830';
      ctx.fillRect(sx - 9, sy + 3, 5, 5);
      ctx.fillStyle = '#f5f4ef';
      ctx.fillRect(sx - 7, sy + 4, 1, 3);
      ctx.fillRect(sx - 8, sy + 5, 3, 1);
      ctx.fillStyle = '#e8c45a';
      ctx.fillRect(sx - 2, sy + 5, 8, 1);
      ctx.fillRect(sx + 4, sy + 4, 2, 3);
      ctx.fillRect(sx + 6, sy + 5, 1, 1);
      ctx.fillStyle = '#9aa8bc';
      ctx.fillRect(sx - 2, sy + 8, 9, 1);
    } else if (d.type === 'celine') {
      // 3D console pedestal behind/beside Celine resting on the floor's top face
      const px = cx + 7;
      const py = fy - 2;
      fillQuad(ctx, px, py - 17, px + 3, py - 21, px + 14, py - 21, px + 11, py - 17, '#3a4b63');
      fillQuad(ctx, px + 11, py - 17, px + 14, py - 21, px + 14, py - 4, px + 11, py, '#17202e');
      ctx.fillStyle = '#253142';
      ctx.fillRect(px, py - 17, 11, 17);
      ctx.fillStyle = '#3bd4ff';
      ctx.fillRect(px + 2, py - 15, 7, 5);
      ctx.fillStyle = '#b8f4ff';
      ctx.fillRect(px + 3, py - 14, 3, 1);
      if (hasFloorHere) {
        drawFloorLightPool(ctx, cx + 10, fy, 'rgba(59, 212, 255, 0.20)', 'rgba(59, 212, 255, 0)', 14, 3);
      }
    }
  }
}

function drawForegroundDecor(ctx, room, time) {
  for (const d of room.decor) {
    if (d.type !== 'celine') continue;
    const cx = tileCenterX(d.col);
    const fy = floorY(d.row);
    drawCharacter(ctx, {
      x: cx - 2,
      y: fy,
      facing: -1,
      palette: 'celine',
      anim: 'idle',
      animT: (time * 0.5) % 1,
      grounded: true,
      alive: true,
      hasSword: false,
      swordDrawn: false,
      hurtFlash: 0,
    }, time);
  }
}

function drawDynamicRoomElements(ctx, level, room, theme, time) {
  // Draw bottom-to-top, left-to-right so overlapping dynamic floor elements sort cleanly
  for (let r = ROWS - 1; r >= 0; r--) {
    const fy = floorY(r);
    const topY = r * TILE_H;
    const yF = fy + SLAB_FRONT_OFF;
    const yB = yF + ISO_DY;

    for (let c = 0; c < COLS; c++) {
      const ch = room.grid[r][c];
      const x = c * TILE_W;

      // 1. Loose Floor ('L') — rendered dynamically so shaking & falling never invalidate static room cache
      if (ch === 'L') {
        const l = room.loose.get(`${c},${r}`);
        if (l && l.state === 'fallen') continue;
        let shakeX = 0;
        let shakeY = 0;
        if (l && l.state === 'shaking') {
          shakeX = Math.sin(time * 55 + c) * 1.4;
          shakeY = Math.cos(time * 47) * 0.9;
        }
        const fx = Math.round(x + shakeX);
        const fyy = Math.round(fy + shakeY);

        // Dynamic back-wall AO above intact loose floor
        const fg = ctx.createLinearGradient(0, yB - 7, 0, yB + 1);
        fg.addColorStop(0, 'rgba(0,0,0,0)');
        fg.addColorStop(1, 'rgba(0,0,0,0.40)');
        ctx.fillStyle = fg;
        ctx.fillRect(fx + ISO_DX, yB - 7, TILE_W, 8);

        drawFloorSlab(ctx, level, room, c, r, fx, fyy, theme, {
          isLoose: true,
          isStaticPass: false,
          ch: 'L',
        });

        // Periodic falling dust crumb cue beneath loose floor
        const dustPhase = (time * 1.3 + c * 0.37) % 1;
        if (dustPhase < 0.6) {
          const dy = fyy + SLAB_FRONT_OFF + SLAB_FRONT_H + Math.round(dustPhase * 16);
          ctx.fillStyle = 'rgba(215, 205, 185, 0.55)';
          ctx.fillRect(fx + 10 + ((c * 5) % 12), dy, 1, 1);
        }
        continue;
      }

      // 2. Pressure plates ('P' open, 'Q' close, weighted hold-plates) — inset 3D slabs on the top face
      if (ch === 'P' || ch === 'Q') {
        const plate = room.plates.get(`${c},${r}`);
        const down = plate && plate.pressed;
        const insetL = x + 5;
        const insetW = TILE_W - 10;
        const pYF = yF - 1;
        const pYB = yB + 1.5;
        const dxS = ISO_DX * 0.68;

        // Recessed dark socket rim in the top face
        fillQuad(ctx, insetL - 1, pYF + 0.5, insetL - 1 + dxS, pYB - 0.5, insetL + insetW + 1 + dxS, pYB - 0.5, insetL + insetW + 1, pYF + 0.5, 'rgba(0,0,0,0.52)');

        // Raised / depressed 3D plate slab
        const lift = down ? 0 : 2;
        const topCol = plate && plate.hold ? '#7ce8f0' : (ch === 'Q' ? '#ff6470' : '#f2d98d');
        const faceCol = plate && plate.hold ? '#226c75' : (ch === 'Q' ? '#9c2c34' : theme.floorTrim);
        const sideCol = plate && plate.hold ? '#14444a' : (ch === 'Q' ? '#5c181e' : theme.floorDark);

        // Right shadow side of raised plate
        if (!down) {
          fillQuad(
            ctx,
            insetL + insetW, pYF - lift,
            insetL + insetW + dxS, pYB - lift,
            insetL + insetW + dxS, pYB,
            insetL + insetW, pYF,
            sideCol
          );
        }
        // Lit oblique top surface of plate + crisp 2x bevel & etched emblem
        fillQuad(
          ctx,
          insetL, pYF - lift,
          insetL + dxS, pYB - lift,
          insetL + insetW + dxS, pYB - lift,
          insetL + insetW, pYF - lift,
          topCol
        );
        drawIsoLine(ctx, insetL, pYF - lift + 0.3, insetL + insetW, pYF - lift + 0.3, 'rgba(255,255,255,0.45)', 0.5);
        // Subtle etched indicator on top face (diamond/bar/ring)
        const pmx = insetL + insetW * 0.5 + dxS * 0.5;
        const pmy = (pYF + pYB) * 0.5 - lift;
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        if (plate && plate.hold) {
          ctx.strokeStyle = 'rgba(10,45,52,0.55)';
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ctx.ellipse(pmx, pmy, 3.8, 1.3, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ch === 'Q') {
          drawIsoLine(ctx, pmx - 2.6, pmy - 0.9, pmx + 2.6, pmy + 0.9, 'rgba(85,12,18,0.65)', 0.75);
          drawIsoLine(ctx, pmx - 2.6, pmy + 0.9, pmx + 2.6, pmy - 0.9, 'rgba(85,12,18,0.65)', 0.75);
        } else {
          ctx.fillRect(pmx - 3.5, pmy - 0.4, 7, 0.8);
        }
        // Front face thickness
        ctx.fillStyle = faceCol;
        ctx.fillRect(insetL, pYF - lift, insetW, down ? 1 : 2);

        if (plate && plate.pinnedByDebris) {
          // 3D fallen masonry chunk weighting the hold-plate!
          const mx = x + 7;
          const mw = TILE_W - 14;
          const myF = yF - 1;
          const mh = 5;
          const mdx = 3.5;
          const mdy = -5;
          fillQuad(ctx, mx + mw, myF - mh, mx + mw + mdx, myF - mh + mdy, mx + mw + mdx, myF + mdy, mx + mw, myF, theme.floorSide);
          fillQuad(ctx, mx, myF - mh, mx + mdx, myF - mh + mdy, mx + mw + mdx, myF - mh + mdy, mx + mw, myF - mh, theme.floorTop);
          ctx.fillStyle = theme.floorFace;
          ctx.fillRect(mx, myF - mh, mw, mh);
          ctx.fillStyle = theme.floorEdgeBevel;
          ctx.fillRect(mx, myF - mh, mw, 1);
          ctx.fillStyle = '#090c10';
          ctx.fillRect(mx + 8, myF - mh, 1, 4);
        }
      }

      // 3. Spikes ('^') — 2 staggered rows rising out of dark holes in the floor's top face
      if (ch === '^') {
        const sp = room.spikes.get(`${c},${r}`);
        const ext = sp ? sp.extended : 0.3;
        const h = Math.max(3, Math.round(ext * 13));
        const spikeDark = mixHex(theme.spikeCol, '#141a20', 0.55);

        // Back row (2 spikes at z = 0.65) drawn first, then front row (3 spikes at z = 0.25)
        const spikeSpecs = [
          { sx: x + 10 + ISO_DX * 0.65, sy: yF + ISO_DY * 0.65, scale: 0.92 },
          { sx: x + 22 + ISO_DX * 0.65, sy: yF + ISO_DY * 0.65, scale: 0.92 },
          { sx: x + 5 + ISO_DX * 0.22,  sy: yF + ISO_DY * 0.22, scale: 1.0 },
          { sx: x + 15 + ISO_DX * 0.22, sy: yF + ISO_DY * 0.22, scale: 1.0 },
          { sx: x + 25 + ISO_DX * 0.22, sy: yF + ISO_DY * 0.22, scale: 1.0 },
        ];
        for (const s of spikeSpecs) {
          const sh = Math.max(2, Math.round(h * s.scale));
          // Beveled recessed socket hole in the floor top face
          ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.beginPath();
          ctx.ellipse(s.sx + 2.2, s.sy + 0.35, 3.0, 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(4, 6, 9, 0.88)';
          ctx.beginPath();
          ctx.ellipse(s.sx + 2.2, s.sy, 2.7, 1.05, 0, 0, Math.PI * 2);
          ctx.fill();
          // 3-facet honed 2x metallic spike: bright bevel + mid face + shaded right facet
          ctx.fillStyle = mixHex(theme.spikeCol, '#ffffff', 0.32);
          ctx.beginPath();
          ctx.moveTo(s.sx, s.sy);
          ctx.lineTo(s.sx + 2.2, s.sy - sh);
          ctx.lineTo(s.sx + 1.25, s.sy);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = theme.spikeCol;
          ctx.beginPath();
          ctx.moveTo(s.sx + 1.25, s.sy);
          ctx.lineTo(s.sx + 2.2, s.sy - sh);
          ctx.lineTo(s.sx + 2.45, s.sy);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = spikeDark;
          ctx.beginPath();
          ctx.moveTo(s.sx + 2.45, s.sy);
          ctx.lineTo(s.sx + 2.2, s.sy - sh);
          ctx.lineTo(s.sx + 4.4, s.sy);
          ctx.closePath();
          ctx.fill();

          // Sharp metallic ridge highlight & tip glint
          drawIsoLine(ctx, s.sx + 1.4, s.sy, s.sx + 2.2, s.sy - sh, 'rgba(255,255,255,0.65)', 0.5);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(s.sx + 2.2, s.sy - sh + 0.5, 0.65, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Exit Door ('E') — deeply recessed into the back wall with thick 3D stone/brass surround
      if (ch === 'E') {
        const ex = level.getExitAt(room.id, c, r);
        const openAmt = ex ? ex.openAmount : 0;
        const dw = 20;
        const dh = 32;
        const dx = x + 6 + Math.round(ISO_DX * 0.35);
        const dyBot = yB;
        const dy = dyBot - dh;

        // Thick 3D outer surround frame (5px protruding masonry/brass portal with lit top & right faces)
        const fL = dx - 4;
        const fT = dy - 4;
        const fW = dw + 8;
        const fH = dh + 4;
        const fDx = 5;
        const fDy = -4;
        // Lit top lintel return
        fillQuad(ctx, fL, fT, fL + fDx, fT + fDy, fL + fW + fDx, fT + fDy, fL + fW, fT, mixHex(theme.exitFrame, '#ffffff', 0.24));
        // Lit right outer jamb return (consistent with top-right-front light)
        const rg = ctx.createLinearGradient(fL + fW, fT, fL + fW + fDx, fT);
        rg.addColorStop(0, mixHex(theme.exitFrame, '#ffffff', 0.14));
        rg.addColorStop(1, mixHex(theme.exitFrame, '#080a0c', 0.38));
        fillQuad(ctx, fL + fW, fT, fL + fW + fDx, fT + fDy, fL + fW + fDx, dyBot + fDy, fL + fW, dyBot, rg);
        // Front surround casing
        ctx.fillStyle = theme.exitFrame;
        ctx.fillRect(fL, fT, fW, fH);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(fL, fT, fW, 1);
        ctx.fillRect(fL + fW - 1, fT, 1, fH);
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(fL, fT, 1, fH);

        // Deep recessed doorway cavity
        ctx.fillStyle = openAmt > 0.1 ? '#293e52' : theme.exitInner;
        ctx.fillRect(dx, dy, dw, dh);

        // Deep shadowed inner jamb reveal (5px top soffit & 4px left jamb angled into the back wall!)
        fillQuad(ctx, dx, dy, dx + dw, dy, dx + dw - 2, dy + 4, dx + 4, dy + 4, 'rgba(0,0,0,0.62)');
        fillQuad(ctx, dx, dy, dx + 4, dy + 4, dx + 4, dyBot, dx, dyBot, 'rgba(0,0,0,0.52)');

        // Warm interior glow when open + trapezoid light spill onto floor top face
        if (openAmt > 0.15) {
          const g = ctx.createLinearGradient(dx, dy, dx, dyBot);
          g.addColorStop(0, `rgba(255, 224, 130, ${(0.52 * openAmt).toFixed(2)})`);
          g.addColorStop(1, `rgba(120, 210, 255, ${(0.30 * openAmt).toFixed(2)})`);
          ctx.fillStyle = g;
          ctx.fillRect(dx + 3, dy + 3, dw - 4, dh - 3);

          const lg = ctx.createLinearGradient(0, yB, 0, yF);
          lg.addColorStop(0, `rgba(255, 224, 140, ${(0.34 * openAmt).toFixed(2)})`);
          lg.addColorStop(1, 'rgba(255, 224, 140, 0)');
          fillQuad(ctx, dx - 6, yF, dx, yB, dx + dw, yB, dx + dw - 4, yF, lg);
        }

        // Recessed threshold step shadow on floor top face
        fillQuad(ctx, dx - 2, yB + 2, dx, yB, dx + dw, yB, dx + dw - 2, yB + 2, 'rgba(0,0,0,0.46)');

        // Sliding armored door leaf inside recess (2x recessed panels + rivets + Swiss medallion)
        const leafH = Math.round(dh * (1 - openAmt));
        if (leafH > 1) {
          ctx.fillStyle = theme.wallFill;
          ctx.fillRect(dx + 2, dy + 2, dw - 2, Math.max(1, leafH - 2));
          if (leafH > 10) {
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 0.6;
            ctx.strokeRect(dx + 3.5, dy + 3.5, dw - 5, Math.max(2, leafH - 6.5));
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.moveTo(dx + 3.5, dy + 3.5);
            ctx.lineTo(dx + dw - 1.5, dy + 3.5);
            ctx.stroke();
          }
          ctx.fillStyle = theme.exitFrame;
          ctx.fillRect(dx + 2.5, dy + Math.max(2, leafH - 2.5), dw - 3, 2);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(dx + 2.5, dy + Math.max(2, leafH - 2.5), dw - 3, 0.5);
          if (leafH > 18) {
            const emX = Math.round(dx + dw / 2 + 1);
            const emY = dy + 8;
            ctx.fillStyle = '#181a1f';
            ctx.fillRect(emX - 4.5, emY - 0.5, 9, 9);
            ctx.fillStyle = '#c92830';
            ctx.fillRect(emX - 4, emY, 8, 8);
            ctx.fillStyle = '#f5f4ef';
            ctx.fillRect(emX - 1, emY + 1.5, 2, 5);
            ctx.fillRect(emX - 2.5, emY + 3, 5, 2);
          }
        }
      }

      // 5. Back-half of Gate ('G') — oblique floor groove + thick recessed back jamb column
      if (ch === 'G') {
        const cx = tileCenterX(c);
        drawIsoLine(ctx, cx - 1, yF, cx - 1 + ISO_DX, yB, 'rgba(4, 6, 9, 0.78)', 2.5);
        // Thick recessed back gate pillar anchored at the back wall plane (z = 1)
        const bx = cx + ISO_DX;
        const bTop = Math.max(topY, topY + ISO_DY + 4);
        ctx.fillStyle = theme.recessDark;
        ctx.fillRect(bx - 3, bTop, 6, yB - bTop);
        ctx.fillStyle = theme.wallSideMid;
        ctx.fillRect(bx + 1, bTop, 2, yB - bTop);
        ctx.fillStyle = theme.wallDark;
        ctx.fillRect(bx - 3, bTop, 2, yB - bTop);
      }

      // 6. Back-half of Slicer ('C') — oblique floor emitter trench + thick back guide rail
      if (ch === 'C') {
        const cx = tileCenterX(c);
        drawIsoLine(ctx, cx, yF, cx + ISO_DX, yB, '#0a1220', 3.5);
        drawIsoLine(ctx, cx - 1, yF, cx - 1 + ISO_DX, yB, '#3a5578', 1);
        const bx = cx + ISO_DX;
        const bTop = Math.max(topY, topY + ISO_DY + 4);
        ctx.fillStyle = '#182436';
        ctx.fillRect(bx - 2, bTop, 5, yB - bTop);
        ctx.fillStyle = '#48668f';
        ctx.fillRect(bx + 1, bTop, 2, yB - bTop);
      }

      // 7. Back-half of Mirror / CERN Quantum Detector ('M')
      if (ch === 'M' && room.mirror && !room.mirror.broken) {
        const mx = tileCenterX(c);
        const mh = 36;
        const bx = mx + ISO_DX;
        ctx.fillStyle = '#1a3150';
        ctx.fillRect(bx - 2, yB - mh, 4, mh);
        drawIsoLine(ctx, mx, yF, mx + ISO_DX, yB, '#2d4e78', 4);
      }
    }
  }
}

function drawForegroundSlabFronts(ctx, level, room, player, theme, time) {
  const skipLedge = (player.state === 'hang' || player.state === 'climb_up' || player.state === 'climb_down')
    ? player.hangLedge
    : null;

  for (let r = ROWS - 1; r >= 0; r--) {
    const fy = floorY(r);
    for (let c = 0; c < COLS; c++) {
      const ch = room.grid[r][c];
      if (ch === '.' || ch === '#') continue;
      if (skipLedge && skipLedge.ledgeRoomId === room.id && skipLedge.col === c && skipLedge.row === r) {
        continue;
      }
      const edgeFlags = getSlabEdgeFlags(level, room, c, r);
      const leftCh = level.getTile(room.id, c - 1, r);
      const leftHasFloor = leftCh !== '.' && leftCh !== '#';
      const extraRightW = tileHasLeftReveal(level, room, c + 1, r) ? WALL_REVEAL_L : 0;
      if (ch === 'L') {
        const l = room.loose.get(`${c},${r}`);
        if (l && l.state === 'fallen') continue;
        let shakeX = 0;
        let shakeY = 0;
        if (l && l.state === 'shaking') {
          shakeX = Math.sin(time * 55 + c) * 1.4;
          shakeY = Math.cos(time * 47) * 0.9;
        }
        drawFloorSlabFront(ctx, Math.round(c * TILE_W + shakeX), Math.round(fy + shakeY), theme, {
          isLoose: true,
          leftHasFloor,
          extraRightW,
          ...edgeFlags,
        });
      } else {
        drawFloorSlabFront(ctx, c * TILE_W, fy, theme, {
          isLoose: false,
          leftHasFloor,
          extraRightW,
          ...edgeFlags,
        });
      }
    }
  }
}

function drawRoomForegroundTraps(ctx, level, room, theme, time) {
  // 1. Gates — 3D oblique portcullis bars set deep inside a thick 9px extruded stone/iron frame
  for (const g of room.gates) {
    const cx = tileCenterX(g.col);
    const fy = floorY(g.row);
    const topY = g.row * TILE_H;
    const yF = fy + SLAB_FRONT_OFF;
    const aboveOpen = level.getTile(room.id, g.col, g.row - 1) === '.';
    const totalH = (yF - 4) - topY;
    const closedH = Math.max(5, Math.round(totalH * (1 - g.openAmount * 0.85)));

    ctx.save();
    if (!aboveOpen) {
      ctx.beginPath();
      ctx.rect(0, topY, VIEW_W, PLAY_H - topY);
      ctx.clip();
    }

    // 4 heavy cylindrical-shaded vertical portcullis bars across the full 9px oblique depth
    const barFracs = [0.88, 0.62, 0.36, 0.12];
    for (const z of barFracs) {
      const bx = cx - 1 + z * ISO_DX;
      const bTop = topY + 4 + z * ISO_DY;
      const bLen = Math.max(2, closedH - 4);
      ctx.fillStyle = '#12171d';
      ctx.fillRect(bx, bTop, 2.2, bLen);
      ctx.fillStyle = z < 0.5 ? theme.gateBar : mixHex(theme.gateBar, '#0d1015', 0.35);
      ctx.fillRect(bx + 0.6, bTop, 1.2, bLen);
      ctx.fillStyle = z < 0.5 ? theme.gateHi : theme.gateBar;
      ctx.fillRect(bx + 1.3, bTop, 0.55, bLen);
    }

    // Slanted oblique structural cross-brace (when lowered enough)
    if (closedH > 18) {
      const midY = topY + Math.floor(closedH * 0.48);
      drawIsoLine(ctx, cx - 2, midY + 1, cx + ISO_DX + 1, midY + 1 + ISO_DY, '#141a22', 2.6);
      drawIsoLine(ctx, cx - 2, midY + 0.2, cx + ISO_DX + 1, midY + 0.2 + ISO_DY, theme.gateBar, 1.3);
      drawIsoLine(ctx, cx - 2, midY - 0.3, cx + ISO_DX + 1, midY - 0.3 + ISO_DY, theme.gateHi, 0.6);
    }

    // Heavy slanted bottom lock bar + faceted pointed portcullis teeth seated in floor groove
    const botY = topY + closedH - 1;
    drawIsoLine(ctx, cx - 2, botY + 1, cx + ISO_DX + 1, botY + 1 + ISO_DY, '#141a22', 2.8);
    drawIsoLine(ctx, cx - 2, botY, cx + ISO_DX + 1, botY + ISO_DY, theme.gateHi, 0.9);
    for (const z of barFracs) {
      const bx = cx - 1 + z * ISO_DX;
      const ty = botY + 0.8 + z * ISO_DY;
      ctx.fillStyle = '#b9c6d4';
      ctx.beginPath();
      ctx.moveTo(bx + 0.2, ty);
      ctx.lineTo(bx + 1.1, ty + 3.4);
      ctx.lineTo(bx + 2.0, ty);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(bx + 0.5, ty);
      ctx.lineTo(bx + 1.1, ty + 3.4);
      ctx.lineTo(bx + 1.1, ty);
      ctx.closePath();
      ctx.fill();
    }

    // Thick 3D overhead lintel housing (extruded 9px right-side + front riveted face)
    const lx = cx - 6;
    const lw = 11;
    const lh = 6;
    if (aboveOpen) {
      fillQuad(ctx, lx, topY, lx + ISO_DX, topY + ISO_DY, lx + lw + ISO_DX, topY + ISO_DY, lx + lw, topY, theme.wallTop);
    }
    const lg = ctx.createLinearGradient(lx + lw, topY, lx + lw + ISO_DX, topY);
    lg.addColorStop(0, theme.wallSideLit);
    lg.addColorStop(1, theme.wallSideBack);
    fillQuad(ctx, lx + lw, topY, lx + lw + ISO_DX, topY + ISO_DY, lx + lw + ISO_DX, topY + lh + ISO_DY, lx + lw, topY + lh, lg);
    ctx.fillStyle = theme.wallFill;
    ctx.fillRect(lx, topY, lw, lh);
    ctx.fillStyle = theme.wallArrisHi;
    ctx.fillRect(lx + lw - 1, topY, 1, lh);
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(lx, topY + lh - 1, lw, 1);
    ctx.fillStyle = theme.gateHi;
    ctx.fillRect(lx + 2, topY + 2, 1, 1);
    ctx.fillRect(lx + lw - 3, topY + 2, 1, 1);

    // Thick 3px front gate jamb pillar at z = 0 (with lit right edge so frame feels truly thick)
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(cx - 5, topY + lh, 3, yF - (topY + lh));
    ctx.fillStyle = theme.wallFill;
    ctx.fillRect(cx - 4, topY + lh, 1, yF - (topY + lh));
    ctx.fillStyle = theme.wallHi;
    ctx.fillRect(cx - 3, topY + lh, 1, yF - (topY + lh));

    ctx.restore();
  }

  // 2. Slicers / CERN Beam Shutters — 9px oblique depth jaws, glowing blade plane & thick emitter housing
  for (const s of room.slicers.values()) {
    const cx = tileCenterX(s.col);
    const fy = floorY(s.row);
    const topY = s.row * TILE_H;
    const yF = fy + SLAB_FRONT_OFF;
    const yB = yF + ISO_DY;
    const spanH = yF - topY;
    const aboveOpen = level.getTile(room.id, s.col, s.row - 1) === '.';
    const st = level.getSlicerState(room.id, s.col, s.row, time);

    ctx.save();
    if (!aboveOpen) {
      ctx.beginPath();
      ctx.rect(0, topY, VIEW_W, PLAY_H - topY);
      ctx.clip();
    }

    if (st.closed) {
      fillQuad(
        ctx,
        cx - 2, topY + 5,
        cx + ISO_DX + 2, topY + 5 + ISO_DY,
        cx + ISO_DX + 2, yB - 2,
        cx - 2, yF - 3,
        'rgba(255, 66, 110, 0.36)'
      );
      fillQuad(
        ctx,
        cx - 1, topY + 5,
        cx + ISO_DX, topY + 5 + ISO_DY,
        cx + ISO_DX, yB - 2,
        cx - 1, yF - 3,
        theme.slicerCol
      );
      drawIsoLine(ctx, cx, topY + 5, cx, yF - 3, '#ffffff', 1.6);
      drawIsoLine(ctx, cx + ISO_DX * 0.5, topY + 5 + ISO_DY * 0.5, cx + ISO_DX * 0.5, yF - 3 + ISO_DY * 0.5, 'rgba(255,255,255,0.75)', 1);
    } else if (st.warning) {
      const jaw = Math.round((1 - st.openness) * 16);
      fillQuad(ctx, cx - 2, topY + 5, cx + ISO_DX, topY + 5 + ISO_DY, cx + ISO_DX, topY + 5 + jaw + ISO_DY, cx - 2, topY + 5 + jaw, theme.slicerCol);
      fillQuad(ctx, cx - 2, yF - 3 - jaw, cx + ISO_DX, yB - 2 - jaw, cx + ISO_DX, yB - 2, cx - 2, yF - 3, theme.slicerCol);
      drawIsoLine(ctx, cx + 1, topY + 5, cx + 1, yF - 3, 'rgba(255, 90, 120, 0.65)', 1.5);
    } else {
      ctx.fillStyle = 'rgba(80, 210, 255, 0.28)';
      for (let y = topY + 8; y < yF - 5; y += 5) {
        ctx.fillRect(cx, y, 1, 2);
        ctx.fillRect(cx + 4, y - 4, 1, 2);
      }
    }

    // Thick 9px-deep emitter housings (top & bottom) with lit right side face
    const hx = cx - 4;
    const hw = 8;
    if (aboveOpen) {
      fillQuad(ctx, hx, topY, hx + ISO_DX, topY + ISO_DY, hx + hw + ISO_DX, topY + ISO_DY, hx + hw, topY, '#496894');
    }
    fillQuad(ctx, hx + hw, topY, hx + hw + ISO_DX, topY + ISO_DY, hx + hw + ISO_DX, topY + 5 + ISO_DY, hx + hw, topY + 5, '#344c6e');
    ctx.fillStyle = '#182233';
    ctx.fillRect(hx, topY, hw, 5);
    ctx.fillStyle = '#688ab8';
    ctx.fillRect(hx + hw - 1, topY, 1, 5);
    ctx.fillStyle = '#527099';
    ctx.fillRect(hx, topY + 4, hw, 1);

    fillQuad(ctx, hx, yF - 3, hx + ISO_DX, yB - 3, hx + hw + ISO_DX, yB - 3, hx + hw, yF - 3, '#496894');
    fillQuad(ctx, hx + hw, yF - 3, hx + hw + ISO_DX, yB - 3, hx + hw + ISO_DX, yB, hx + hw, yF, '#344c6e');
    ctx.fillStyle = '#182233';
    ctx.fillRect(hx, yF - 3, hw, 3);
    ctx.fillStyle = '#688ab8';
    ctx.fillRect(hx + hw - 1, yF - 3, 1, 3);

    // Permanent front vertical guide rail
    ctx.fillStyle = '#26344a';
    ctx.fillRect(cx - 3, topY + 5, 2, spanH - 8);
    ctx.fillStyle = '#688ab8';
    ctx.fillRect(cx - 2, topY + 5, 1, spanH - 8);

    // Status LEDs (top, rail center, bottom)
    const ledCol = st.closed ? '#ff3355' : st.warning ? '#ffcc33' : '#40d8ff';
    ctx.fillStyle = ledCol;
    ctx.fillRect(cx - 2, topY + 1, 4, 2);
    ctx.fillRect(cx - 3, topY + Math.floor(spanH * 0.5), 1, 2);
    ctx.fillRect(cx - 2, yF - 2, 4, 1);

    ctx.restore();
  }

  // 3. Mirror / CERN Quantum Detector Portal front plane
  if (room.mirror && !room.mirror.broken) {
    const mx = tileCenterX(room.mirror.col);
    const fy = floorY(room.mirror.row);
    const yF = fy + SLAB_FRONT_OFF;
    const yB = yF + ISO_DY;
    const mh = 36;
    const shimmer = 0.48 + 0.30 * Math.sin(time * 5);

    // Translucent oblique quantum plane spanning front to back
    fillQuad(
      ctx,
      mx, yF - mh,
      mx + ISO_DX, yB - mh,
      mx + ISO_DX, yB,
      mx, yF,
      `rgba(110, 232, 255, ${shimmer.toFixed(2)})`
    );
    // Animated oblique scanline sweeping vertically through the portal
    const scanOff = Math.floor((time * 30) % (mh - 4));
    drawIsoLine(ctx, mx, yF - mh + 2 + scanOff, mx + ISO_DX, yB - mh + 2 + scanOff, '#ffffff', 1.5);
    // Top cap + front detector post
    drawIsoLine(ctx, mx, yF - mh, mx + ISO_DX, yB - mh, '#5ca8e0', 2);
    ctx.fillStyle = '#2d4e78';
    ctx.fillRect(mx - 2, yF - mh, 3, mh);
    ctx.fillStyle = '#8ad4f5';
    ctx.fillRect(mx - 2, yF - mh, 1, mh);
  }
}

function drawWindOverlay(ctx, level, room, time) {
  if (!room.wind) return;
  const ws = level.getWindState(room.id, time);
  if (!ws.active && !ws.warning) return;

  const dir = ws.dir;
  const cols = ws.cols;
  const minX = cols ? Math.min(...cols) * TILE_W : 0;
  const maxX = cols ? (Math.max(...cols) + 1) * TILE_W : VIEW_W;
  const spanW = Math.max(32, maxX - minX);

  ctx.save();
  ctx.beginPath();
  ctx.rect(minX, 0, spanW, PLAY_H);
  ctx.clip();

  const count = ws.active ? 26 : 10;
  const speed = ws.active ? 260 : 95;
  const alpha = ws.active ? 0.55 * ws.strength : 0.26;
  const len = ws.active ? 18 : 8;

  ctx.fillStyle = ws.active ? `rgba(220, 242, 255, ${alpha.toFixed(3)})` : `rgba(185, 220, 248, ${alpha.toFixed(3)})`;
  for (let i = 0; i < count; i++) {
    const seedX = (i * 73) % spanW;
    const seedY = (i * 37 + 11) % (PLAY_H - 12);
    const offset = ((time * speed * dir + seedX) % (spanW + len) + (spanW + len)) % (spanW + len);
    const sx = minX + offset - len;
    ctx.fillRect(Math.round(sx), Math.round(seedY + Math.sin(time * 8 + i) * 1.5), len, 1);
  }

  // Crisp wind direction indicator pill at top of wind zone
  const label = ws.active
    ? (dir > 0 ? 'FOEHN >>>' : '<<< FOEHN')
    : (dir > 0 ? 'GUST >' : '< GUST');
  drawPixelText(ctx, label, minX + spanW / 2, 12, {
    color: ws.active ? '#dff4ff' : '#96bad6',
    align: 'center',
    shadow: '#08101c',
  });
  ctx.restore();
}

function drawItems(ctx, room, time) {
  for (const it of room.items) {
    if (it.collected) continue;
    // Rest item squarely on the floor's top face (slightly back from front edge)
    const x = Math.round(it.x + 1.5);
    const y = Math.round(it.y - 1);
    const bob = Math.sin(time * 4 + it.col) * 0.65;

    if (it.type === 'sword') {
      // Skewed contact shadow on top face
      ctx.save();
      ctx.transform(1, 0, ISO_DX / ISO_DY, 1, x + 0.5, y + 0.4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12.2, 2.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Stepped 3D stone plinth with velvet trim resting on top face
      fillQuad(ctx, x - 9.5, y - 1, x - 7.5, y - 4, x + 11.5, y - 4, x + 9.5, y - 1, '#5e513b');
      fillQuad(ctx, x + 9.5, y - 1, x + 11.5, y - 4, x + 11.5, y - 1.5, x + 9.5, y + 1.5, '#221c14');
      ctx.fillStyle = '#3b3123';
      ctx.fillRect(x - 9.5, y - 1, 19, 2.5);
      ctx.fillStyle = 'rgba(255, 240, 200, 0.25)';
      ctx.fillRect(x - 9.5, y - 1, 19, 0.5);
      // Crimson velvet strip on plinth top
      fillQuad(ctx, x - 7, y - 1.5, x - 5.8, y - 3.3, x + 9.2, y - 3.3, x + 8, y - 1.5, '#7a1c22');

      // Ceremonial Guild Sabre with fuller shade, gold knuckle-bow hilt, and diamond glint
      const sy0 = y - 3.2 + bob * 0.35;
      const sy1 = y - 6.4 + bob * 0.35;
      ctx.strokeStyle = '#9db0c4';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(x - 7.5, sy0);
      ctx.quadraticCurveTo(x + 1.5, sy0 - 1.0, x + 10.5, sy1);
      ctx.stroke();
      ctx.strokeStyle = '#f2f7ff';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 7.5, sy0 - 0.45);
      ctx.quadraticCurveTo(x + 1.5, sy0 - 1.45, x + 10.5, sy1 - 0.2);
      ctx.stroke();
      // Ornate gold D-guard hilt & pommel
      ctx.strokeStyle = '#e5b847';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x - 7.8, sy0 - 2.3);
      ctx.lineTo(x - 7.0, sy0 + 2.1);
      ctx.stroke();
      ctx.strokeStyle = '#6b4c16';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 7.4, sy0);
      ctx.lineTo(x - 10.6, sy0 + 0.6);
      ctx.stroke();
      ctx.strokeStyle = '#f7d979';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x - 7.0, sy0 + 2.0);
      ctx.quadraticCurveTo(x - 9.5, sy0 + 2.6, x - 10.8, sy0 + 0.6);
      ctx.stroke();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(x - 10.8, sy0 + 0.6, 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Shimmering 4-point diamond star glint
      const gl = 0.5 + 0.5 * Math.sin(time * 5.2);
      if (gl > 0.55) {
        const sr = (gl - 0.55) * 8.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + 3.5, sy1 - 0.5 - sr);
        ctx.lineTo(x + 3.5 + sr * 0.25, sy1 - 0.5 - sr * 0.25);
        ctx.lineTo(x + 3.5 + sr, sy1 - 0.5);
        ctx.lineTo(x + 3.5 + sr * 0.25, sy1 - 0.5 + sr * 0.25);
        ctx.lineTo(x + 3.5, sy1 - 0.5 + sr);
        ctx.lineTo(x + 3.5 - sr * 0.25, sy1 - 0.5 + sr * 0.25);
        ctx.lineTo(x + 3.5 - sr, sy1 - 0.5);
        ctx.lineTo(x + 3.5 - sr * 0.25, sy1 - 0.5 - sr * 0.25);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // 2x Rounded Glass Elixir Flask sitting on top face: small (crimson), large (gold-rimmed), poison (cyan-blue)
      const isLarge = it.type === 'large_elixir';
      const isPoison = it.type === 'poison';
      const fill = isPoison ? '#3a86e8' : '#de2c3d';
      const dark = isPoison ? '#1c4480' : '#851621';
      const hi = isPoison ? '#b0e0ff' : '#ffa6b0';
      const rx = isLarge ? 3.8 : 2.7;
      const ry = isLarge ? 4.2 : 3.0;
      const cy = y - ry + 0.2;

      // Skewed floor contact shadow + soft colored light pool on top face
      ctx.save();
      ctx.transform(1, 0, ISO_DX / ISO_DY, 1, x + 0.5, y + 0.5);
      const lg = ctx.createRadialGradient(0, 0, 0.5, 0, 0, isLarge ? 9.5 : 7.0);
      lg.addColorStop(0, isPoison ? 'rgba(65,155,255,0.34)' : 'rgba(255,70,90,0.34)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.scale(1, 0.32);
      ctx.beginPath();
      ctx.arc(0, 0, isLarge ? 9.5 : 7.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.40)';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + 0.8, rx * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Glass body (shaded spherical/teardrop flask)
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x - 0.5, cy, rx * 0.86, ry * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glass neck & cork stopper
      ctx.fillStyle = '#c8d6e4';
      ctx.fillRect(x - 1.15, cy - ry - 1.8, 2.3, 2.2);
      ctx.fillStyle = '#8b6844';
      ctx.fillRect(x - 0.85, cy - ry - 2.8, 1.7, 1.2);
      // Curved glass specular highlight
      ctx.strokeStyle = hi;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x - 0.2, cy, rx * 0.62, Math.PI * 0.95, Math.PI * 1.48);
      ctx.stroke();
      // Large elixir ornate gold collar + bright glint
      if (isLarge) {
        ctx.fillStyle = '#f2c94c';
        ctx.fillRect(x - 1.7, cy - ry - 0.3, 3.4, 1.0);
        ctx.fillStyle = '#fff5c2';
        ctx.fillRect(x - 1.4, cy - ry - 0.3, 1.4, 0.45);
      }
      // Subtle animated inner shimmer bubble
      const bY = cy + ry * 0.3 - ((time * 4 + it.col) % (ry * 0.9));
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(x + 0.4, bY, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Crisp 4x6 Pixel Bitmap Font (zero subpixel blur at any integer scale!)
// Each glyph is 6 rows x 4 pixels wide (MSB = left pixel), advance = 5px * scale.
// ---------------------------------------------------------------------------

const PIXEL_FONT = {
  ' ': [0, 0, 0, 0, 0, 0],
  'A': [0x6, 0x9, 0x9, 0xF, 0x9, 0x9],
  'B': [0xE, 0x9, 0xE, 0x9, 0x9, 0xE],
  'C': [0x7, 0x8, 0x8, 0x8, 0x8, 0x7],
  'D': [0xE, 0x9, 0x9, 0x9, 0x9, 0xE],
  'E': [0xF, 0x8, 0xE, 0x8, 0x8, 0xF],
  'F': [0xF, 0x8, 0xE, 0x8, 0x8, 0x8],
  'G': [0x7, 0x8, 0xB, 0x9, 0x9, 0x7],
  'H': [0x9, 0x9, 0xF, 0x9, 0x9, 0x9],
  'I': [0xE, 0x4, 0x4, 0x4, 0x4, 0xE],
  'J': [0x7, 0x2, 0x2, 0x2, 0xA, 0x4],
  'K': [0x9, 0xA, 0xC, 0xA, 0x9, 0x9],
  'L': [0x8, 0x8, 0x8, 0x8, 0x8, 0xF],
  'M': [0x9, 0xF, 0xF, 0x9, 0x9, 0x9],
  'N': [0x9, 0xD, 0xF, 0xB, 0x9, 0x9],
  'O': [0x6, 0x9, 0x9, 0x9, 0x9, 0x6],
  'P': [0xE, 0x9, 0x9, 0xE, 0x8, 0x8],
  'Q': [0x6, 0x9, 0x9, 0xB, 0xA, 0x5],
  'R': [0xE, 0x9, 0x9, 0xE, 0xA, 0x9],
  'S': [0x7, 0x8, 0x6, 0x1, 0x9, 0x6],
  'T': [0xF, 0x4, 0x4, 0x4, 0x4, 0x4],
  'U': [0x9, 0x9, 0x9, 0x9, 0x9, 0x6],
  'V': [0x9, 0x9, 0x9, 0x9, 0x6, 0x6],
  'W': [0x9, 0x9, 0x9, 0xF, 0xF, 0x9],
  'X': [0x9, 0x9, 0x6, 0x6, 0x9, 0x9],
  'Y': [0x9, 0x9, 0x6, 0x4, 0x4, 0x4],
  'Z': [0xF, 0x1, 0x2, 0x4, 0x8, 0xF],
  '0': [0x6, 0x9, 0xB, 0xD, 0x9, 0x6],
  '1': [0x4, 0xC, 0x4, 0x4, 0x4, 0xE],
  '2': [0x6, 0x9, 0x2, 0x4, 0x8, 0xF],
  '3': [0xE, 0x1, 0x6, 0x1, 0x9, 0x6],
  '4': [0x9, 0x9, 0xF, 0x1, 0x1, 0x1],
  '5': [0xF, 0x8, 0xE, 0x1, 0x9, 0x6],
  '6': [0x6, 0x8, 0xE, 0x9, 0x9, 0x6],
  '7': [0xF, 0x1, 0x2, 0x4, 0x4, 0x4],
  '8': [0x6, 0x9, 0x6, 0x9, 0x9, 0x6],
  '9': [0x6, 0x9, 0x7, 0x1, 0x9, 0x6],
  ':': [0x0, 0x4, 0x0, 0x0, 0x4, 0x0],
  '.': [0x0, 0x0, 0x0, 0x0, 0x0, 0x4],
  ',': [0x0, 0x0, 0x0, 0x0, 0x4, 0x8],
  '!': [0x4, 0x4, 0x4, 0x4, 0x0, 0x4],
  '?': [0x6, 0x9, 0x2, 0x4, 0x0, 0x4],
  '-': [0x0, 0x0, 0xE, 0x0, 0x0, 0x0],
  '+': [0x0, 0x4, 0xE, 0x4, 0x0, 0x0],
  '/': [0x1, 0x2, 0x2, 0x4, 0x4, 0x8],
  '\'': [0x4, 0x4, 0x0, 0x0, 0x0, 0x0],
  '"': [0xA, 0xA, 0x0, 0x0, 0x0, 0x0],
  '(': [0x2, 0x4, 0x4, 0x4, 0x4, 0x2],
  ')': [0x4, 0x2, 0x2, 0x2, 0x2, 0x4],
  '>': [0x8, 0x4, 0x2, 0x4, 0x8, 0x0],
  '<': [0x2, 0x4, 0x8, 0x4, 0x2, 0x0],
  '|': [0x4, 0x4, 0x4, 0x4, 0x4, 0x4],
  '&': [0x6, 0x9, 0x6, 0xA, 0x9, 0x7],
  '_': [0x0, 0x0, 0x0, 0x0, 0x0, 0xF],
};

function sanitizePixelText(text) {
  return String(text || '')
    .replace(/[—–]/g, '-')
    .replace(/[’‘]/g, '\'')
    .replace(/[“”]/g, '"')
    .toUpperCase();
}

function wrapPixelText(text, maxChars = 64) {
  const clean = sanitizePixelText(text);
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawPixelText(ctx, text, x, y, opts = {}) {
  const str = sanitizePixelText(text);
  if (!str) return;
  const scale = opts.scale || 1;
  const color = opts.color || '#f3f1ea';
  const align = opts.align || 'left';
  const baseline = opts.baseline || 'top';
  const shadow = opts.shadow || null;
  const step = 5 * scale;
  const totalW = str.length * step - scale;
  const totalH = 6 * scale;

  let ox = Math.round(x);
  let oy = Math.round(y);
  if (align === 'center') ox = Math.round(x - totalW / 2);
  else if (align === 'right') ox = Math.round(x - totalW);
  if (baseline === 'middle') oy = Math.round(y - totalH / 2);
  else if (baseline === 'bottom') oy = Math.round(y - totalH);

  const renderPass = (dx, dy, fill) => {
    ctx.fillStyle = fill;
    let cx = ox + dx;
    for (let i = 0; i < str.length; i++) {
      const glyph = PIXEL_FONT[str[i]] || PIXEL_FONT[' '];
      for (let row = 0; row < 6; row++) {
        const bits = glyph[row];
        if (!bits) continue;
        for (let col = 0; col < 4; col++) {
          if (bits & (8 >> col)) {
            ctx.fillRect(cx + col * scale, oy + dy + row * scale, scale, scale);
          }
        }
      }
      cx += step;
    }
  };

  if (shadow) renderPass(scale, scale, shadow);
  renderPass(0, 0, color);
}

function drawHUD(ctx, game) {
  const { player, level, enemies } = game;
  const y0 = PLAY_H;

  // Background bar
  ctx.fillStyle = '#090b0f';
  ctx.fillRect(0, y0, VIEW_W, HUD_H);
  ctx.fillStyle = '#252b36';
  ctx.fillRect(0, y0, VIEW_W, 1);

  // Left: Player health pips (beveled Swiss red squares with crisp white cross)
  const startX = 8;
  const pipY = y0 + 8;
  for (let i = 0; i < player.maxHp; i++) {
    const px = startX + i * 11;
    if (i < player.hp) {
      ctx.fillStyle = '#99181b';
      ctx.fillRect(px, pipY, 8, 8);
      ctx.fillStyle = '#d9282c';
      ctx.fillRect(px, pipY, 8, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(px, pipY, 8, 0.75);
      ctx.fillStyle = '#f5f4ef';
      ctx.fillRect(px + 3, pipY + 1.75, 2, 4.5);
      ctx.fillRect(px + 1.75, pipY + 3, 4.5, 2);
    } else {
      ctx.fillStyle = 'rgba(40, 18, 22, 0.5)';
      ctx.fillRect(px + 0.5, pipY + 0.5, 7, 7);
      ctx.strokeStyle = '#633036';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(px + 0.5, pipY + 0.5, 7, 7);
    }
  }

  // Sword / God tiny status badges beside HP
  let badgeX = startX + player.maxHp * 11 + 6;
  if (player.hasSword) {
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(badgeX, pipY + 3, 2, 3);
    ctx.fillStyle = '#dde7f2';
    ctx.fillRect(badgeX + 2, pipY + 4, 7, 1);
    badgeX += 13;
  }
  if (game.godMode) {
    drawPixelText(ctx, 'GOD', badgeX, y0 + 12, { color: '#f2c94c', baseline: 'middle' });
  }

  // Center: Swiss Railway Station Clock + Time / Level badge
  const mins = Math.floor(game.timeRemaining / 60);
  const secs = Math.floor(game.timeRemaining % 60);
  const clockStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  drawSwissClock(ctx, VIEW_W / 2 - 36, y0 + 12, 8, game.timeRemaining);
  drawPixelText(ctx, clockStr, VIEW_W / 2 - 22, y0 + 12, {
    color: game.timeRemaining < 300 ? '#ff5959' : '#e6e4dc',
    baseline: 'middle',
  });

  drawPixelText(ctx, `L${level.id + 1}`, VIEW_W / 2 + 8, y0 + 12, {
    color: '#9aa4b8',
    baseline: 'middle',
  });
  if (game.audio.muted) {
    drawPixelText(ctx, 'MUTE', VIEW_W / 2 + 23, y0 + 12, {
      color: '#d46262',
      baseline: 'middle',
    });
  }

  // Right: Active enemy health pips + crisp enemy name
  let activeEnemy = null;
  for (const e of enemies) {
    if (e.roomId === player.roomId && e.alive && !e.nonCombat) {
      if (!activeEnemy || Math.abs(e.y - player.y) < Math.abs(activeEnemy.y - player.y)) {
        activeEnemy = e;
      }
    }
  }
  if (activeEnemy) {
    const pipColor = activeEnemy.type === 'deepfake' ? '#45d4f5' :
      activeEnemy.type === 'zins' ? (activeEnemy.bossPhase >= 3 ? '#ff4a5a' : activeEnemy.bossPhase === 2 ? '#f5b83d' : '#e6a832') : '#d67028';
    const pipStep = activeEnemy.maxHp > 6 ? 8 : 10;
    const pipW = activeEnemy.maxHp > 6 ? 6 : 7;
    for (let i = 0; i < activeEnemy.maxHp; i++) {
      const px = VIEW_W - 14 - i * pipStep;
      if (i < activeEnemy.hp) {
        ctx.fillStyle = pipColor;
        ctx.fillRect(px, pipY, pipW, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(px + 1, pipY + 1, pipW - 2, 1);
      } else {
        ctx.strokeStyle = '#4a4038';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, pipY + 0.5, pipW - 1, 7);
      }
    }
    if (activeEnemy.name) {
      const pipsLeft = VIEW_W - 14 - Math.max(0, activeEnemy.maxHp - 1) * pipStep - 5;
      const label = activeEnemy.type === 'zins' && activeEnemy.bossPhase > 1
        ? `DR. ZINS ${activeEnemy.bossPhase === 3 ? 'III' : 'II'}`
        : activeEnemy.name;
      drawPixelText(ctx, label, pipsLeft, y0 + 12, {
        color: activeEnemy.type === 'zins' && activeEnemy.bossPhase >= 3 ? '#ff9ea6' : '#d4cfc2',
        align: 'right',
        baseline: 'middle',
      });
    }
  }
}

function renderTitle(ctx, game) {
  drawTitleBackdrop(ctx, VIEW_W, VIEW_H, game.time);

  // Subtle dark scrim for crisp title typography
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, 'rgba(6, 10, 18, 0.55)');
  g.addColorStop(0.5, 'rgba(6, 10, 18, 0.28)');
  g.addColorStop(1, 'rgba(6, 10, 18, 0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Red Swiss badge
  ctx.fillStyle = '#c9242b';
  ctx.fillRect(VIEW_W / 2 - 7, 14, 14, 14);
  ctx.fillStyle = '#f5f4ef';
  ctx.fillRect(VIEW_W / 2 - 2, 17, 4, 8);
  ctx.fillRect(VIEW_W / 2 - 4, 19, 8, 4);

  // Crisp pixel display title (scale 2 = razor sharp 8x12 blocks!)
  drawPixelText(ctx, TITLE_TEXT.title, VIEW_W / 2, 38, {
    scale: 2,
    color: '#f5f1e6',
    align: 'center',
    baseline: 'middle',
    shadow: '#090d14',
  });

  drawPixelText(ctx, TITLE_TEXT.subtitle, VIEW_W / 2, 55, {
    color: '#e0bf72',
    align: 'center',
    baseline: 'middle',
    shadow: '#090d14',
  });

  drawPixelText(ctx, TITLE_TEXT.tagline, VIEW_W / 2, 67, {
    color: '#9db0c7',
    align: 'center',
    baseline: 'middle',
    shadow: '#090d14',
  });

  // Menu box
  const hasSave = !!game.savedGame;
  const menuY = hasSave ? 116 : 124;
  const items = hasSave
    ? [
        { label: `CONTINUE (L${game.savedGame.levelIndex + 1} - ${formatTime(game.savedGame.timeRemaining)})` },
        { label: 'NEW GAME' },
        { label: 'LEVEL SELECT (1-10)' },
      ]
    : [
        { label: 'START GAME' },
        { label: 'LEVEL SELECT (1-10)' },
      ];

  for (let i = 0; i < items.length; i++) {
    const sel = i === game.titleSelection;
    const y = menuY + i * 19;
    if (sel) {
      ctx.fillStyle = 'rgba(201, 36, 43, 0.88)';
      ctx.fillRect(VIEW_W / 2 - 118, y - 8, 236, 15);
      ctx.strokeStyle = '#f5f1e6';
      ctx.lineWidth = 1;
      ctx.strokeRect(VIEW_W / 2 - 117.5, y - 7.5, 235, 14);
    } else {
      ctx.fillStyle = 'rgba(10, 14, 22, 0.74)';
      ctx.fillRect(VIEW_W / 2 - 118, y - 8, 236, 15);
    }
    drawPixelText(ctx, (sel ? '> ' : '  ') + items[i].label, VIEW_W / 2, y, {
      color: sel ? '#ffffff' : '#b8c0cc',
      align: 'center',
      baseline: 'middle',
    });
  }

  // Controls footer (crisp 2-line pixel readout)
  drawPixelText(ctx, 'ARROWS: MOVE/JUMP/CLIMB  SPACE: USE/CAREFUL/HANG/STRIKE  UP: PARRY', VIEW_W / 2, 192, {
    color: '#c4ccd9',
    align: 'center',
    baseline: 'middle',
  });
  drawPixelText(ctx, 'ENTER/SPACE: START  |  M: MUTE  R: RESTART  ESC: PAUSE', VIEW_W / 2, 204, {
    color: '#8e98ab',
    align: 'center',
    baseline: 'middle',
  });
}

function renderLevelSelect(ctx, game) {
  drawTitleBackdrop(ctx, VIEW_W, VIEW_H, game.time, { showClock: false });
  ctx.fillStyle = 'rgba(5, 8, 14, 0.86)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.strokeStyle = '#c7a454';
  ctx.lineWidth = 1;
  ctx.strokeRect(12.5, 12.5, VIEW_W - 25, VIEW_H - 25);

  drawPixelText(ctx, 'SELECT STAGE (1-10)', VIEW_W / 2, 24, {
    color: '#e8c468',
    align: 'center',
    baseline: 'middle',
    shadow: '#05070a',
  });

  // Two columns of 5 levels
  const colX = [24, 198];
  for (let i = 0; i < LEVEL_INTROS.length; i++) {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    const x = colX[col];
    const y = 46 + row * 24;
    const sel = i === game.levelSelectIndex;
    if (sel) {
      ctx.fillStyle = 'rgba(201, 36, 43, 0.88)';
      ctx.fillRect(x - 4, y - 7, 166, 17);
      ctx.strokeStyle = '#f5f1e6';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 3.5, y - 6.5, 165, 16);
    } else {
      ctx.fillStyle = 'rgba(14, 20, 30, 0.72)';
      ctx.fillRect(x - 4, y - 7, 166, 17);
    }
    const num = String(i + 1).padStart(2, ' ');
    const info = LEVEL_INTROS[i];
    drawPixelText(ctx, `${sel ? '>' : ' '}${num}. ${info.shortName}`, x, y + 1, {
      color: sel ? '#ffffff' : '#c0cad8',
      baseline: 'middle',
    });
  }

  const chosen = LEVEL_INTROS[game.levelSelectIndex];
  if (chosen) {
    drawPixelText(ctx, `${chosen.title} - ${chosen.subtitle}`, VIEW_W / 2, 176, {
      color: '#e0bf72',
      align: 'center',
      baseline: 'middle',
    });
  }

  drawPixelText(ctx, 'ARROWS: CHOOSE   ENTER/SPACE: PLAY   ESC: BACK', VIEW_W / 2, 194, {
    color: '#9aa4b8',
    align: 'center',
    baseline: 'middle',
  });
}

function renderStoryScreen(ctx, game) {
  const card = game.activeCard;
  // Background
  if (game.mode === 'intro' || game.mode === 'victory' || game.mode === 'timeout') {
    drawTitleBackdrop(ctx, VIEW_W, VIEW_H, game.time, { showClock: false });
  } else {
    drawBackdrop(ctx, game.levelIndex, VIEW_W, VIEW_H, game.time, 999);
  }

  ctx.fillStyle = 'rgba(5, 8, 14, 0.84)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Ornamental card frame
  ctx.strokeStyle = game.mode === 'timeout' ? '#c92c34' : '#c7a454';
  ctx.lineWidth = 1;
  ctx.strokeRect(18.5, 16.5, VIEW_W - 37, VIEW_H - 33);

  // Clock emblem top-right
  drawSwissClock(ctx, VIEW_W - 42, 42, 13, game.timeRemaining);

  drawPixelText(ctx, card?.header || '', 30, 30, {
    color: game.mode === 'timeout' ? '#ff646b' : '#e8c468',
    shadow: '#05070a',
  });

  ctx.fillStyle = '#2d3748';
  ctx.fillRect(30, 42, VIEW_W - 94, 1);

  const lines = card?.lines || [];
  for (let i = 0; i < lines.length; i++) {
    drawPixelText(ctx, lines[i], 30, 62 + i * 16, {
      color: '#ece9e0',
    });
  }

  // Optional page indicator for multi-card sequences (intro / victory / timeout)
  if (game.cardQueue && game.cardQueue.length > 1) {
    drawPixelText(ctx, `${game.cardIndex + 1}/${game.cardQueue.length}`, VIEW_W - 32, VIEW_H - 28, {
      color: '#8d99ad',
      align: 'right',
      baseline: 'middle',
    });
  }

  // Prompt bottom
  const isFinalEndCard = (game.mode === 'victory' || game.mode === 'timeout') &&
    game.cardQueue && game.cardIndex >= game.cardQueue.length - 1;
  const prompt = isFinalEndCard
    ? 'PRESS ENTER OR SPACE TO RETURN TO TITLE'
    : 'PRESS ENTER OR SPACE TO CONTINUE';
  drawPixelText(ctx, prompt, VIEW_W / 2, VIEW_H - 28, {
    color: (Math.floor(game.time * 2) % 2 === 0) ? '#f0d27a' : '#a89254',
    align: 'center',
    baseline: 'middle',
  });
}

function drawPauseOverlay(ctx, game) {
  ctx.fillStyle = 'rgba(4, 7, 12, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, PLAY_H);

  ctx.strokeStyle = '#c7a454';
  ctx.lineWidth = 1;
  ctx.strokeRect(72.5, 28.5, VIEW_W - 145, 136);
  ctx.fillStyle = 'rgba(10, 14, 22, 0.94)';
  ctx.fillRect(73, 29, VIEW_W - 146, 135);

  drawSwissClock(ctx, VIEW_W / 2, 62, 18, game.timeRemaining);

  drawPixelText(ctx, 'PAUSED', VIEW_W / 2, 92, {
    color: '#f5f1e6',
    align: 'center',
    baseline: 'middle',
  });
  drawPixelText(ctx, `TIME LEFT: ${formatTime(game.timeRemaining)}`, VIEW_W / 2, 108, {
    color: '#d4b46a',
    align: 'center',
    baseline: 'middle',
  });
  drawPixelText(ctx, 'ESC: RESUME   R: RESTART LEVEL', VIEW_W / 2, 128, {
    color: '#bfc8d6',
    align: 'center',
    baseline: 'middle',
  });
  drawPixelText(ctx, 'M: TOGGLE AUDIO   ENTER: TITLE', VIEW_W / 2, 142, {
    color: '#bfc8d6',
    align: 'center',
    baseline: 'middle',
  });
}

function drawDeathOverlay(ctx, game) {
  ctx.fillStyle = 'rgba(30, 4, 8, 0.58)';
  ctx.fillRect(0, 0, VIEW_W, PLAY_H);

  ctx.fillStyle = 'rgba(8, 10, 16, 0.90)';
  ctx.fillRect(34, 64, VIEW_W - 68, 62);
  ctx.strokeStyle = '#d1343a';
  ctx.lineWidth = 1;
  ctx.strokeRect(34.5, 64.5, VIEW_W - 69, 61);

  drawPixelText(ctx, game.deathReason || 'INSURANCE DOES NOT COVER THIS.', VIEW_W / 2, 82, {
    color: '#ff6b70',
    align: 'center',
    baseline: 'middle',
  });
  drawPixelText(ctx, DEATH_SUBLINES.line2, VIEW_W / 2, 98, {
    color: '#d8dce4',
    align: 'center',
    baseline: 'middle',
  });
  drawPixelText(ctx, DEATH_SUBLINES.line3, VIEW_W / 2, 113, {
    color: '#f0d27a',
    align: 'center',
    baseline: 'middle',
  });
}

export function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
