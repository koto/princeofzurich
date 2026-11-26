// src/render.js
// Procedural renderer: tile themes, traps, items, articulated skeletal figures,
// Swiss railway station clock, HUD, title screen, and story cards.

import { drawBackdrop, drawTitleBackdrop } from './backdrops.js';
import {
  VIEW_W, VIEW_H, PLAY_H, HUD_H, COLS, ROWS, TILE_W, TILE_H, FLOOR_THICK,
  floorY, tileCenterX,
} from './level.js';

// ---------------------------------------------------------------------------
// Per-level architectural palettes (harmonized with src/backdrops.js)
// ---------------------------------------------------------------------------

const LEVEL_THEMES = [
  // 0: Paradeplatz Vaults (emerald marble + warm brass)
  {
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
  // 1: Gotthard Reduit (reinforced bunker concrete + hazard ochre)
  {
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
  // 2: CERN Geneva (cryo-steel + cyan/magenta photonics)
  {
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
  // 3: Jungfraujoch Ice Palace (glacial blue ice + frost white)
  {
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
  // 4: Sphinx Observatory (alpine slate + brass/glass summit)
  {
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
// Character palettes
// ---------------------------------------------------------------------------

const CHAR_PALETTES = {
  hero: {
    skin: '#f0c49b',
    hair: '#2a1d17',
    jacket: '#d12c2c', // Swiss courier crimson
    jacketDark: '#8f1b1b',
    accent: '#f5f5f0', // white courier strap
    pants: '#28303d',
    pantsDark: '#181e27',
    boots: '#121418',
    sword: '#e6eef5',
    hilt: '#d4a843',
  },
  deepfake: {
    skin: '#9ae6ff',
    hair: '#2b4770',
    jacket: '#41c8e8',
    jacketDark: '#1c6d94',
    accent: '#d678ff',
    pants: '#233b63',
    pantsDark: '#14223d',
    boots: '#111b30',
    sword: '#b5f3ff',
    hilt: '#c96eff',
    glitch: true,
  },
  guard: {
    skin: '#e0b48d',
    hair: '#262b30',
    jacket: '#53685e',
    jacketDark: '#34443c',
    accent: '#e0b956',
    pants: '#2e3835',
    pantsDark: '#1b2220',
    boots: '#111414',
    sword: '#dae4ec',
    hilt: '#d4af4c',
    cap: '#384840',
    rim: '#8ca394',
  },
  elite: {
    skin: '#e6be98',
    hair: '#1f2630',
    jacket: '#bcc7d4',
    jacketDark: '#7c8896',
    accent: '#d63e4a',
    pants: '#2a3340',
    pantsDark: '#1a2029',
    boots: '#12161c',
    sword: '#eef6ff',
    hilt: '#48a4d4',
    cap: '#435163',
  },
  zins: {
    skin: '#ebd0b7',
    hair: '#d8dde6', // silver hair
    jacket: '#22242c', // tailored banker coat
    jacketDark: '#13151a',
    accent: '#d92b3a', // crimson pocket square / tie
    pants: '#1a1c24',
    pantsDark: '#101117',
    boots: '#0c0d10',
    sword: '#ffffff',
    hilt: '#f0c451',
  },
  celine: {
    skin: '#f2c8a2',
    hair: '#4a2b1d',
    jacket: '#2b446e',
    jacketDark: '#1c2d4a',
    accent: '#f0e6d2',
    pants: '#252936',
    pantsDark: '#171a24',
    boots: '#1a181c',
    sword: null,
    hilt: null,
  },
};

// ---------------------------------------------------------------------------
// Articulated Skeletal Pose Definitions (Forward Kinematics, angles in deg)
// Angle convention: 0 = straight down (+y), +angle = forward (+x), -angle = backward (-x)
// Torso angle: 0 = straight up (-y), +angle = leaning forward (+x), -angle = leaning back (-x)
// ---------------------------------------------------------------------------

function p(px, py, torso, head, lThigh, lShin, rThigh, rShin, lUpper, lFore, rUpper, rFore, sword = 0) {
  return { px, py, torso, head, lThigh, lShin, rThigh, rShin, lUpper, lFore, rUpper, rFore, sword };
}

const ANIM_CLIPS = {
  idle: [
    p(0, -14.2, 4, 2, -6, -8, 10, 6, -12, 16, 12, 26, -15),
    p(0, -13.9, 6, 4, -7, -9, 11, 7, -14, 18, 14, 28, -15),
  ],
  run_start: [
    p(0, -13.0, 22, 10, -28, -42, 34, 6, -34, 15, 42, 78, -25),
    p(1, -13.6, 26, 12, 28, -10, -24, -46, 36, 75, -32, 12, -25),
  ],
  run: [
    p(0, -13.8, 24, 8, 46, 12, -38, -68, -48, 8, 52, 95, -20),
    p(0, -15.2, 26, 8, 22, -26, -14, -60, -22, 22, 24, 72, -20),
    p(0, -13.2, 24, 10, -10, -45, 22, -12, 16, 62, -18, 22, -20),
    p(0, -13.8, 24, 8, -38, -68, 46, 12, 52, 95, -48, 8, -20),
    p(0, -15.2, 26, 8, -14, -60, 22, -26, 24, 72, -22, 22, -20),
    p(0, -13.2, 24, 10, 22, -12, -10, -45, -18, 22, 16, 62, -20),
  ],
  skid: [
    p(-1, -12.5, -16, -6, -24, -18, 42, 24, -36, -10, 32, 54, -20),
    p(-1, -13.2, -10, -3, -18, -14, 34, 18, -28, -4, 26, 44, -20),
  ],
  turn: [
    p(0, -13.5, 10, 12, -14, -22, 16, 10, -20, 25, 22, 48, -15),
    p(0, -14.0, -6, -8, 12, 6, -12, -16, 14, 32, -14, 12, -15),
  ],
  careful: [
    p(0, -13.8, 12, 8, -10, -12, 16, 12, -16, 18, 22, 42, -15),
    p(1, -13.5, 15, 12, -16, -14, 30, 18, -22, 12, 32, 52, -15),
    p(0, -14.0, 6, 4, -6, -8, 10, 6, -12, 16, 14, 28, -15),
  ],
  crouch: [
    p(0, -13.8, 8, 4, -8, -10, 12, 8, -12, 18, 14, 30, -15),
    p(1, -7.8, 28, 10, -20, -76, 54, -22, -18, 26, 36, 60, -15),
  ],
  pickup: [
    p(0, -13.5, 14, 10, -10, -16, 18, 6, -14, 18, 22, 38, -15),
    p(1, -7.8, 34, 16, -24, -78, 56, -24, -10, 34, 48, 52, -15),
    p(1, -9.2, 18, -6, -16, -62, 44, -18, -8, 28, 36, 118, -15),
    p(0, -13.8, 6, 2, -6, -8, 10, 6, -12, 16, 14, 28, -15),
  ],
  jump_up: [
    p(0, -9.5, 18, -4, -16, -54, 32, -26, -24, 18, 26, 56, -15),
    p(0, -15.5, 4, -12, -6, -14, 12, -8, 152, 168, 162, 174, -15),
    p(0, -14.8, 6, -8, -10, -24, 16, -16, 145, 160, 155, 170, -15),
  ],
  stand_jump: [
    p(0, -9.8, 24, 8, -18, -56, 34, -20, -32, 12, 40, 74, -15),
    p(0, -14.6, 22, 6, -26, -54, 48, 4, -38, 22, 74, 116, -15),
    p(0, -13.8, 18, 8, -10, -48, 38, 16, -24, 18, 48, 84, -15),
  ],
  run_jump: [
    p(0, -14.8, 30, 8, -46, -74, 58, 16, -56, -8, 92, 128, -15),
    p(0, -15.2, 26, 6, -34, -68, 52, 22, -44, 12, 78, 114, -15),
    p(0, -13.4, 20, 8, -14, -44, 40, 12, -22, 22, 46, 82, -15),
  ],
  fall: [
    p(0, -14.0, 10, 14, -18, -52, 28, -22, 124, 152, 136, 164, -15),
    p(0, -14.0, 14, 16, -12, -46, 34, -16, 116, 144, 144, 170, -15),
  ],
  land: [
    p(0, -8.8, 24, 12, -20, -68, 44, -20, -26, 16, 34, 58, -15),
    p(0, -13.8, 6, 2, -6, -8, 10, 6, -12, 16, 14, 28, -15),
  ],
  hard_land: [
    p(0, -7.2, 34, 20, -26, -80, 56, -26, -32, 14, 42, 48, -15),
    p(0, -9.2, 26, 14, -18, -62, 42, -18, -22, 18, 28, 44, -15),
    p(0, -13.8, 8, 4, -8, -10, 12, 6, -12, 16, 14, 28, -15),
  ],
  hang: [
    p(-2, -14.0, -4, -14, -6, -16, 6, -10, 162, 174, 168, 176, -15),
    p(-2, -14.0, -2, -12, -2, -12, 10, -6, 160, 172, 166, 175, -15),
  ],
  climb_up: [
    p(-2, -14.0, 6, -10, -8, -26, 24, -40, 152, 172, 158, 174, -15),
    p(-1, -13.5, 22, -4, -14, -52, 56, -34, 96, 148, 108, 156, -15),
    p(0, -10.0, 28, 6, -18, -68, 52, -22, 32, 66, 44, 72, -15),
    p(0, -14.0, 6, 2, -6, -8, 10, 6, -12, 16, 14, 28, -15),
  ],
  climb_down: [
    p(0, -14.0, 6, 2, -6, -8, 10, 6, -12, 16, 14, 28, -15),
    p(0, -9.5, 28, 10, -18, -66, 48, -22, 36, 68, 46, 74, -15),
    p(-2, -13.5, 16, -6, -12, -42, 36, -36, 128, 164, 136, 168, -15),
    p(-2, -14.0, -4, -14, -6, -16, 6, -10, 162, 174, 168, 176, -15),
  ],
  combat_idle: [
    p(0, -12.8, 10, 4, -24, -28, 32, 10, -28, -58, 46, 98, 118),
    p(0, -12.4, 12, 4, -26, -30, 34, 12, -32, -62, 50, 102, 115),
  ],
  combat_advance: [
    p(1, -12.2, 14, 4, -32, -32, 42, 14, -34, -64, 54, 104, 118),
    p(0, -12.8, 10, 4, -24, -28, 32, 10, -28, -58, 46, 98, 118),
  ],
  combat_retreat: [
    p(-1, -12.6, 4, 2, -30, -24, 24, 10, -24, -52, 40, 94, 122),
    p(0, -12.8, 10, 4, -24, -28, 32, 10, -28, -58, 46, 98, 118),
  ],
  combat_strike: [
    p(-1, -12.4, 2, 2, -26, -30, 30, 10, -30, -60, 40, 138, 158),
    p(3, -11.0, 26, 8, -44, -42, 56, 14, -42, -74, 88, 94, 92),
    p(2, -11.6, 20, 6, -36, -36, 46, 14, -36, -66, 74, 96, 98),
    p(0, -12.8, 10, 4, -24, -28, 32, 10, -28, -58, 46, 98, 118),
  ],
  combat_parry: [
    p(-1, -12.6, -2, -2, -24, -28, 30, 10, -26, -56, 74, 136, 156),
    p(-1, -12.8, 2, 0, -24, -28, 32, 12, -30, -60, 68, 130, 148),
  ],
  combat_hit: [
    p(-2, -12.4, -18, -12, -26, -20, 26, 16, -48, -72, 24, 52, 62),
    p(-1, -12.8, -6, -4, -24, -26, 30, 12, -34, -64, 38, 84, 104),
  ],
  sheathe: [
    p(0, -13.2, 8, 4, -18, -20, 22, 10, -24, -36, 14, 44, 35),
    p(0, -14.0, 4, 2, -6, -8, 10, 6, -12, 16, 12, 26, -15),
  ],
  dead: [
    p(0, -9.2, 42, 34, -22, -46, 34, -18, -16, 20, 46, 44, 50),
    p(2, -2.8, 84, 78, 72, 82, 78, 86, 68, 80, 82, 86, 86),
  ],
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sampleClip(clipName, t, looping = false) {
  const frames = ANIM_CLIPS[clipName] || ANIM_CLIPS.idle;
  if (frames.length === 1) return frames[0];

  let u = looping ? ((t % 1) + 1) % 1 : Math.max(0, Math.min(1, t));
  let idx, nextIdx, frac;
  if (looping) {
    const pos = u * frames.length;
    idx = Math.floor(pos) % frames.length;
    nextIdx = (idx + 1) % frames.length;
    frac = pos - Math.floor(pos);
  } else {
    const pos = u * (frames.length - 1);
    idx = Math.min(frames.length - 1, Math.floor(pos));
    nextIdx = Math.min(frames.length - 1, idx + 1);
    frac = pos - idx;
  }
  const a = frames[idx];
  const b = frames[nextIdx];
  return {
    px: lerp(a.px, b.px, frac),
    py: lerp(a.py, b.py, frac),
    torso: lerp(a.torso, b.torso, frac),
    head: lerp(a.head, b.head, frac),
    lThigh: lerp(a.lThigh, b.lThigh, frac),
    lShin: lerp(a.lShin, b.lShin, frac),
    rThigh: lerp(a.rThigh, b.rThigh, frac),
    rShin: lerp(a.rShin, b.rShin, frac),
    lUpper: lerp(a.lUpper, b.lUpper, frac),
    lFore: lerp(a.lFore, b.lFore, frac),
    rUpper: lerp(a.rUpper, b.rUpper, frac),
    rFore: lerp(a.rFore, b.rFore, frac),
    sword: lerp(a.sword, b.sword, frac),
  };
}

function degRad(d) { return (d * Math.PI) / 180; }

function limbEndDown(x, y, deg, len) {
  const r = degRad(deg);
  return { x: x + Math.sin(r) * len, y: y + Math.cos(r) * len };
}

function limbEndUp(x, y, deg, len) {
  const r = degRad(deg);
  return { x: x + Math.sin(r) * len, y: y - Math.cos(r) * len };
}

function drawSeg(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Tapered polygon limb for sharper 1989 rotoscoped silhouette (replaces stick-figure tubes)
function drawTapered(ctx, x1, y1, x2, y2, r1, r2, fill, outline = null) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
  ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
  ctx.lineTo(x2 - nx * r2, y2 - ny * r2);
  ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}

export function drawCharacter(ctx, ent, time) {
  const pal = CHAR_PALETTES[ent.palette || 'hero'] || CHAR_PALETTES.hero;
  const clip = ent.anim || 'idle';
  const looping = clip === 'idle' || clip === 'run' || clip === 'fall' || clip === 'hang' || clip === 'combat_idle';
  const pose = sampleClip(clip, ent.animT || 0, looping);

  ctx.save();
  ctx.translate(Math.round(ent.x), Math.round(ent.y));
  if (ent.facing < 0) {
    ctx.scale(-1, 1);
  }

  // Deepfake glitch/transparency effect
  if (pal.glitch) {
    const jitter = Math.sin(time * 27 + ent.x) > 0.72 ? 1.5 : 0;
    ctx.translate(jitter, 0);
    ctx.globalAlpha = 0.82 + 0.14 * Math.sin(time * 14);
  }

  // Hit flash
  const flashing = ent.hurtFlash > 0 && Math.floor(ent.hurtFlash * 24) % 2 === 0;

  // Ground shadow when grounded
  if (ent.grounded && ent.alive) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Forward kinematics joints
  const pelvis = { x: pose.px, y: pose.py };
  const neck = limbEndUp(pelvis.x, pelvis.y, pose.torso, 9.4);
  const head = limbEndUp(neck.x, neck.y, pose.head, 3.6);
  const shoulder = { x: lerp(pelvis.x, neck.x, 0.86), y: lerp(pelvis.y, neck.y, 0.86) };

  const lKnee = limbEndDown(pelvis.x, pelvis.y, pose.lThigh, 7.2);
  const lFoot = limbEndDown(lKnee.x, lKnee.y, pose.lShin, 7.2);
  const rKnee = limbEndDown(pelvis.x, pelvis.y, pose.rThigh, 7.2);
  const rFoot = limbEndDown(rKnee.x, rKnee.y, pose.rShin, 7.2);

  // Subtle foot-ground clamp when standing/walking so grounded feet feel planted
  if (ent.grounded && ent.alive && clip !== 'dead') {
    if (lFoot.y > 0) lFoot.y = 0;
    if (rFoot.y > 0) rFoot.y = 0;
  }

  const lElbow = limbEndDown(shoulder.x, shoulder.y, pose.lUpper, 5.2);
  const lHand = limbEndDown(lElbow.x, lElbow.y, pose.lFore, 5.2);
  const rElbow = limbEndDown(shoulder.x, shoulder.y, pose.rUpper, 5.2);
  const rHand = limbEndDown(rElbow.x, rElbow.y, pose.rFore, 5.2);

  const jacket = flashing ? '#ffffff' : pal.jacket;
  const jacketDark = flashing ? '#ffcccc' : pal.jacketDark;
  const pants = flashing ? '#ffffff' : pal.pants;
  const pantsDark = flashing ? '#ffcccc' : pal.pantsDark;
  const skin = flashing ? '#ffffff' : pal.skin;
  const outline = 'rgba(6, 9, 12, 0.55)';

  // Back arm
  drawTapered(ctx, shoulder.x, shoulder.y, lElbow.x, lElbow.y, 1.35, 1.05, jacketDark);
  drawTapered(ctx, lElbow.x, lElbow.y, lHand.x, lHand.y, 1.0, 0.8, skin);

  // Back leg + boot
  drawTapered(ctx, pelvis.x, pelvis.y, lKnee.x, lKnee.y, 1.65, 1.25, pantsDark);
  drawTapered(ctx, lKnee.x, lKnee.y, lFoot.x, lFoot.y, 1.25, 0.95, pantsDark);
  ctx.fillStyle = pal.boots;
  ctx.fillRect(lFoot.x - 1, lFoot.y - 1.5, 4.2, 2.0);

  // Tapered tailored torso (broader chest/shoulders, trim waist) + rim/strap accents
  drawTapered(ctx, pelvis.x, pelvis.y + 0.5, neck.x, neck.y - 0.3, 2.1, 2.9, jacket, outline);
  if (pal.rim) {
    drawSeg(ctx, shoulder.x - 2, shoulder.y, shoulder.x + 2.2, shoulder.y - 0.5, 1.0, pal.accent);
  }
  // Diagonal courier strap / uniform sash + belt
  drawSeg(ctx, pelvis.x - 1.0, pelvis.y - 1.2, shoulder.x + 1.2, shoulder.y + 0.2, 1.2, pal.accent);
  drawSeg(ctx, pelvis.x - 2.0, pelvis.y - 0.2, pelvis.x + 2.0, pelvis.y - 0.2, 1.2, pal.boots);

  // Front leg + boot
  drawTapered(ctx, pelvis.x, pelvis.y, rKnee.x, rKnee.y, 1.8, 1.35, pants, outline);
  drawTapered(ctx, rKnee.x, rKnee.y, rFoot.x, rFoot.y, 1.35, 1.0, pants, outline);
  ctx.fillStyle = pal.boots;
  ctx.fillRect(rFoot.x - 1, rFoot.y - 1.6, 4.6, 2.2);

  // Head & hair
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 2.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.arc(head.x - 0.5, head.y - 1.0, 2.8, Math.PI * 0.88, Math.PI * 2.18);
  ctx.fill();

  // Optional guard cap/helmet with brass visor rim
  if (pal.cap) {
    ctx.fillStyle = pal.cap;
    ctx.fillRect(head.x - 3.3, head.y - 4.1, 6.6, 2.3);
    ctx.fillRect(head.x + 1.0, head.y - 2.6, 3.2, 1.0);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(head.x - 2.6, head.y - 2.4, 5.2, 0.8);
  }

  // Drawn sword (if armed and in combat stance or unsheathing)
  if (ent.swordDrawn && pal.sword) {
    const bladeEnd = limbEndDown(rHand.x, rHand.y, pose.sword, 17.5);
    const guardA = limbEndDown(rHand.x, rHand.y, pose.sword + 90, 2.6);
    const guardB = limbEndDown(rHand.x, rHand.y, pose.sword - 90, 2.6);
    drawTapered(ctx, rHand.x, rHand.y, bladeEnd.x, bladeEnd.y, 1.0, 0.35, pal.sword);
    drawSeg(ctx, guardA.x, guardA.y, guardB.x, guardB.y, 1.8, pal.hilt);

    // Readable blade-glint telegraph star during enemy strike windup!
    if (ent.strikeTelegraph > 0 && ent.state === 'combat_strike') {
      const gx = bladeEnd.x;
      const gy = bladeEnd.y;
      ctx.fillStyle = '#fff5a8';
      ctx.fillRect(gx - 3.5, gy - 0.6, 7, 1.2);
      ctx.fillRect(gx - 0.6, gy - 3.5, 1.2, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(gx - 1.2, gy - 1.2, 2.4, 2.4);
    }
  } else if (ent.hasSword && pal.sword && ent.alive) {
    // Sheathed sabre at hip
    drawSeg(ctx, pelvis.x - 1, pelvis.y, pelvis.x - 9, pelvis.y + 5, 1.3, pal.hilt);
  }

  // Front arm
  drawTapered(ctx, shoulder.x, shoulder.y, rElbow.x, rElbow.y, 1.45, 1.1, jacket, outline);
  drawTapered(ctx, rElbow.x, rElbow.y, rHand.x, rHand.y, 1.05, 0.85, skin);

  // Celine holds the glowing cryptographic key tablet
  if (ent.palette === 'celine') {
    ctx.fillStyle = '#5ee8ff';
    ctx.fillRect(rHand.x - 1, rHand.y - 3, 4, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rHand.x, rHand.y - 2, 2, 2);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// SBB Swiss Railway Station Clock (Mondaine iconic style)
// ---------------------------------------------------------------------------

export function drawSwissClock(ctx, cx, cy, r, timeRemainingSec) {
  // Elapsed since 23:00 (0..3600s)
  const elapsed = Math.max(0, Math.min(3600, 3600 - timeRemainingSec));
  const mins = elapsed / 60; // 0..60
  const secs = elapsed % 60;

  ctx.save();
  // Outer metal rim
  ctx.fillStyle = '#2a2e35';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Crisp white dial
  ctx.fillStyle = '#f5f4ef';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Hour ticks
  ctx.strokeStyle = '#15171a';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const major = i % 3 === 0;
    const inner = r * (major ? 0.68 : 0.78);
    ctx.lineWidth = major ? Math.max(1, r * 0.1) : Math.max(0.7, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * (r * 0.92), cy + Math.sin(a) * (r * 0.92));
    ctx.stroke();
  }

  // Hour hand (from 11:00 -> 12:00)
  const hourAngle = ((11 + mins / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#141619';
  ctx.lineWidth = Math.max(1.2, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(hourAngle) * r * 0.15, cy - Math.sin(hourAngle) * r * 0.15);
  ctx.lineTo(cx + Math.cos(hourAngle) * r * 0.56, cy + Math.sin(hourAngle) * r * 0.56);
  ctx.stroke();

  // Minute hand (0 -> 60 -> 12:00)
  const minAngle = (mins / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.lineWidth = Math.max(1.0, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(minAngle) * r * 0.18, cy - Math.sin(minAngle) * r * 0.18);
  ctx.lineTo(cx + Math.cos(minAngle) * r * 0.80, cy + Math.sin(minAngle) * r * 0.80);
  ctx.stroke();

  // Iconic SBB red lollipop second hand: authentic 58.5s sweep + 1.5s pause at 12 o'clock!
  const sbbSec = Math.min(60, (secs / 58.5) * 60);
  const secAngle = (sbbSec / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#d92626';
  ctx.lineWidth = Math.max(0.8, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(secAngle) * r * 0.22, cy - Math.sin(secAngle) * r * 0.22);
  ctx.lineTo(cx + Math.cos(secAngle) * r * 0.70, cy + Math.sin(secAngle) * r * 0.70);
  ctx.stroke();

  ctx.fillStyle = '#d92626';
  ctx.beginPath();
  ctx.arc(cx + Math.cos(secAngle) * r * 0.66, cy + Math.sin(secAngle) * r * 0.66, Math.max(1.1, r * 0.11), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Room Tiles, Props, Items, HUD, Overlays
// ---------------------------------------------------------------------------

export function renderGame(ctx, game) {
  const { mode, time, level, player, enemies } = game;
  ctx.imageSmoothingEnabled = false;

  if (mode === 'title') {
    renderTitle(ctx, game);
    return;
  }
  if (mode === 'intro' || mode === 'interlude' || mode === 'victory' || mode === 'timeout') {
    renderStoryScreen(ctx, game);
    return;
  }

  const room = level.getRoom(player.roomId);
  if (!room) return;
  const theme = LEVEL_THEMES[level.id % LEVEL_THEMES.length];

  // Camera shake
  ctx.save();
  if (game.shakeTimer > 0) {
    const mag = Math.min(3, game.shakeTimer * 12);
    ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
  }

  // 1. Procedural backdrop behind tiles (full 384x216 clipped to play area)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, PLAY_H);
  ctx.clip();
  drawBackdrop(ctx, level.id, VIEW_W, PLAY_H, time, room.seed);

  // 2. Back-layer room decor (torches, banners, signage, Celine in L5)
  drawDecor(ctx, room, theme, time, level.id);

  // 3. Tiles (walls, floors, plates, exit doors, loose floors, spikes, mirror)
  drawRoomTiles(ctx, level, room, theme, time);

  // 4. Collectible items (sword, elixirs)
  drawItems(ctx, room, time);

  // 5. Falling loose-floor debris
  for (const d of level.fallingDebris) {
    if (d.roomId !== room.id) continue;
    ctx.fillStyle = theme.floorFace;
    ctx.fillRect(Math.round(d.x - 14), Math.round(d.y), 28, FLOOR_THICK);
    ctx.fillStyle = theme.floorTop;
    ctx.fillRect(Math.round(d.x - 14), Math.round(d.y), 28, 2);
  }

  // 6. Enemies & foreground NPCs (Celine) in this room
  for (const enemy of enemies) {
    if (enemy.roomId !== room.id) continue;
    if (!enemy.alive && enemy.animT >= 1 && enemy.hiddenAfterDeath) continue;
    drawCharacter(ctx, enemy, time);
  }
  drawForegroundDecor(ctx, room, time);

  // 7. Player
  drawCharacter(ctx, player, time);

  // 8. Foreground gates & slicers (drawn over characters slightly so portcullis feels spatial)
  drawRoomForegroundTraps(ctx, level, room, theme, time);

  // 8b. Climb cue: when the hero can climb from where he stands, mark the ledge corner.
  drawClimbCue(ctx, level, player, time);

  // 9. Particles (sparks, dust, shatter)
  for (const pt of level.particles) {
    if (pt.roomId !== room.id) continue;
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // 10. Room hint / floating banner inside play area (crisp pixel font with auto-wrap)
  if (game.bannerTimer > 0 && game.bannerText) {
    const alpha = Math.min(1, game.bannerTimer * 2);
    const wrapped = wrapPixelText(game.bannerText, 64);
    const boxH = wrapped.length > 1 ? 26 : 18;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(6, 9, 14, 0.88)';
    ctx.fillRect(16, 5, VIEW_W - 32, boxH);
    ctx.strokeStyle = theme.floorTrim;
    ctx.lineWidth = 1;
    ctx.strokeRect(16.5, 5.5, VIEW_W - 33, boxH - 1);
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

  // 11. Bottom HUD Bar (y = 192..216)
  drawHUD(ctx, game);

  // 12. Overlays (Pause or Death prompt)
  if (mode === 'paused') {
    drawPauseOverlay(ctx, game);
  } else if (mode === 'dead') {
    drawDeathOverlay(ctx, game);
  }
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
  const ay = Math.max(6, ly - 9 - Math.round(pulse * 2));
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.45 * pulse;
  ctx.fillStyle = '#fff1c2';
  // small up-chevron above the ledge corner
  ctx.fillRect(ax - 1, ay, 2, 1);
  ctx.fillRect(ax - 2, ay + 1, 4, 1);
  ctx.fillRect(ax - 3, ay + 2, 2, 1);
  ctx.fillRect(ax + 1, ay + 2, 2, 1);
  ctx.globalAlpha = 0.35 * pulse;
  ctx.fillRect(cornerX - (ledge.facing > 0 ? 6 : 0), ly - 1, 6, 2);
  ctx.restore();
}

function drawDecor(ctx, room, theme, time, levelId) {
  for (const d of room.decor) {
    const cx = tileCenterX(d.col);
    const fy = floorY(d.row);
    if (d.type === 'torch') {
      const ty = fy - 24;
      if (levelId === 2) {
        // CERN cryo-photonic wall lamp (cool cyan LED bar)
        ctx.fillStyle = '#1e2c44';
        ctx.fillRect(cx - 5, ty - 2, 10, 5);
        const pulse = 0.85 + 0.15 * Math.sin(time * 7 + d.col);
        const g = ctx.createRadialGradient(cx, ty, 1, cx, ty, 20);
        g.addColorStop(0, `rgba(70, 220, 255, ${(0.32 * pulse).toFixed(2)})`);
        g.addColorStop(1, 'rgba(40, 150, 255, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 22, ty - 20, 44, 40);
        ctx.fillStyle = '#68e8ff';
        ctx.fillRect(cx - 4, ty - 1, 8, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 2, ty - 1, 4, 1);
      } else if (levelId === 3) {
        // Jungfraujoch frosted crystal ice lantern
        ctx.fillStyle = '#365e82';
        ctx.fillRect(cx - 3, ty - 6, 6, 2);
        ctx.fillRect(cx - 3, ty + 2, 6, 2);
        const g = ctx.createRadialGradient(cx, ty - 1, 1, cx, ty - 1, 22);
        g.addColorStop(0, 'rgba(170, 238, 255, 0.34)');
        g.addColorStop(1, 'rgba(90, 180, 240, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 22, ty - 22, 44, 44);
        ctx.fillStyle = '#9be8ff';
        ctx.fillRect(cx - 2, ty - 4, 4, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1, ty - 3, 2, 4);
      } else if (levelId === 4) {
        // Sphinx Observatory alpine summit floodlight on mast
        ctx.fillStyle = '#485266';
        ctx.fillRect(cx - 1, fy - 24, 2, 24);
        ctx.fillStyle = '#252c38';
        ctx.fillRect(cx - 4, fy - 27, 8, 4);
        const g = ctx.createRadialGradient(cx, fy - 25, 1, cx, fy - 18, 26);
        g.addColorStop(0, 'rgba(255, 242, 195, 0.36)');
        g.addColorStop(1, 'rgba(255, 220, 140, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 26, fy - 42, 52, 46);
        ctx.fillStyle = '#fff5cc';
        ctx.fillRect(cx - 3, fy - 26, 6, 2);
      } else {
        // Classic Paradeplatz / Gotthard wall torch
        ctx.fillStyle = '#4a3a22';
        ctx.fillRect(cx - 1, ty, 2, 8);
        const flick = Math.sin(time * 13 + d.col * 3) * 1.5;
        const g = ctx.createRadialGradient(cx, ty - 2, 1, cx, ty - 2, 20 + flick);
        g.addColorStop(0, 'rgba(255, 200, 90, 0.35)');
        g.addColorStop(1, 'rgba(255, 120, 30, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 22, ty - 24, 44, 44);
        ctx.fillStyle = '#ff9824';
        ctx.fillRect(cx - 2, ty - 4, 4, 4);
        ctx.fillStyle = '#fff0a0';
        ctx.fillRect(cx - 1, ty - 3, 2, 2);
      }
    } else if (d.type === 'banner') {
      ctx.fillStyle = '#8a1c22';
      ctx.fillRect(cx - 6, fy - 38, 12, 22);
      ctx.fillStyle = '#f0eee8';
      ctx.fillRect(cx - 1, fy - 31, 2, 8);
      ctx.fillRect(cx - 4, fy - 28, 8, 2);
    } else if (d.type === 'sign') {
      // Swiss metallic directional/warning plaque with crisp pictogram
      ctx.fillStyle = '#18202c';
      ctx.fillRect(cx - 12, fy - 32, 24, 11);
      ctx.strokeStyle = theme.floorTrim;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 11.5, fy - 31.5, 23, 10);
      // Mini Swiss red-cross badge on left + hazard/arrow bars on right
      ctx.fillStyle = '#c92830';
      ctx.fillRect(cx - 9, fy - 29, 5, 5);
      ctx.fillStyle = '#f5f4ef';
      ctx.fillRect(cx - 7, fy - 28, 1, 3);
      ctx.fillRect(cx - 8, fy - 27, 3, 1);
      // Right directional arrow pictogram
      ctx.fillStyle = '#e8c45a';
      ctx.fillRect(cx - 2, fy - 27, 8, 1);
      ctx.fillRect(cx + 4, fy - 28, 2, 3);
      ctx.fillRect(cx + 6, fy - 27, 1, 1);
      ctx.fillStyle = '#9aa8bc';
      ctx.fillRect(cx - 2, fy - 24, 9, 1);
    } else if (d.type === 'celine') {
      // Console pedestal behind/beside Celine (Celine character drawn in entity pass)
      ctx.fillStyle = '#253142';
      ctx.fillRect(cx + 8, fy - 18, 12, 18);
      ctx.fillStyle = '#3bd4ff';
      ctx.fillRect(cx + 10, fy - 16, 8, 5);
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

function drawRoomTiles(ctx, level, room, theme, time) {
  // Draw ceiling overhang slabs when room links upward so upward climb shafts are unmistakably visible!
  if (room.links.up !== null) {
    const upRoom = level.getRoom(room.links.up);
    if (upRoom) {
      for (let c = 0; c < COLS; c++) {
        const upCh = upRoom.grid[ROWS - 1][c];
        const x = c * TILE_W;
        if (upCh !== '.') {
          ctx.fillStyle = theme.wallDark;
          ctx.fillRect(x, 0, TILE_W, 4);
          ctx.fillStyle = upCh === '#' ? theme.wallFill : theme.floorFace;
          ctx.fillRect(x, 0, TILE_W, 2);
          ctx.fillStyle = theme.floorDark;
          ctx.fillRect(x, 4, TILE_W, 1);
        } else {
          // Subtle upward shaft glow & climbable ledge lip highlight
          const sg = ctx.createLinearGradient(0, 0, 0, 22);
          sg.addColorStop(0, 'rgba(200, 225, 255, 0.14)');
          sg.addColorStop(1, 'rgba(200, 225, 255, 0)');
          ctx.fillStyle = sg;
          ctx.fillRect(x + 2, 0, TILE_W - 4, 22);

          // Highlight climbable ledge corners adjacent to this ceiling opening
          const leftCh = level.getTile(room.links.up, c - 1, ROWS - 1);
          const rightCh = level.getTile(room.links.up, c + 1, ROWS - 1);
          if (leftCh !== '#' && level.hasFloor(room.links.up, c - 1, ROWS - 1)) {
            ctx.fillStyle = theme.floorTrim;
            ctx.fillRect(x - 3, 0, 4, 3);
            ctx.fillStyle = '#f5e8c8';
            ctx.fillRect(x - 2, 1, 2, 1);
          }
          if (rightCh !== '#' && level.hasFloor(room.links.up, c + 1, ROWS - 1)) {
            ctx.fillStyle = theme.floorTrim;
            ctx.fillRect(x + TILE_W - 1, 0, 4, 3);
            ctx.fillStyle = '#f5e8c8';
            ctx.fillRect(x + TILE_W, 1, 2, 1);
          }
        }
      }
    }
  }

  for (let r = 0; r < ROWS; r++) {
    const fy = floorY(r);
    const topY = r * TILE_H;
    for (let c = 0; c < COLS; c++) {
      const ch = room.grid[r][c];
      const x = c * TILE_W;

      if (ch === '#') {
        // Solid architectural wall block
        ctx.fillStyle = theme.wallFill;
        ctx.fillRect(x, topY, TILE_W, TILE_H);
        ctx.fillStyle = theme.wallHi;
        ctx.fillRect(x, topY, TILE_W, 2);
        ctx.fillRect(x, topY, 2, TILE_H);
        ctx.fillStyle = theme.wallDark;
        ctx.fillRect(x + TILE_W - 2, topY, 2, TILE_H);
        ctx.fillRect(x, topY + TILE_H - 3, TILE_W, 3);
        // Subtle masonry / panel detail
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x + 3, topY + 15, TILE_W - 6, 1);
        ctx.fillRect(x + 3, topY + 31, TILE_W - 6, 1);
        ctx.fillRect(x + 16, topY + 2, 1, 13);
        ctx.fillRect(x + 8, topY + 16, 1, 15);
        ctx.fillRect(x + 22, topY + 32, 1, 13);
        continue;
      }

      if (ch === '.') continue;

      // Loose floor check
      let shakeX = 0;
      let shakeY = 0;
      let isLoose = false;
      if (ch === 'L') {
        const l = room.loose.get(`${c},${r}`);
        if (l && l.state === 'fallen') continue;
        isLoose = true;
        if (l && l.state === 'shaking') {
          shakeX = Math.sin(time * 55 + c) * 1.4;
          shakeY = Math.cos(time * 47) * 0.9;
        }
      }

      // Draw walkable floor slab with 2.5D top plane depth & underside support brackets
      const fx = Math.round(x + shakeX);
      const fyy = Math.round(fy + shakeY);
      // Subtle underside shadow & corbel brackets so floors pop sharply off backdrops
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.fillRect(fx, fyy + FLOOR_THICK, TILE_W, 2);
      if (!isLoose) {
        ctx.fillStyle = theme.wallDark;
        ctx.fillRect(fx + 2, fyy + FLOOR_THICK, 3, 2);
        ctx.fillRect(fx + TILE_W - 5, fyy + FLOOR_THICK, 3, 2);
      }
      ctx.fillStyle = theme.floorFace;
      ctx.fillRect(fx, fyy, TILE_W, FLOOR_THICK);
      ctx.fillStyle = theme.floorTop;
      ctx.fillRect(fx, fyy, TILE_W, 2);
      // Crisp 1px top highlight bevel for foreground separation
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(fx, fyy, TILE_W, 1);
      ctx.fillStyle = theme.floorDark;
      ctx.fillRect(fx, fyy + FLOOR_THICK - 1, TILE_W, 1);
      // Tile stone seam
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(fx, fyy + 2, 1, FLOOR_THICK - 2);

      // Ledge lips next to open air ('.'). Lips that can be climbed onto from the floor
      // below get a bright worn-brass mantle edge so upward routes read at a glance.
      for (const side of [-1, 1]) {
        const adjC = c + side;
        if (level.getTile(room.id, adjC, r) !== '.' || level.hasFloor(room.id, adjC, r)) continue;
        const climbable = level.hasFloor(room.id, adjC, r + 1) && !level.isWall(room.id, adjC, r + 1);
        const lx = side < 0 ? fx : fx + TILE_W - 1;
        const capX = side < 0 ? fx : fx + TILE_W - 5;
        if (climbable) {
          ctx.fillStyle = 'rgba(255, 226, 150, 0.16)';
          ctx.fillRect(side < 0 ? fx - 6 : fx + TILE_W, fyy - 14, 6, 14);
          ctx.fillStyle = theme.floorTrim;
          ctx.fillRect(capX, fyy - 1, 5, 4);
          ctx.fillStyle = '#fff3cf';
          ctx.fillRect(capX, fyy - 1, 5, 1);
          ctx.fillRect(lx, fyy, 1, FLOOR_THICK);
        } else {
          ctx.fillStyle = theme.floorTrim;
          ctx.fillRect(side < 0 ? fx : fx + TILE_W - 3, fyy, 3, 2);
        }
      }

      // Ice specular glint in Level 4
      if (level.ice && ch === '_') {
        ctx.fillStyle = 'rgba(235, 250, 255, 0.55)';
        ctx.fillRect(fx + 4, fyy, 8, 1);
        ctx.fillRect(fx + 19, fyy + 1, 6, 1);
      }

      // Loose floor cracks (high-contrast fracture gap + chipped top edge + dust trickle)
      if (isLoose) {
        ctx.fillStyle = '#05070a';
        ctx.fillRect(fx + 1, fyy, 1, FLOOR_THICK);
        ctx.fillRect(fx + TILE_W - 2, fyy, 1, FLOOR_THICK);
        ctx.fillRect(fx + 8, fyy, 2, 4);
        ctx.fillRect(fx + 9, fyy + 3, 3, 2);
        ctx.fillRect(fx + 20, fyy, 2, 5);
        ctx.fillRect(fx + 15, fyy + 1, 2, 4);
        // Chipped bright edge highlight around fractures
        ctx.fillStyle = '#e8dcc0';
        ctx.fillRect(fx + 6, fyy, 2, 1);
        ctx.fillRect(fx + 18, fyy, 2, 1);
        ctx.fillStyle = theme.floorTrim;
        ctx.fillRect(fx + 2, fyy + 2, 3, 1);
        ctx.fillRect(fx + TILE_W - 5, fyy + 2, 3, 1);
        // Periodic falling dust crumb cue beneath loose floor
        const dustPhase = (time * 1.3 + c * 0.37) % 1;
        if (dustPhase < 0.6) {
          const dy = fyy + FLOOR_THICK + Math.round(dustPhase * 16);
          ctx.fillStyle = 'rgba(215, 205, 185, 0.55)';
          ctx.fillRect(fx + 10 + ((c * 5) % 12), dy, 1, 1);
        }
      }

      // Pressure plates
      if (ch === 'P' || ch === 'Q') {
        const plate = room.plates.get(`${c},${r}`);
        const down = plate && plate.pressed;
        const py = down ? fyy : fyy - 2;
        ctx.fillStyle = ch === 'Q' ? '#9c2c34' : theme.floorTrim;
        ctx.fillRect(fx + 5, py, TILE_W - 10, down ? 1 : 2);
        ctx.fillStyle = ch === 'Q' ? '#ff6470' : '#f2d98d';
        ctx.fillRect(fx + 7, py, TILE_W - 14, 1);
      }

      // Spikes
      if (ch === '^') {
        const sp = room.spikes.get(`${c},${r}`);
        const ext = sp ? sp.extended : 0.3;
        const h = Math.max(3, Math.round(ext * 13));
        for (let i = 0; i < 4; i++) {
          const sx = fx + 4 + i * 7;
          ctx.fillStyle = theme.spikeCol;
          ctx.beginPath();
          ctx.moveTo(sx, fyy);
          ctx.lineTo(sx + 2.5, fyy - h);
          ctx.lineTo(sx + 5, fyy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx + 2, fyy - h, 1, Math.min(3, h));
        }
      }

      // Exit Door
      if (ch === 'E') {
        const ex = level.getExitAt(room.id, c, r);
        const openAmt = ex ? ex.openAmount : 0;
        const dx = x + 3;
        const dw = TILE_W - 6;
        const dh = 36;
        const dy = fy - dh;
        // Frame
        ctx.fillStyle = theme.exitFrame;
        ctx.fillRect(dx - 2, dy - 2, dw + 4, dh + 2);
        // Interior (glows warm/bright when open)
        ctx.fillStyle = openAmt > 0.1 ? '#293e52' : theme.exitInner;
        ctx.fillRect(dx, dy, dw, dh);
        if (openAmt > 0.2) {
          const g = ctx.createLinearGradient(dx, dy, dx, fy);
          g.addColorStop(0, 'rgba(255, 224, 130, 0.45)');
          g.addColorStop(1, 'rgba(120, 210, 255, 0.25)');
          ctx.fillStyle = g;
          ctx.fillRect(dx + 1, dy + 1, dw - 2, dh - 1);
        }
        // Sliding door leaf
        const leafH = Math.round(dh * (1 - openAmt));
        if (leafH > 1) {
          ctx.fillStyle = theme.wallFill;
          ctx.fillRect(dx, dy, dw, leafH);
          ctx.fillStyle = theme.exitFrame;
          ctx.fillRect(dx + 2, dy + Math.max(0, leafH - 3), dw - 4, 2);
          // Swiss cross emblem on closed exit door
          if (leafH > 20) {
            ctx.fillStyle = '#c42b33';
            ctx.fillRect(dx + dw / 2 - 4, dy + 10, 8, 8);
            ctx.fillStyle = '#f5f4ef';
            ctx.fillRect(dx + dw / 2 - 1, dy + 11, 2, 6);
            ctx.fillRect(dx + dw / 2 - 3, dy + 13, 6, 2);
          }
        }
      }

      // Mirror / CERN Quantum Detector Portal
      if (ch === 'M' && room.mirror && !room.mirror.broken) {
        const mx = tileCenterX(c);
        const my = fy - 38;
        ctx.fillStyle = '#2d4e78';
        ctx.fillRect(mx - 4, my, 8, 38);
        const shimmer = 0.55 + 0.35 * Math.sin(time * 5);
        ctx.fillStyle = `rgba(110, 232, 255, ${shimmer.toFixed(2)})`;
        ctx.fillRect(mx - 2, my + 2, 4, 34);
        ctx.fillStyle = '#ffffff';
        const scanY = my + 3 + Math.floor(((time * 32) % 30));
        ctx.fillRect(mx - 2, scanY, 4, 2);
      }
    }
  }
}

function drawRoomForegroundTraps(ctx, level, room, theme, time) {
  // Gates (heavy iron portcullis — clearly NOT a climbable ladder!)
  for (const g of room.gates) {
    const cx = tileCenterX(g.col);
    const fy = floorY(g.row);
    const topY = g.row * TILE_H;
    const totalH = fy - topY;
    const closedH = Math.max(5, Math.round(totalH * (1 - g.openAmount * 0.85)));

    // Solid overhead lintel housing with iron rivets
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(cx - 9, topY, 18, 6);
    ctx.fillStyle = theme.wallHi;
    ctx.fillRect(cx - 8, topY, 16, 1);
    ctx.fillStyle = theme.gateHi;
    ctx.fillRect(cx - 7, topY + 2, 1, 1);
    ctx.fillRect(cx + 6, topY + 2, 1, 1);

    // Side stone/steel gate frame jambs
    ctx.fillStyle = 'rgba(10, 14, 18, 0.55)';
    ctx.fillRect(cx - 7, topY + 6, 1, totalH - 6);
    ctx.fillRect(cx + 6, topY + 6, 1, totalH - 6);

    // 4 heavy vertical dark-iron portcullis bars
    const barOffsets = [-5, -2, 1, 4];
    for (const bo of barOffsets) {
      ctx.fillStyle = '#1c2228';
      ctx.fillRect(cx + bo, topY + 5, 2, Math.max(1, closedH - 5));
      ctx.fillStyle = theme.gateBar;
      ctx.fillRect(cx + bo, topY + 5, 1, Math.max(1, closedH - 5));
    }

    // Just 1 upper structural brace + heavy bottom lock bar with sharp downward teeth
    if (closedH > 18) {
      ctx.fillStyle = '#252d36';
      ctx.fillRect(cx - 6, topY + Math.floor(closedH * 0.45), 12, 2);
      ctx.fillStyle = theme.gateHi;
      ctx.fillRect(cx - 6, topY + Math.floor(closedH * 0.45), 12, 1);
    }
    const botY = topY + closedH - 2;
    ctx.fillStyle = '#252d36';
    ctx.fillRect(cx - 6, botY, 12, 2);
    ctx.fillStyle = theme.gateHi;
    ctx.fillRect(cx - 6, botY, 12, 1);
    // Sharp downward portcullis spikes along bottom bar
    ctx.fillStyle = '#cdd6e0';
    for (const bo of barOffsets) {
      ctx.fillRect(cx + bo, botY + 2, 1, 3);
    }
  }

  // Slicer traps (CERN beam shutters / guillotine jaws with permanent emitter rails)
  for (const s of room.slicers.values()) {
    const cx = tileCenterX(s.col);
    const fy = floorY(s.row);
    const topY = s.row * TILE_H;
    const spanH = fy - topY;
    const st = level.getSlicerState(room.id, s.col, s.row, time);

    // Permanent vertical side guide rails so open beam shutters remain unmistakable!
    ctx.fillStyle = '#26344a';
    ctx.fillRect(cx - 6, topY + 4, 2, spanH - 6);
    ctx.fillRect(cx + 4, topY + 4, 2, spanH - 6);
    ctx.fillStyle = '#4e6c96';
    ctx.fillRect(cx - 5, topY + 5, 1, spanH - 8);
    ctx.fillRect(cx + 4, topY + 5, 1, spanH - 8);
    // Subtle intermittent guide ticks along rail
    ctx.fillStyle = st.closed ? '#ff4466' : st.warning ? '#ffd044' : '#3eb8e0';
    ctx.fillRect(cx - 6, topY + Math.floor(spanH * 0.5), 1, 2);
    ctx.fillRect(cx + 5, topY + Math.floor(spanH * 0.5), 1, 2);

    // Heavy emitter housings top & bottom
    ctx.fillStyle = '#182233';
    ctx.fillRect(cx - 7, topY, 14, 6);
    ctx.fillRect(cx - 7, fy - 4, 14, 4);
    ctx.fillStyle = '#527099';
    ctx.fillRect(cx - 7, topY + 5, 14, 1);
    ctx.fillRect(cx - 7, fy - 4, 14, 1);
    // Status LED
    ctx.fillStyle = st.closed ? '#ff3355' : st.warning ? '#ffcc33' : '#40d8ff';
    ctx.fillRect(cx - 3, topY + 2, 6, 2);
    ctx.fillRect(cx - 2, fy - 2, 4, 1);

    if (st.closed) {
      // Snapped shut lethal high-energy beam shutter
      ctx.fillStyle = 'rgba(255, 66, 110, 0.35)';
      ctx.fillRect(cx - 5, topY + 6, 10, spanH - 10);
      ctx.fillStyle = theme.slicerCol;
      ctx.fillRect(cx - 3, topY + 6, 6, spanH - 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, topY + 6, 2, spanH - 10);
    } else if (st.warning) {
      // Closing jaws + pulsing laser target beam
      const jaw = Math.round((1 - st.openness) * 16);
      ctx.fillStyle = theme.slicerCol;
      ctx.fillRect(cx - 3, topY + 6, 6, jaw);
      ctx.fillRect(cx - 3, fy - 4 - jaw, 6, jaw);
      ctx.fillStyle = 'rgba(255, 90, 120, 0.55)';
      ctx.fillRect(cx - 1, topY + 6, 2, spanH - 10);
    } else {
      // Faint dotted alignment laser when safe/open so hazard column is always clear
      ctx.fillStyle = 'rgba(80, 210, 255, 0.24)';
      for (let y = topY + 8; y < fy - 6; y += 5) {
        ctx.fillRect(cx, y, 1, 2);
      }
    }
  }
}

function drawItems(ctx, room, time) {
  for (const it of room.items) {
    if (it.collected) continue;
    const x = Math.round(it.x);
    const y = Math.round(it.y);
    const bob = Math.sin(time * 4 + it.col) * 1;

    if (it.type === 'sword') {
      // Guild Sabre resting on stone pedestal / floor with golden glint
      ctx.fillStyle = '#3a3022';
      ctx.fillRect(x - 10, y - 2, 20, 2);
      ctx.strokeStyle = '#eef5ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 3 + bob * 0.4);
      ctx.lineTo(x + 10, y - 6 + bob * 0.4);
      ctx.stroke();
      ctx.fillStyle = '#e0b341';
      ctx.fillRect(x - 11, y - 5 + bob * 0.4, 3, 4);
      if (Math.sin(time * 5) > 0.6) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 3, y - 7, 2, 2);
      }
    } else {
      // Elixir flask: small (crimson), large (tall gold-rimmed crimson), poison (bluish)
      const isLarge = it.type === 'large_elixir';
      const isPoison = it.type === 'poison';
      const fill = isPoison ? '#3a86e8' : '#e02f3f';
      const hi = isPoison ? '#99d4ff' : '#ff9ca6';
      const h = isLarge ? 9 : 6;
      const w = isLarge ? 7 : 5;

      // Subtle glow
      ctx.fillStyle = isPoison ? 'rgba(60,140,255,0.22)' : 'rgba(255,70,90,0.22)';
      ctx.beginPath();
      ctx.arc(x, y - h / 2, isLarge ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Flask body
      ctx.fillStyle = fill;
      ctx.fillRect(x - Math.floor(w / 2), y - h, w, h);
      // Neck
      ctx.fillStyle = '#d4dde6';
      ctx.fillRect(x - 1, y - h - 2, 2, 2);
      // Specular highlight
      ctx.fillStyle = hi;
      ctx.fillRect(x - Math.floor(w / 2) + 1, y - h + 1, 1, Math.max(2, h - 3));
      // Large elixir gold ring
      if (isLarge) {
        ctx.fillStyle = '#f2c94c';
        ctx.fillRect(x - 3, y - h, 6, 1);
      }
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

  // Left: Player health pips (Swiss red squares with white cross)
  const startX = 8;
  const pipY = y0 + 8;
  for (let i = 0; i < player.maxHp; i++) {
    const px = startX + i * 11;
    if (i < player.hp) {
      ctx.fillStyle = '#d62828';
      ctx.fillRect(px, pipY, 8, 8);
      ctx.fillStyle = '#f5f4ef';
      ctx.fillRect(px + 3, pipY + 2, 2, 4);
      ctx.fillRect(px + 2, pipY + 3, 4, 2);
    } else {
      ctx.strokeStyle = '#633036';
      ctx.lineWidth = 1;
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
      activeEnemy.type === 'zins' ? '#e6a832' : '#d67028';
    for (let i = 0; i < activeEnemy.maxHp; i++) {
      const px = VIEW_W - 16 - i * 10;
      if (i < activeEnemy.hp) {
        ctx.fillStyle = pipColor;
        ctx.fillRect(px, pipY, 7, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(px + 1, pipY + 1, 5, 1);
      } else {
        ctx.strokeStyle = '#4a4038';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, pipY + 0.5, 6, 7);
      }
    }
    if (activeEnemy.name) {
      const pipsLeft = VIEW_W - 16 - Math.max(0, activeEnemy.maxHp - 1) * 10 - 6;
      drawPixelText(ctx, activeEnemy.name, pipsLeft, y0 + 12, {
        color: '#d4cfc2',
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
  drawPixelText(ctx, 'PRINCE OF ZURICH', VIEW_W / 2, 40, {
    scale: 2,
    color: '#f5f1e6',
    align: 'center',
    baseline: 'middle',
    shadow: '#090d14',
  });

  drawPixelText(ctx, 'OPERATION SECHSELAEUTEN - 60 MINUTES TO MIDNIGHT', VIEW_W / 2, 58, {
    color: '#e0bf72',
    align: 'center',
    baseline: 'middle',
    shadow: '#090d14',
  });

  // Menu box
  const hasSave = !!game.savedGame;
  const menuY = 128;
  const items = hasSave
    ? [
        { label: `CONTINUE (LEVEL ${game.savedGame.levelIndex + 1} - ${formatTime(game.savedGame.timeRemaining)})` },
        { label: 'NEW GAME' },
      ]
    : [{ label: 'START GAME' }];

  for (let i = 0; i < items.length; i++) {
    const sel = i === game.titleSelection;
    const y = menuY + i * 20;
    if (sel) {
      ctx.fillStyle = 'rgba(201, 36, 43, 0.88)';
      ctx.fillRect(VIEW_W / 2 - 118, y - 8, 236, 16);
      ctx.strokeStyle = '#f5f1e6';
      ctx.lineWidth = 1;
      ctx.strokeRect(VIEW_W / 2 - 117.5, y - 7.5, 235, 15);
    } else {
      ctx.fillStyle = 'rgba(10, 14, 22, 0.74)';
      ctx.fillRect(VIEW_W / 2 - 118, y - 8, 236, 16);
    }
    drawPixelText(ctx, (sel ? '> ' : '  ') + items[i].label, VIEW_W / 2, y, {
      color: sel ? '#ffffff' : '#b8c0cc',
      align: 'center',
      baseline: 'middle',
    });
  }

  // Controls footer (crisp 2-line pixel readout)
  drawPixelText(ctx, 'ARROWS: MOVE/JUMP/CLIMB  SHIFT: CAREFUL/HANG/STRIKE  UP: PARRY', VIEW_W / 2, 192, {
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

function renderStoryScreen(ctx, game) {
  const card = game.activeCard;
  // Background
  if (game.mode === 'intro' || game.mode === 'victory' || game.mode === 'timeout') {
    drawTitleBackdrop(ctx, VIEW_W, VIEW_H, game.time, { showClock: false });
  } else {
    drawBackdrop(ctx, Math.min(4, game.levelIndex), VIEW_W, VIEW_H, game.time, 999);
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
    drawPixelText(ctx, lines[i], 30, 54 + i * 13, {
      color: '#ece9e0',
    });
  }

  // Prompt bottom
  const prompt = game.mode === 'victory'
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
  ctx.fillRect(58, 64, VIEW_W - 116, 62);
  ctx.strokeStyle = '#d1343a';
  ctx.lineWidth = 1;
  ctx.strokeRect(58.5, 64.5, VIEW_W - 117, 61);

  drawPixelText(ctx, game.deathReason || 'PRINZ HAS FALLEN', VIEW_W / 2, 82, {
    color: '#ff6b70',
    align: 'center',
    baseline: 'middle',
  });
  drawPixelText(ctx, 'THE CLOCK KEEPS RUNNING...', VIEW_W / 2, 98, {
    color: '#d8dce4',
    align: 'center',
    baseline: 'middle',
  });
  drawPixelText(ctx, 'PRESS R, SPACE OR ENTER TO RETRY', VIEW_W / 2, 113, {
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
