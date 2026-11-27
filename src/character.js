// src/character.js
// High-detail 2x articulated skeletal character animation & rendering engine.
// Features:
//   - Anatomically proportioned rig (head, neck, counter-rotating shoulders & hips,
//     upper/lower arms, hands, thighs, shins, heeled boots with toe/turnout)
//   - Analytical two-bone IK for legs, sword arm, and ledge-gripping arms (constant limb lengths)
//   - World-space foot-planting during fencing steps, lunges, careful steps, and run stance
//   - Authentic fencing choreography synced to existing Player/Enemy combat timers
//   - Smooth per-entity pose cross-fading & spring-damped secondary motion (hair, scarf/hem, blade lag)
//   - Distinct silhouettes per character & guard archetype (hero, rookie, junior, sentry, brawler, duellist, zins, deepfake, celine)

import { floorY, TILE_W } from './level.js';

// Must match ISO projection in render.js
const ISO_DX = 9;
const ISO_DY = -8;
const SLAB_FRONT_OFF = 2;

// ---------------------------------------------------------------------------
// Math & Easing Helpers
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  if (e1 <= e0) return x >= e1 ? 1 : 0;
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t) {
  const u = clamp(t, 0, 1);
  return 1 - (1 - u) * (1 - u) * (1 - u);
}

function easeInOutQuad(t) {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

function easeOutBack(t, s = 1.15) {
  const u = clamp(t, 0, 1) - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

function degRad(d) {
  return (d * Math.PI) / 180;
}

function angleLerp(a, b, t) {
  let diff = ((b - a + 540) % 360) - 180;
  return a + diff * t;
}

// ---------------------------------------------------------------------------
// Analytical Two-Bone IK Solver (constant segment lengths, zero snapping)
// bendDir: -1 bends knees forward (+x in +y down space); +1 bends arms down/back
// ---------------------------------------------------------------------------

function solveTwoBoneIK(root, target, L1, L2, bendDir) {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const rawD = Math.hypot(dx, dy);
  const minD = Math.abs(L1 - L2) + 0.08;
  const maxD = L1 + L2 - 0.06;
  const d = clamp(rawD, minD, maxD);

  const baseAngle = rawD > 1e-5 ? Math.atan2(dy, dx) : Math.PI * 0.5;
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const jointAngle = baseAngle + bendDir * Math.acos(cosA);

  const mid = {
    x: root.x + Math.cos(jointAngle) * L1,
    y: root.y + Math.sin(jointAngle) * L1,
  };
  const end = rawD > maxD
    ? { x: root.x + Math.cos(baseAngle) * maxD, y: root.y + Math.sin(baseAngle) * maxD }
    : rawD < minD
      ? { x: root.x + Math.cos(baseAngle) * minD, y: root.y + Math.sin(baseAngle) * minD }
      : { x: target.x, y: target.y };
  return { mid, end };
}

// ---------------------------------------------------------------------------
// Character Profiles & Archetype Silhouettes
// ---------------------------------------------------------------------------

const ARCHETYPE_VISUALS = {
  hero: {
    heightScale: 1.0,
    widthScale: 1.0,
    skin: '#f0c49b',
    skinShade: '#cfa078',
    hair: '#291c16',
    hairHi: '#4a3529',
    jacket: '#cf2a2c',       // Iconic Swiss courier crimson
    jacketHi: '#ea4949',
    jacketDark: '#8a191b',
    accent: '#f5f4ef',       // White courier messenger strap
    pants: '#2b3442',
    pantsHi: '#3d4a5e',
    pantsDark: '#19202b',
    boots: '#16181e',
    bootSole: '#090a0d',
    sword: '#eaf2fa',
    swordShade: '#9db0c4',
    hilt: '#dfb348',
    hiltDark: '#8c6920',
    headwear: 'hair_courier',
    coatStyle: 'courier',
    scarfColor: '#f2f0e8',
    scarfStripe: '#b82024',
    swordStyle: 'sabre',
    swordLen: 17.8,
  },
  deepfake: {
    heightScale: 1.0,
    widthScale: 1.0,
    skin: '#96e8ff',
    skinShade: '#4aa5cc',
    hair: '#254470',
    hairHi: '#5992d4',
    jacket: '#36c2e8',
    jacketHi: '#88ecff',
    jacketDark: '#19648a',
    accent: '#d678ff',
    pants: '#223b66',
    pantsHi: '#385d99',
    pantsDark: '#12203b',
    boots: '#0f1b33',
    bootSole: '#070d1a',
    sword: '#c4f6ff',
    swordShade: '#5eb8d9',
    hilt: '#c96eff',
    hiltDark: '#6f2e9c',
    headwear: 'hair_courier',
    coatStyle: 'courier',
    scarfColor: '#d678ff',
    scarfStripe: '#5ee8ff',
    swordStyle: 'sabre',
    swordLen: 17.8,
    glitch: true,
  },
  rookie: {
    heightScale: 0.97,
    widthScale: 0.95,
    skin: '#e2b690',
    skinShade: '#bd906b',
    hair: '#3a322a',
    hairHi: '#5c4f44',
    jacket: '#6e7b68',       // Lighter khaki-olive rookie vest
    jacketHi: '#8a9984',
    jacketDark: '#475243',
    accent: '#d8b559',
    pants: '#363f3b',
    pantsHi: '#4a5751',
    pantsDark: '#212725',
    boots: '#171a19',
    bootSole: '#090b0a',
    sword: '#d6e1ea',
    swordShade: '#889aa8',
    hilt: '#c8a349',
    hiltDark: '#7a5f22',
    headwear: 'cap_flat',
    capColor: '#48574c',
    capVisor: '#232b26',
    coatStyle: 'tunic',
    shortSleeves: true,      // Rolled-up sleeves distinguish rookies at a glance!
    swordStyle: 'short_sabre',
    swordLen: 16.5,
  },
  junior: {
    heightScale: 1.0,
    widthScale: 1.0,
    skin: '#e0b38c',
    skinShade: '#bc8f6a',
    hair: '#252a30',
    hairHi: '#444d57',
    jacket: '#436355',       // Rich Paradeplatz forest-emerald tunic
    jacketHi: '#5e8775',
    jacketDark: '#283d34',
    accent: '#e6c15a',
    pants: '#2b3634',
    pantsHi: '#3d4c49',
    pantsDark: '#19211f',
    boots: '#131717',
    bootSole: '#080a0a',
    sword: '#dce6ef',
    swordShade: '#8e9fae',
    hilt: '#dab24c',
    hiltDark: '#826520',
    headwear: 'cap_peaked',
    capColor: '#2d473c',
    capVisor: '#141f1a',
    coatStyle: 'epaulette',
    swordStyle: 'sabre',
    swordLen: 17.5,
  },
  sentry: {
    heightScale: 1.03,
    widthScale: 1.02,
    skin: '#deb089',
    skinShade: '#b88b66',
    hair: '#23282e',
    hairHi: '#404852',
    jacket: '#323f4a',       // Disciplined dark slate-blue alpine patrol coat
    jacketHi: '#4a5d6e',
    jacketDark: '#1d262e',
    accent: '#d93842',       // Crisp Swiss crimson sash/collar accent
    pants: '#222a33',
    pantsHi: '#33404d',
    pantsDark: '#141920',
    boots: '#121518',
    bootSole: '#080a0c',
    sword: '#e2ebf2',
    swordShade: '#90a3b2',
    hilt: '#d9b14c',
    hiltDark: '#806421',
    headwear: 'beret_crest',
    capColor: '#8c222a',     // Distinct crimson Alpine guard beret!
    capVisor: '#16211e',
    coatStyle: 'sentry',
    swordStyle: 'sabre',
    swordLen: 18.0,
  },
  brawler: {
    heightScale: 1.05,
    widthScale: 1.18,
    skin: '#deb18a',
    skinShade: '#b58863',
    hair: '#25282c',
    hairHi: '#454a52',
    jacket: '#43524f',
    jacketHi: '#5d706c',
    jacketDark: '#27302e',
    vestColor: '#242b2e',
    vestHi: '#3c464a',
    accent: '#d99838',
    pants: '#283033',
    pantsHi: '#3a464a',
    pantsDark: '#171c1f',
    boots: '#121417',
    bootSole: '#07080a',
    sword: '#dfe7ee',
    swordShade: '#8494a3',
    hilt: '#d49a38',
    hiltDark: '#7a5216',
    headwear: 'helmet_heavy',
    capColor: '#2c363b',
    capVisor: '#171d21',
    coatStyle: 'armored',
    swordStyle: 'broadsword',
    swordLen: 18.4,
  },
  brawler_elite: {
    heightScale: 1.06,
    widthScale: 1.18,
    skin: '#e2ba94',
    skinShade: '#bc926e',
    hair: '#1e242c',
    hairHi: '#3a4452',
    jacket: '#8b99ab',
    jacketHi: '#b4c2d4',
    jacketDark: '#556170',
    vestColor: '#2a3442',
    vestHi: '#445369',
    accent: '#d93b48',
    pants: '#26303d',
    pantsHi: '#394759',
    pantsDark: '#161d26',
    boots: '#11151c',
    bootSole: '#07090d',
    sword: '#edf5ff',
    swordShade: '#90a7bf',
    hilt: '#4ea8d9',
    hiltDark: '#255c7d',
    headwear: 'helmet_heavy',
    capColor: '#374557',
    capVisor: '#1b232e',
    coatStyle: 'armored',
    swordStyle: 'broadsword',
    swordLen: 18.6,
  },
  duellist: {
    heightScale: 1.04,
    widthScale: 0.96,
    skin: '#e8c09a',
    skinShade: '#c29873',
    hair: '#1d242e',
    hairHi: '#3d4a5c',
    jacket: '#c4cfdc',
    jacketHi: '#e6eef7',
    jacketDark: '#7f8d9e',
    accent: '#d63846',       // Crimson asymmetric fencing plastron
    pants: '#283240',
    pantsHi: '#3b495e',
    pantsDark: '#171e29',
    boots: '#12171f',
    bootSole: '#070a0f',
    sword: '#f2f8ff',
    swordShade: '#9cb5cc',
    hilt: '#52b0e0',
    hiltDark: '#276485',
    headwear: 'visor_sleek',
    capColor: '#3d4c5e',
    capVisor: '#18212b',
    coatStyle: 'fencer',
    swordStyle: 'rapier',
    swordLen: 19.2,
  },
  zins: {
    heightScale: 1.09,
    widthScale: 1.05,
    skin: '#dfb592',
    skinShade: '#b58966',
    hair: '#b8c2cf',         // Aristocratic silver hair (high contrast with skin)
    hairHi: '#edf3fa',
    jacket: '#21242d',       // Bespoke banker coat
    jacketHi: '#383d4c',
    jacketDark: '#111319',
    accent: '#d62736',       // Crimson tie & pocket square
    shirt: '#f4f2ec',
    pants: '#1a1d26',
    pantsHi: '#2c3140',
    pantsDark: '#0e1017',
    boots: '#0d0e12',
    bootSole: '#050608',
    sword: '#ffffff',
    swordShade: '#b4c2d4',
    hilt: '#f2c652',
    hiltDark: '#99721e',
    headwear: 'hair_zins',
    coatStyle: 'suit_tails',
    swordStyle: 'ornate_rapier',
    swordLen: 19.6,
  },
  celine: {
    heightScale: 0.97,
    widthScale: 0.92,
    skin: '#f2c8a2',
    skinShade: '#cfa27c',
    hair: '#4f2e1f',
    hairHi: '#784832',
    jacket: '#2b456e',
    jacketHi: '#426499',
    jacketDark: '#1a2c47',
    accent: '#f2e8d5',
    pants: '#242936',
    pantsHi: '#363d4f',
    pantsDark: '#151821',
    boots: '#1a181c',
    bootSole: '#0a090c',
    sword: null,
    hilt: null,
    headwear: 'hair_celine',
    coatStyle: 'blazer',
    swordStyle: null,
    swordLen: 0,
  },
};

function resolveProfile(ent) {
  if (ent.palette === 'celine') return ARCHETYPE_VISUALS.celine;
  if (ent.palette === 'hero') return ARCHETYPE_VISUALS.hero;
  if (ent.type === 'zins' || ent.palette === 'zins') return ARCHETYPE_VISUALS.zins;
  if (ent.type === 'deepfake' || ent.palette === 'deepfake') return ARCHETYPE_VISUALS.deepfake;

  const arch = ent.archetype;
  if (arch === 'rookie') return ARCHETYPE_VISUALS.rookie;
  if (arch === 'junior') return ARCHETYPE_VISUALS.junior;
  if (arch === 'brawler') {
    return ent.type === 'elite' ? ARCHETYPE_VISUALS.brawler_elite : ARCHETYPE_VISUALS.brawler;
  }
  if (arch === 'duellist') return ARCHETYPE_VISUALS.duellist;
  if (arch === 'sentry') return ARCHETYPE_VISUALS.sentry;
  if (ent.type === 'elite' || ent.palette === 'elite') return ARCHETYPE_VISUALS.duellist;
  return ARCHETYPE_VISUALS.sentry;
}

// ---------------------------------------------------------------------------
// Per-Entity Visual Animation State (blending, secondary motion, clash sparks)
// ---------------------------------------------------------------------------

const entityVisMap = new WeakMap();

function getEntityVis(ent, time) {
  let vis = entityVisMap.get(ent);
  if (!vis) {
    vis = {
      lastTime: time,
      lastX: ent.x,
      lastY: ent.y,
      lastAnim: ent.anim || 'idle',
      lastSwordDrawn: !!ent.swordDrawn,
      lastParrySuccess: !!ent.parrySuccess,
      blendFrom: null,
      blendT: 1,
      blendDur: 0.08,
      drawTimer: 0,
      clashSparkT: 0,
      lastPose: null,
      // Spring-damped secondary motion
      hairAng: 0,
      hairVel: 0,
      hemAng: 0,
      hemVel: 0,
      swordLag: 0,
      swordLagVel: 0,
      lastSwordAngle: 95,
    };
    entityVisMap.set(ent, vis);
  }
  return vis;
}

// ---------------------------------------------------------------------------
// Pose Factory & Interpolation
// ---------------------------------------------------------------------------

const BASE_ANKLE_Y = -1.5;

function makePose(o = {}) {
  return {
    pelvisX: o.pelvisX ?? 0,
    pelvisY: o.pelvisY ?? -14.8,
    torsoLean: o.torsoLean ?? 4,
    headTilt: o.headTilt ?? 2,
    hipYaw: o.hipYaw ?? 0.28,
    shoulderYaw: o.shoulderYaw ?? 0.25,

    lFootX: o.lFootX ?? -2.4,
    lFootY: o.lFootY ?? BASE_ANKLE_Y,
    lFootAngle: o.lFootAngle ?? 0,
    lFootTurnOut: o.lFootTurnOut ?? 0,

    rFootX: o.rFootX ?? 2.8,
    rFootY: o.rFootY ?? BASE_ANKLE_Y,
    rFootAngle: o.rFootAngle ?? 0,
    rFootTurnOut: o.rFootTurnOut ?? 0,

    lHandX: o.lHandX ?? -2.5,
    lHandY: o.lHandY ?? -14.5,
    lElbowBend: o.lElbowBend ?? 1,

    rHandX: o.rHandX ?? 3.6,
    rHandY: o.rHandY ?? -14.8,
    rElbowBend: o.rElbowBend ?? 1,

    fkArms: o.fkArms ?? null, // Optional direct FK arms { rUpper, rElbow, lUpper, lElbow } (bypasses IK during run!)
    swordAngle: o.swordAngle ?? 98,
    swordVisibleOverride: o.swordVisibleOverride ?? null, // null = follow ent.swordDrawn, true/false = force
    sheatheSlide: o.sheatheSlide ?? 0, // 0 = full length, 0..1 = sliding into scabbard
    heldFlask: o.heldFlask ?? null,
    lungeSlash: o.lungeSlash ?? 0,
    clampFeet: o.clampFeet ?? true,
    faceYaw: o.faceYaw ?? 1, // +1 = facing forward (+x), 0 = front-facing toward camera, -1 = facing backward (-x)
  };
}

function blendPose(a, b, t) {
  const u = clamp(t, 0, 1);
  return {
    pelvisX: lerp(a.pelvisX, b.pelvisX, u),
    pelvisY: lerp(a.pelvisY, b.pelvisY, u),
    torsoLean: lerp(a.torsoLean, b.torsoLean, u),
    headTilt: lerp(a.headTilt, b.headTilt, u),
    hipYaw: lerp(a.hipYaw, b.hipYaw, u),
    shoulderYaw: lerp(a.shoulderYaw, b.shoulderYaw, u),

    lFootX: lerp(a.lFootX, b.lFootX, u),
    lFootY: lerp(a.lFootY, b.lFootY, u),
    lFootAngle: lerp(a.lFootAngle, b.lFootAngle, u),
    lFootTurnOut: lerp(a.lFootTurnOut, b.lFootTurnOut, u),

    rFootX: lerp(a.rFootX, b.rFootX, u),
    rFootY: lerp(a.rFootY, b.rFootY, u),
    rFootAngle: lerp(a.rFootAngle, b.rFootAngle, u),
    rFootTurnOut: lerp(a.rFootTurnOut, b.rFootTurnOut, u),

    lHandX: lerp(a.lHandX, b.lHandX, u),
    lHandY: lerp(a.lHandY, b.lHandY, u),
    lElbowBend: u < 0.5 ? a.lElbowBend : b.lElbowBend,

    rHandX: lerp(a.rHandX, b.rHandX, u),
    rHandY: lerp(a.rHandY, b.rHandY, u),
    rElbowBend: u < 0.5 ? a.rElbowBend : b.rElbowBend,

    fkArms: (a.fkArms && b.fkArms) ? {
      rUpper: lerp(a.fkArms.rUpper, b.fkArms.rUpper, u),
      rElbow: lerp(a.fkArms.rElbow, b.fkArms.rElbow, u),
      lUpper: lerp(a.fkArms.lUpper, b.fkArms.lUpper, u),
      lElbow: lerp(a.fkArms.lElbow, b.fkArms.lElbow, u),
    } : null,
    swordAngle: angleLerp(a.swordAngle, b.swordAngle, u),
    swordVisibleOverride: b.swordVisibleOverride,
    sheatheSlide: b.sheatheSlide,
    heldFlask: b.heldFlask,
    lungeSlash: b.lungeSlash,
    clampFeet: b.clampFeet,
    faceYaw: lerp(a.faceYaw ?? 1, b.faceYaw ?? 1, u),
  };
}

// Helper: compute exact elbow & wrist joints from shoulder using authentic FK angles
// upperDeg: 0 = straight down (+y), + = forward (+x), - = backward (-x)
// elbowFlexDeg: bend angle at elbow (80..100 deg = compact athletic runner's bend forward)
function fkArmJoints(shoulderX, shoulderY, upperDeg, elbowFlexDeg, L1 = 5.0, L2 = 4.3) {
  const r1 = degRad(upperDeg);
  const r2 = degRad(upperDeg + elbowFlexDeg);
  const mid = {
    x: shoulderX + Math.sin(r1) * L1,
    y: shoulderY + Math.cos(r1) * L1,
  };
  const end = {
    x: mid.x + Math.sin(r2) * L2,
    y: mid.y + Math.cos(r2) * L2,
  };
  return { mid, end };
}

function fkArmHand(shoulderX, shoulderY, upperDeg, elbowFlexDeg, L1 = 5.0, L2 = 4.3) {
  return fkArmJoints(shoulderX, shoulderY, upperDeg, elbowFlexDeg, L1, L2).end;
}

// Helper: compute exact ankle target from hip using authentic FK leg angles
// hipDeg: 0 = straight down (+y), + = thigh forward (+x), - = thigh extended behind (-x)
// kneeFlexDeg: flexion of shin behind thigh (0 = straight, 90 = right angle, 125 = heel-to-buttock)
function fkLegAnkle(hipX, hipY, hipDeg, kneeFlexDeg, L1 = 7.3, L2 = 7.2) {
  const r1 = degRad(hipDeg);
  const r2 = degRad(hipDeg - kneeFlexDeg);
  const kx = hipX + Math.sin(r1) * L1;
  const ky = hipY + Math.cos(r1) * L1;
  return {
    x: kx + Math.sin(r2) * L2,
    y: ky + Math.cos(r2) * L2,
  };
}

// Exact lowest Y offset below ankle for a profile boot rotated by angleDeg (matches drawBoot vertices!)
// Guarantees ZERO floor penetration at heel-strike (a < 0) and toe-off (a > 0)!
function bootLowestOffsetY(angleDeg, hS = 1.0) {
  const rad = degRad(angleDeg);
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  const ah = 1.5 * hS;
  const yHeel = -1.40 * s + ah * c;
  const yBall =  2.20 * s + ah * c;
  const yToe  =  3.55 * s + (ah - 0.15) * c;
  return Math.max(ah, yHeel, yBall, yToe);
}

// Periodic Catmull-Rom spline over evenly spaced keyframes [v0, v1, ..., v_{N-1}] for t in [0, 1)
function samplePeriodicSpline(vals, t01) {
  const n = vals.length;
  const u = (((t01 % 1) + 1) % 1) * n;
  const i1 = Math.floor(u) % n;
  const f = u - Math.floor(u);
  const i0 = (i1 - 1 + n) % n;
  const i2 = (i1 + 1) % n;
  const i3 = (i1 + 2) % n;
  const p0 = vals[i0];
  const p1 = vals[i1];
  const p2 = vals[i2];
  const p3 = vals[i3];
  const f2 = f * f;
  const f3 = f2 * f;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * f +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * f3
  );
}

// Exact in-game horizontal travel per full 2-step run cycle (gameplay constants untouched)
// RUN_SPEED = 104 px/s * RUN_CYCLE_DUR = 0.42s = 43.68 logical px per cycle!
const RUN_CYCLE_DIST = 104 * 0.42; // 43.68 logical px

// Canonical 6-phase per-step pelvis height (phase-aligned with Contact at F6/F12, Mid-Stance LOWEST at F7/F1,
// Drive at F8/F2, Toe-Off at F9/F3, Early Flight at F10/F4, Mid-Flight PEAK at F11/F5):
//   0/6 (F12, F6): Initial Contact (-15.00) -> flexed shock-absorbing knee, foot on ground line close under COM!
//   1/6 (F1,  F7): Mid-Stance      (-14.48) -> LOWEST body point (clear athletic knee give & weight absorption!)
//   2/6 (F2,  F8): Drive           (-15.08) -> rising powerfully
//   3/6 (F3,  F9): Toe-Off         (-15.62) -> crisp diagonal triple extension
//   4/6 (F4, F10): Early Flight    (-16.58) -> airborne #1!
//   5/6 (F5, F11): Mid-Flight Peak (-17.02) -> PEAK AIRBORNE APEX! (both feet well off ground, lead knee bent ~40°!)
const RUN_PELVIS_Y_HALF = [-15.05, -14.68, -15.18, -16.12, -16.68, -17.05];

// Canonical 12-phase joint-angle keyframes for ONE leg (indexed by leg-local phase tLeg = 0 at Contact):
//   0 (0/12, F12/F6): Contact      1 (1/12, F1/F7): Mid-Stance    2 (2/12, F2/F8): Drive         3 (3/12, F3/F9): Toe-Off
//   4 (4/12, F4/F10): Early Flight 5 (5/12, F5/F11): Mid-Flight   6 (6/12, F6/F12): Opp Contact  7 (7/12, F7/F1): Opp Mid-Stance
//   8 (8/12, F8/F2):  Opp Drive    9 (9/12, F9/F3): Opp Toe-Off  10 (10/12, F10/F4): Lead Flight 11 (11/12, F11/F5): Mid-Flight Lead
const RUN_SWING_HIP_DEG   = [ 16,  10,  -8, -22, -25, -18,  -4,  24,  48,  65,  58,  42];
const RUN_SWING_KNEE_DEG  = [ 28,  40,  22,  12,  72, 108, 126, 122, 100,  80,  56,  42];
// Anatomical shin-to-foot interior ankle angle (90° = neutral perpendicular, 115-130° = relaxed plantar-flexed):
//   - Toe-off (3): plantar-flexed (~110°) with toe last to leave ground
//   - Folded recovery (4-7): relaxed plantar-flexed (122-126°), toes pointing back & down, sole facing back/up!
//   - Knee drive -> landing prep (8-11): smoothly dorsiflexes back to ~88-90° ready for midfoot strike!
const RUN_SWING_ANKLE_INT = [ 90,  90,  96, 112, 124, 126, 125, 122, 108,  96,  90,  88];

// Convert anatomical shin-to-foot interior angle (90° = neutral, 120° = relaxed plantar-flexed)
// into drawBoot's world rotation angle (0° = horizontal +x, + = clockwise toe-down)
function ankleInteriorToBootAngle(shinFromDownDeg, ankleInteriorDeg) {
  return ankleInteriorDeg - 90 - shinFromDownDeg;
}

// Subtle symmetrical hip yaw (indexed by leg-local phase, keeping hip joint tight inside pelvis!)
const RUN_HIP_YAW = [0.18, 0.08, -0.06, -0.18, -0.18, -0.08, -0.18, -0.08, 0.06, 0.18, 0.18, 0.08];

// Pure sinusoidal antiphase FK run arm driver (ZERO 4-frame plateau!):
//   - Forward peak (F4-5 near, F10-11 far): upper arm +22.5°, elbow CLOSED to ~64° interior (116° flex),
//     so forearm points ~49° up-and-forward and fist sits compactly at sternum/upper chest below chin (<= 0.85 L_fore ahead)!
//   - Back peak (F10-11 near, F4-5 far): upper arm -56°, elbow OPENED to ~106° interior (74° flex),
//     so elbow protrudes clearly behind torso back line and wrist sits cleanly beside/behind hip!
//   - Smooth sinusoidal breathing across all 12 frames; zero crossing between F1 & F2 (and F7 & F8).
function evalRunArmAngles(t) {
  const phi = (t - 0.055) * Math.PI * 2;
  const s = Math.sin(phi);
  const mapUpper = (v) => (v >= 0 ? v * 22.0 : v * 58.0);
  // Interior angle breathes smoothly from 106° (back peak -> 74° flex) to 62° (forward peak -> 118° flex)!
  const mapElbow = (v) => lerp(74, 118, (v + 1) * 0.5);
  return {
    s,
    rUpper: mapUpper(s),
    rElbow: mapElbow(s),
    lUpper: mapUpper(-s),
    lElbow: mapElbow(-s),
  };
}

function sampleRunLeg(phase01, hipX, hipY) {
  const t = ((phase01 % 1) + 1) % 1;

  // STANCE PHASE (t in [0.000, 0.255] — F12, F1, F2, F3 for R; F6, F7, F8, F9 for L):
  // Single fixed boot-local ball pivot (PIVOT_X = 2.60, PIVOT_Y = 1.50) world-locked to
  // ballX(t) = 5.10 - RUN_CYCLE_DIST * t -> lands closer under COM (ankleX ~ +2.45, zero overstride!)
  // with 0.000px horizontal drift across ALL 4 stance frames and plantar-flexed toe-off (52°) kissing y = 0.000!
  const STANCE_END = 0.255;
  const BALL_START_X = 5.10;
  const PIVOT_X = 2.60;
  const PIVOT_Y = 1.50;

  if (t <= STANCE_END) {
    const ballX = BALL_START_X - RUN_CYCLE_DIST * t;
    let a = 0;
    if (t < 0.040) {
      // Soft near-level midfoot contact right under COM (zero heel-brake look!)
      const k = t / 0.040;
      a = lerp(-2, 0, easeOutCubic(k));
    } else if (t <= 0.115) {
      a = 0;
    } else {
      // Drive -> Toe-Off: strong plantarflexion to 52° with toe last to leave ground at y = 0.000!
      const k = (t - 0.115) / (STANCE_END - 0.115);
      const e = k * k * (2.2 - 1.2 * k);
      a = lerp(0, 52, e);
    }
    const rad = degRad(a);
    const pivRelX = PIVOT_X * Math.cos(rad) - PIVOT_Y * Math.sin(rad);
    return {
      x: ballX - pivRelX,
      y: -bootLowestOffsetY(a),
      a,
      onGround: true,
    };
  }

  // SWING & FLIGHT PHASE (t in (0.255, 1.000)):
  // Driven directly by smooth periodic FK joint-angle keyframes (hip, knee, anatomical ankle interior angle)
  const hipDeg = samplePeriodicSpline(RUN_SWING_HIP_DEG, t);
  const kneeFlex = clamp(samplePeriodicSpline(RUN_SWING_KNEE_DEG, t), 8, 134);
  const shinFromDown = hipDeg - kneeFlex;
  const ankleInt = clamp(samplePeriodicSpline(RUN_SWING_ANKLE_INT, t), 82, 132);
  const ankleDeg = ankleInteriorToBootAngle(shinFromDown, ankleInt);
  const fk = fkLegAnkle(hipX, hipY, hipDeg, kneeFlex, 7.3, 7.2);

  // Micro-blend at stance boundaries for C0 seam continuity
  if (t < 0.275) {
    const b = smoothstep(STANCE_END, 0.275, t);
    const ballEnd = BALL_START_X - RUN_CYCLE_DIST * STANCE_END;
    const rad = degRad(52);
    const ex = ballEnd - (PIVOT_X * Math.cos(rad) - PIVOT_Y * Math.sin(rad));
    const ey = -bootLowestOffsetY(52);
    return {
      x: lerp(ex, fk.x, b),
      y: lerp(ey, fk.y, b),
      a: lerp(52, ankleDeg, b),
      onGround: false,
    };
  }
  if (t > 0.975) {
    const b = smoothstep(0.975, 1.0, t);
    const rad = degRad(-2);
    const sx = BALL_START_X - (PIVOT_X * Math.cos(rad) - PIVOT_Y * Math.sin(rad));
    const sy = -bootLowestOffsetY(-2);
    return {
      x: lerp(fk.x, sx, b),
      y: lerp(fk.y, sy, b),
      a: lerp(ankleDeg, -2, b),
      onGround: false,
    };
  }

  return { x: fk.x, y: fk.y, a: ankleDeg, onGround: false };
}

function evalRunPose(u) {
  const t = ((u % 1) + 1) % 1;
  // Shift leg phase by +1/12 so Contact lands on F12/F6, Mid-Stance (lowest point) on F1/F7,
  // Drive on F2/F8, Toe-Off on F3/F9, and two-frame Flight on F4-5 / F10-11!
  const tLeg = (t + 1 / 12) % 1;
  const pelvisY = samplePeriodicSpline(RUN_PELVIS_Y_HALF, (tLeg * 2) % 1);
  const pelvisX = 0.55;

  // Constant 9.5° athletic forward lean across ALL 12 frames; level head!
  const torsoLean = 9.5;
  const headTilt = -torsoLean * 0.30; // headDeg = torsoLean * 0.3 + headTilt === 0°!

  const arms = evalRunArmAngles(t);
  const hipYaw = samplePeriodicSpline(RUN_HIP_YAW, tLeg);
  // Smooth torso counter-rotation peaking at stride extremes (keeps forward fist compact & back elbow clear!)
  const shoulderYaw = arms.s * 0.25;

  // Exact symmetrical hip & shoulder sockets matching solver in drawCharacter
  const rHipX = pelvisX + hipYaw * 1.65;
  const rHipY = pelvisY + 0.08;
  const lHipX = pelvisX - hipYaw * 1.65;
  const lHipY = pelvisY - 0.08;

  const leanRad = degRad(torsoLean);
  const chestX = pelvisX + Math.sin(leanRad) * 8.6;
  const chestY = pelvisY - Math.cos(leanRad) * 8.6;
  const rShX = chestX + shoulderYaw * 2.2;
  const rShY = chestY + 0.35;
  const lShX = chestX - shoulderYaw * 2.2;
  const lShY = chestY - 0.35;

  const rLeg = sampleRunLeg(tLeg, rHipX, rHipY);
  const lLeg = sampleRunLeg((tLeg + 0.5) % 1, lHipX, lHipY);

  const rHand = fkArmHand(rShX, rShY, arms.rUpper, arms.rElbow, 5.0, 4.3);
  const lHand = fkArmHand(lShX, lShY, arms.lUpper, arms.lElbow, 5.0, 4.3);

  return makePose({
    pelvisX,
    pelvisY,
    torsoLean,
    headTilt,
    hipYaw,
    shoulderYaw,

    lFootX: lLeg.x,
    lFootY: lLeg.y,
    lFootAngle: lLeg.a,
    rFootX: rLeg.x,
    rFootY: rLeg.y,
    rFootAngle: rLeg.a,

    lHandX: lHand.x,
    lHandY: lHand.y,
    lElbowBend: 1,
    rHandX: rHand.x,
    rHandY: rHand.y,
    rElbowBend: 1,
    fkArms: {
      rUpper: arms.rUpper,
      rElbow: arms.rElbow,
      lUpper: arms.lUpper,
      lElbow: arms.lElbow,
    },
    clampFeet: false,
  });
}

function getEnGardePose(ent, breath = 0) {
  const b = Math.sin(breath) * 0.35;
  const arch = ent.archetype;
  // Subtle silhouette personality in guard stance:
  // - Duellist / Zins: razor-sideways, slightly longer poised blade threat
  // - Brawler: wider, heavier low stance
  // - Rookie: slightly higher, less compact stance
  const isBrawler = arch === 'brawler';
  const isDuel = arch === 'duellist' || ent.type === 'zins';
  const isRookie = arch === 'rookie';
  const zinsP3 = ent.type === 'zins' && ent.bossPhase >= 3;

  const stanceHalf = isBrawler ? 6.5 : isDuel ? 6.2 : isRookie ? 5.2 : 5.9;
  const pelvisY = (isBrawler ? -11.9 : isDuel ? -12.3 : isRookie ? -13.0 : -12.4) + b * 0.6;
  const lean = (isBrawler ? 12 : zinsP3 ? 11 : isDuel ? 7 : isRookie ? 5 : 9) + b * 1.2;
  const handX = (isDuel ? 11.4 : isBrawler ? 9.8 : 10.6) + b * 0.4;
  const handY = (isDuel ? -19.8 : isBrawler ? -19.0 : -19.5) + b * 0.5;
  const bladeAng = (isDuel ? 96 : isBrawler ? 108 : isRookie ? 115 : 101) + b * 2.5;

  return makePose({
    pelvisX: -0.4,
    pelvisY,
    torsoLean: lean,
    headTilt: -lean * 0.45 + 2,
    hipYaw: isDuel ? 0.85 : 0.72,
    shoulderYaw: isDuel ? 0.92 : 0.82,

    // Rear foot turned out perpendicular (turnOut = 1), front foot pointed straight at opponent!
    lFootX: -stanceHalf,
    lFootY: BASE_ANKLE_Y,
    lFootAngle: 0,
    lFootTurnOut: 1.0,

    rFootX: stanceHalf,
    rFootY: BASE_ANKLE_Y,
    rFootAngle: 0,
    rFootTurnOut: 0.0,

    // Rear balance arm raised gracefully behind torso; sword arm extended forward threatening
    lHandX: isBrawler ? -7.8 : -8.8,
    lHandY: (isBrawler ? -22.2 : -24.2) - b * 0.6,
    lElbowBend: -1,

    rHandX: handX,
    rHandY: handY,
    rElbowBend: 1,

    swordAngle: bladeAng,
  });
}

// ---------------------------------------------------------------------------
// Procedural Pose Evaluators for ALL Combat & Locomotion States
// ---------------------------------------------------------------------------

function evalPose(ent, time, vis) {
  const clip = ent.anim || 'idle';
  const u = clamp(ent.animT || 0, 0, 1);
  const breath = time * 3.1 + (ent.x || 0) * 0.03;

  // =========================================================================
  // FENCING & COMBAT STATES
  // =========================================================================

  if (clip === 'combat_idle') {
    const guard = getEnGardePose(ent, breath);
    // Draw-sword flourish when first entering combat from normal movement!
    if (vis.drawTimer > 0) {
      const du = 1 - vis.drawTimer / 0.16;
      const e = easeOutCubic(du);
      const drawStart = makePose({
        ...guard,
        pelvisY: -13.6,
        torsoLean: 6,
        shoulderYaw: 0.35,
        rHandX: -1.5,
        rHandY: -15.5,
        rElbowBend: 1,
        swordAngle: 42,
        lHandX: -4.2,
        lHandY: -15.2,
        lElbowBend: 1,
      });
      return blendPose(drawStart, guard, e);
    }
    return guard;
  }

  if (clip === 'combat_advance' || clip === 'combat_retreat') {
    const guard = getEnGardePose(ent, breath);
    const advancing = clip === 'combat_advance';

    // Read exact step distance from Player (jumpStartX->jumpTargetX) or Enemy (stepStartX->stepTargetX)
    const sx = ent.stepStartX !== undefined && ent.stepTargetX !== undefined && ent.type
      ? (ent.stepTargetX - ent.stepStartX) * ent.facing
      : (ent.jumpTargetX !== undefined && ent.jumpStartX !== undefined
          ? (ent.jumpTargetX - ent.jumpStartX) * ent.facing
          : (advancing ? 14 : -14));
    const S = clamp(sx, -17, 17);

    // Real fencing footwork:
    //   Advance: FRONT foot extends first (heel-first land), REAR foot stays planted then draws up.
    //   Retreat: REAR foot steps back first, FRONT foot stays planted then draws back.
    //   Feet NEVER cross; body level stays low & steady!
    let pFront, pRear, frontLift, rearLift, frontAng, rearAng;
    if (advancing) {
      pFront = smoothstep(0.0, 0.50, u);
      pRear = smoothstep(0.24, 0.94, u);
      frontLift = Math.sin(pFront * Math.PI) * 2.0;
      rearLift = Math.sin(pRear * Math.PI) * 1.1;
      // Front foot lifts toe on advance, lands heel-first around u=0.45!
      frontAng = pFront < 0.85 ? -16 * Math.sin(pFront * Math.PI) : 0;
      rearAng = 10 * Math.sin(pRear * Math.PI);
    } else {
      pRear = smoothstep(0.0, 0.50, u);
      pFront = smoothstep(0.24, 0.94, u);
      rearLift = Math.sin(pRear * Math.PI) * 1.7;
      frontLift = Math.sin(pFront * Math.PI) * 1.1;
      rearAng = 10 * Math.sin(pRear * Math.PI);
      frontAng = -8 * Math.sin(pFront * Math.PI);
    }

    // World-space locked foot coordinates transformed into current local space (subtract S * u!)
    const rFootX = guard.rFootX + S * (pFront - u);
    const lFootX = guard.lFootX + S * (pRear - u);

    // Keep pelvis centered between the two feet with a tiny low glide (never bouncing up!)
    const midX = (rFootX + lFootX) * 0.5;
    const widen = Math.max(0, (rFootX - lFootX) - (guard.rFootX - guard.lFootX));
    const dip = clamp(widen * 0.14, 0, 1.3);

    return makePose({
      ...guard,
      pelvisX: midX - 0.3,
      pelvisY: guard.pelvisY + dip,
      torsoLean: guard.torsoLean + (advancing ? 2.5 : -2.5) * Math.sin(u * Math.PI),
      lFootX,
      lFootY: BASE_ANKLE_Y - rearLift,
      lFootAngle: rearAng,
      rFootX,
      rFootY: BASE_ANKLE_Y - frontLift,
      rFootAngle: frontAng,
      // Sword stays steadily threatening forward (slight forward press on advance)
      rHandX: guard.rHandX + (advancing ? 1.1 : -0.7) * Math.sin(u * Math.PI),
      rHandY: guard.rHandY + dip * 0.5,
      lHandX: guard.lHandX - (advancing ? 0.6 : -0.5) * Math.sin(u * Math.PI),
      lHandY: guard.lHandY + dip * 0.5,
      swordAngle: guard.swordAngle + (advancing ? -3 : 3) * Math.sin(u * Math.PI),
    });
  }

  if (clip === 'combat_strike') {
    const guard = getEnGardePose(ent, breath);
    const isEnemy = !!ent.type;
    const isRiposte = isEnemy ? ent.strikeKind === 'riposte' : !!ent.strikeIsRiposte;
    const isHeavy = isEnemy && ent.strikeKind === 'heavy';

    // Exact synchronization with gameplay timers (never altering gameplay numbers!)
    const wf = isEnemy
      ? (ent.strikeWindupFrac || 0.50)
      : (isRiposte ? 0.24 : 0.34);
    const af = isEnemy
      ? (ent.strikeActiveEndFrac || 0.72)
      : (isRiposte ? 0.52 : 0.54);

    // Enemy advancing lunges translate ent.x forward by strikeLungeMoved; compensate rear foot so it stays planted!
    const lungeShift = isEnemy ? (ent.strikeLungeMoved || 0) : 0;

    // Keyframe poses for the 4 fencing lunge stages:
    // 1. Windup / Preparation (clear readable telegraph for enemies, crisp coil/parry-flow for hero)
    const windupPose = isRiposte
      ? makePose({
          ...guard,
          pelvisX: -1.0,
          pelvisY: guard.pelvisY + 0.3,
          torsoLean: 4,
          shoulderYaw: 0.88,
          rHandX: 9.2,
          rHandY: -22.2,
          lHandX: -9.2,
          lHandY: -23.6,
          swordAngle: 126, // Flows directly out of high parry!
        })
      : isHeavy
        ? makePose({
            ...guard,
            pelvisX: -2.4,
            pelvisY: guard.pelvisY + 0.9,
            torsoLean: -10, // Big, unmistakable coiled rear-weighted heavy windup!
            headTilt: 10,
            hipYaw: 0.65,
            shoulderYaw: 0.45,
            lFootX: guard.lFootX - 1.0,
            rFootX: guard.rFootX - 0.6,
            rHandX: 4.5,
            rHandY: -26.5,
            rElbowBend: 1,
            lHandX: -8.6,
            lHandY: -21.0,
            lElbowBend: -1,
            swordAngle: 168, // Blade raised high over head for unmistakable heavy telegraph!
          })
        : isEnemy
          ? makePose({
              ...guard,
              pelvisX: -1.6,
              pelvisY: guard.pelvisY + 0.5,
              torsoLean: -4,
              headTilt: 6,
              shoulderYaw: 0.62,
              rHandX: 6.4,
              rHandY: -24.4,
              lHandX: -9.0,
              lHandY: -23.0,
              swordAngle: 152, // Clear raised-blade enemy telegraph!
            })
          : makePose({
              ...guard,
              pelvisX: -1.1,
              pelvisY: guard.pelvisY + 0.6,
              torsoLean: 5,
              shoulderYaw: 0.72,
              rHandX: 7.4,
              rHandY: -22.4,
              lHandX: -9.0,
              lHandY: -23.2,
              swordAngle: 132,
            });

    // 2. Hand-before-foot extension (right before front heel lands: arm ALREADY extended, front foot mid-kick!)
    const extendPose = makePose({
      ...guard,
      pelvisX: 0.8,
      pelvisY: -11.0,
      torsoLean: isHeavy ? 22 : 17,
      headTilt: -10,
      hipYaw: 0.88,
      shoulderYaw: 0.98,
      lFootX: clamp(-9.2 - lungeShift * 0.25, -11.4, -5.8),
      lFootY: BASE_ANKLE_Y,
      lFootAngle: 4,
      lFootTurnOut: 1.0,
      rFootX: isHeavy ? 9.8 : 9.0,
      rFootY: BASE_ANKLE_Y - 2.4, // Front foot flying forward through the air!
      rFootAngle: -24,            // Toe UP ready for heel-first strike!
      rFootTurnOut: 0.0,
      rHandX: 15.6,               // Sword arm ALREADY straight & threatening!
      rHandY: -18.8,
      rElbowBend: 1,
      lHandX: -10.8,              // Rear balance arm whipping back!
      lHandY: -20.5,
      lElbowBend: -1,
      swordAngle: 92,
      lungeSlash: 0.55,
    });

    // 3. Full Fencing Lunge (rear leg DRIVES STRAIGHT, front foot lands HEEL-FIRST then flat, front knee over foot!)
    const lungeDepth = isHeavy ? 1.14 : isRiposte ? 0.96 : 1.0;
    const lungePose = makePose({
      pelvisX: 1.8 * lungeDepth,
      pelvisY: isHeavy ? -9.6 : -10.1,
      torsoLean: isHeavy ? 24 : 18,
      headTilt: -12,
      hipYaw: 0.92,
      shoulderYaw: 1.0,

      // Rear leg straight & planted firmly on the floor!
      lFootX: clamp(-10.6 * lungeDepth - lungeShift * 0.15, -11.6, -8.8),
      lFootY: BASE_ANKLE_Y,
      lFootAngle: 6,
      lFootTurnOut: 1.0,

      // Front foot planted far forward, knee stacked over foot!
      rFootX: 10.2 * lungeDepth,
      rFootY: BASE_ANKLE_Y,
      rFootAngle: 0,
      rFootTurnOut: 0.0,

      // Rear balance arm thrown straight back & slightly down for counterbalance
      lHandX: -11.2,
      lHandY: -18.2,
      lElbowBend: -1,

      // Sword arm straight horizontal thrust into opponent!
      rHandX: 16.0 * lungeDepth,
      rHandY: isHeavy ? -17.4 : -18.4,
      rElbowBend: 1,

      swordAngle: isHeavy ? 91 : 93,
      lungeSlash: 1.0,
    });

    // Phase timing:
    const windupHoldEnd = isEnemy ? wf * 0.72 : wf * 0.45;
    if (u < windupHoldEnd) {
      // Coil into telegraph / anticipation
      const k = easeOutCubic(u / Math.max(0.01, windupHoldEnd));
      return blendPose(guard, windupPose, k);
    }
    if (u < wf) {
      // Hand extends BEFORE foot lands!
      const k = easeInOutQuad((u - windupHoldEnd) / Math.max(0.01, wf - windupHoldEnd));
      return blendPose(windupPose, extendPose, k);
    }
    if (u < af) {
      // Heel-first impact & full lunge hold!
      const localU = (u - wf) / Math.max(0.01, af - wf);
      const impact = easeOutCubic(Math.min(1, localU / 0.35));
      const res = blendPose(extendPose, lungePose, impact);
      // Distinct heel-first roll during the very first 28% of impact
      if (localU < 0.28) {
        res.rFootY = BASE_ANKLE_Y;
        res.rFootAngle = lerp(-18, 0, localU / 0.28);
      }
      res.lungeSlash = localU < 0.75 ? 1.0 - localU * 0.6 : 0;
      return res;
    }

    // Recovery back to en-garde: front foot pushes off & retracts, rear knee bends to pull hips back!
    const recU = (u - af) / Math.max(0.01, 1 - af);
    const pullBack = easeInOutQuad(recU);
    const res = blendPose(lungePose, guard, pullBack);
    // Front foot lifts cleanly while retracting; rear foot stays planted pulling body back!
    const footLift = Math.sin(clamp(recU * 1.15, 0, 1) * Math.PI);
    res.rFootY = BASE_ANKLE_Y - footLift * 1.9;
    res.rFootAngle = footLift * 18; // Toe pushes off stone!
    res.lFootY = BASE_ANKLE_Y;
    res.lungeSlash = 0;
    return res;
  }

  if (clip === 'combat_parry') {
    const guard = getEnGardePose(ent, breath);
    const clashed = !!ent.parrySuccess || !!ent.pendingRiposte || vis.clashSparkT > 0;
    // Fast sweep into parry (0..0.18), firm defensive hold (0.18..0.75), subtle settle back (0.75..1)
    const sweep = u < 0.18 ? easeOutBack(u / 0.18, 0.8) : (u > 0.78 ? 1 - easeInOutQuad((u - 0.78) / 0.22) * 0.55 : 1);
    const impactRecoil = clashed && vis.clashSparkT > 0 ? Math.sin((vis.clashSparkT / 0.18) * Math.PI) : 0;

    // Weight shifts smoothly onto rear leg while BOTH feet remain planted!
    const parryPose = makePose({
      ...guard,
      pelvisX: -2.0 - impactRecoil * 0.8,
      pelvisY: guard.pelvisY - 0.4 + impactRecoil * 0.3,
      torsoLean: -4 - impactRecoil * 4,
      headTilt: 5,
      hipYaw: 0.78,
      shoulderYaw: 0.88,

      lFootX: guard.lFootX - 0.4,
      lFootY: BASE_ANKLE_Y,
      lFootTurnOut: 1.0,
      rFootX: guard.rFootX + 0.2,
      rFootY: BASE_ANKLE_Y,
      rFootTurnOut: 0.0,

      // Sword sweeps high across torso in crisp Quarte/Tierce parry to catch incoming blade
      rHandX: 8.6 - impactRecoil * 1.0,
      rHandY: -22.8 - impactRecoil * 0.8,
      rElbowBend: 1,
      lHandX: -9.4,
      lHandY: -23.4,
      lElbowBend: -1,
      swordAngle: 152 + impactRecoil * 9,
    });
    return blendPose(guard, parryPose, sweep);
  }

  if (clip === 'combat_parried') {
    const guard = getEnGardePose(ent, breath);
    // Blade kicked upward/back from opponent's parry, brief stabilizing rear-foot step, then recover
    const kick = u < 0.25 ? easeOutCubic(u / 0.25) : 1 - easeInOutQuad((u - 0.25) / 0.75);
    const stepLift = u < 0.55 ? Math.sin((u / 0.55) * Math.PI) * 1.4 : 0;

    return makePose({
      ...guard,
      pelvisX: -2.2 * kick,
      pelvisY: guard.pelvisY - 0.4 * kick,
      torsoLean: lerp(guard.torsoLean, -12, kick),
      headTilt: lerp(guard.headTilt, -8, kick),
      shoulderYaw: lerp(guard.shoulderYaw, 0.55, kick),

      lFootX: guard.lFootX - 1.6 * kick,
      lFootY: BASE_ANKLE_Y - stepLift,
      lFootAngle: 8 * kick,
      rFootX: guard.rFootX + 0.6 * kick,
      rFootY: BASE_ANKLE_Y,

      rHandX: lerp(guard.rHandX, 6.2, kick),
      rHandY: lerp(guard.rHandY, -25.8, kick),
      lHandX: lerp(guard.lHandX, -9.8, kick),
      lHandY: lerp(guard.lHandY, -21.5, kick),
      swordAngle: lerp(guard.swordAngle, 168, kick),
    });
  }

  if (clip === 'combat_feint') {
    const guard = getEnGardePose(ent, breath);
    // Deceptive half-beat forward twitch: front toe taps/twitches, shoulder & blade dart forward-up
    const pulse = Math.sin(u * Math.PI);
    return makePose({
      ...guard,
      pelvisX: guard.pelvisX + 1.1 * pulse,
      pelvisY: guard.pelvisY + 0.4 * pulse,
      torsoLean: guard.torsoLean + 6 * pulse,
      rFootX: guard.rFootX + 1.4 * pulse,
      rFootY: BASE_ANKLE_Y - 1.1 * pulse,
      rFootAngle: -14 * pulse,
      rHandX: guard.rHandX + 2.4 * pulse,
      rHandY: guard.rHandY - 2.2 * pulse,
      swordAngle: guard.swordAngle + 28 * pulse,
    });
  }

  if (clip === 'combat_recover') {
    const guard = getEnGardePose(ent, breath);
    // Over-extended, off-balance recovery after whiff or getting parried (clearly open to riposte!)
    const rec = easeInOutQuad(u);
    const exposed = makePose({
      ...guard,
      pelvisX: 2.0,
      pelvisY: -11.2,
      torsoLean: 20,
      headTilt: 10,
      shoulderYaw: 0.45,
      lFootX: -8.6,
      rFootX: 8.6,
      rHandX: 11.4,
      rHandY: -14.2, // Blade dropped low & off-line!
      lHandX: -9.8,
      lHandY: -18.5,
      swordAngle: 56,
    });
    const res = blendPose(exposed, guard, rec);
    const lift = Math.sin(rec * Math.PI) * 1.4;
    res.rFootY = BASE_ANKLE_Y - lift;
    res.rFootAngle = lift * 10;
    return res;
  }

  if (clip === 'combat_hit') {
    const guard = ent.swordDrawn ? getEnGardePose(ent, breath) : evalIdlePose(ent, breath);
    // Sharp torso recoil backward + balanced stagger step (sword stays clear of floor!)
    const hitPeak = u < 0.25 ? easeOutCubic(u / 0.25) : 1 - easeInOutQuad((u - 0.25) / 0.75);
    const rearStepLift = u < 0.62 ? Math.sin((u / 0.62) * Math.PI) * 1.9 : 0;

    return makePose({
      ...guard,
      pelvisX: -2.2 * hitPeak,
      pelvisY: lerp(guard.pelvisY, -12.6, hitPeak),
      torsoLean: lerp(guard.torsoLean, -18, hitPeak),
      headTilt: lerp(guard.headTilt, -16, hitPeak),
      hipYaw: lerp(guard.hipYaw, 0.55, hitPeak),
      shoulderYaw: lerp(guard.shoulderYaw, 0.45, hitPeak),

      // Rear foot takes a clear stagger step back, front foot digs heel
      lFootX: guard.lFootX - 2.8 * hitPeak,
      lFootY: BASE_ANKLE_Y - rearStepLift,
      lFootAngle: 14 * hitPeak,
      rFootX: guard.rFootX + 1.2 * hitPeak,
      rFootY: BASE_ANKLE_Y,
      rFootAngle: -16 * hitPeak,

      lHandX: lerp(guard.lHandX, -9.6, hitPeak),
      lHandY: lerp(guard.lHandY, -23.0, hitPeak),
      lElbowBend: -1,
      rHandX: lerp(guard.rHandX, 7.2, hitPeak),
      rHandY: lerp(guard.rHandY, -19.2, hitPeak),
      rElbowBend: 1,
      swordAngle: lerp(guard.swordAngle, 126, hitPeak),
    });
  }

  if (clip === 'sheathe') {
    const guard = getEnGardePose(ent, breath);
    const idle = evalIdlePose(ent, breath);
    // 0..0.55: sweep blade down across left hip into scabbard; 0.55..1.0: settle into relaxed stand
    if (u < 0.55) {
      const k = easeInOutQuad(u / 0.55);
      const mid = makePose({
        ...blendPose(guard, idle, k * 0.5),
        torsoLean: 8,
        shoulderYaw: 0.15,
        rHandX: -1.8,
        rHandY: -14.8,
        lHandX: -3.2,
        lHandY: -13.6,
        lElbowBend: 1,
        swordAngle: 35,
      });
      mid.swordVisibleOverride = true;
      mid.sheatheSlide = clamp((u - 0.18) / 0.37, 0, 1);
      return mid;
    }
    const k = easeInOutQuad((u - 0.55) / 0.45);
    const start = makePose({
      ...blendPose(guard, idle, 0.5),
      rHandX: -1.6,
      rHandY: -14.8,
      lHandX: -3.2,
      lHandY: -13.8,
      lElbowBend: 1,
    });
    const res = blendPose(start, idle, k);
    res.swordVisibleOverride = false;
    return res;
  }

  if (clip === 'dead') {
    // 4-stage articulated collapse onto the floor top face (zero limbs below y = 0!)
    const p0 = makePose({
      pelvisX: -0.6, pelvisY: -12.6, torsoLean: -16, headTilt: -14,
      hipYaw: 0.5, shoulderYaw: 0.35,
      lFootX: -5.2, lFootY: BASE_ANKLE_Y, rFootX: 4.4, rFootY: BASE_ANKLE_Y,
      lHandX: -6.5, lHandY: -17.5, lElbowBend: 1,
      rHandX: 5.5, rHandY: -14.5, rElbowBend: 1,
      swordAngle: 45, clampFeet: true,
    });
    const p1 = makePose({
      pelvisX: 0.4, pelvisY: -7.2, torsoLean: 24, headTilt: 20,
      hipYaw: 0.4, shoulderYaw: 0.25,
      lFootX: -6.2, lFootY: BASE_ANKLE_Y, lFootAngle: 32,
      rFootX: 3.6, rFootY: BASE_ANKLE_Y, rFootAngle: 8,
      lHandX: -3.0, lHandY: -7.5, lElbowBend: 1,
      rHandX: 6.8, rHandY: -4.2, rElbowBend: 1,
      swordAngle: 78, clampFeet: true,
    });
    const p2 = makePose({
      pelvisX: 1.5, pelvisY: -2.4, torsoLean: 78, headTilt: 14,
      hipYaw: 0.2, shoulderYaw: 0.2,
      lFootX: -10.8, lFootY: -1.3, lFootAngle: 68,
      rFootX: -7.2, rFootY: -1.4, rFootAngle: 52,
      lHandX: 5.5, lHandY: -1.6, lElbowBend: 1,
      rHandX: 13.0, rHandY: -1.4, rElbowBend: 1,
      swordAngle: 88, clampFeet: false,
    });
    const p3 = makePose({
      pelvisX: 1.6, pelvisY: -1.9, torsoLean: 87, headTilt: 5,
      hipYaw: 0.12, shoulderYaw: 0.12,
      lFootX: -12.6, lFootY: -1.2, lFootAngle: 82,
      rFootX: -9.4, rFootY: -1.2, rFootAngle: 72,
      lHandX: 6.2, lHandY: -1.2, lElbowBend: 1,
      rHandX: 13.8, rHandY: -1.2, rElbowBend: 1,
      swordAngle: 90, clampFeet: false,
    });

    if (u < 0.25) return blendPose(p0, p1, easeInOutQuad(u / 0.25));
    if (u < 0.72) return blendPose(p1, p2, easeInOutQuad((u - 0.25) / 0.47));
    return blendPose(p2, p3, easeOutCubic((u - 0.72) / 0.28));
  }

  // =========================================================================
  // LOCOMOTION & PLATFORMING STATES
  // =========================================================================

  if (clip === 'idle') {
    return evalIdlePose(ent, breath);
  }

  if (clip === 'run_start') {
    // 4-stage progressive acceleration into evalRunPose(11/12) -> evalRunPose(0.0):
    //   0.00 (F1): Contralateral ready lean from idle (near leg slightly ahead, near arm back, far arm forward)
    //   0.33 (F2): Grounded accelerating push-off drive (rear foot planted pushing off, front knee lifting!)
    //   0.67 (F3): REAL AIRBORNE STRIDE LAUNCH (v3's praised committed airborne beat: rear heel folding, lead knee bent!)
    //   1.00 (F4): Lands cleanly into evalRunPose(11/12) initial contact (seamless flow into cycle!)
    const runEntry = evalRunPose(11 / 12);

    // Stage 0 (u = 0.00): Contralateral ready lean from idle
    const lean0 = 6.0;
    const pelY0 = -14.80;
    const c0X = 0.12 + Math.sin(degRad(lean0)) * 8.6;
    const c0Y = pelY0 - Math.cos(degRad(lean0)) * 8.6;
    const rH0 = fkArmHand(c0X - 0.15, c0Y + 0.35, -14, 66, 5.1, 4.3);
    const lH0 = fkArmHand(c0X + 0.15, c0Y - 0.35, 10, 74, 5.1, 4.3);
    const s0 = makePose({
      pelvisX: 0.12, pelvisY: pelY0, torsoLean: lean0, headTilt: -lean0 * 0.30,
      hipYaw: 0.10, shoulderYaw: -0.08,
      lFootX: -2.4, lFootY: BASE_ANKLE_Y, lFootAngle: 0,
      rFootX: 2.5, rFootY: BASE_ANKLE_Y, rFootAngle: 0,
      lHandX: lH0.x, lHandY: lH0.y, lElbowBend: 1,
      rHandX: rH0.x, rHandY: rH0.y, rElbowBend: 1,
      fkArms: { rUpper: -14, rElbow: 66, lUpper: 10, lElbow: 74 },
      clampFeet: false,
    });

    // Stage 1 (u = 0.33): Grounded accelerating push-off stride (rear foot STILL planted pushing off!)
    const lean1 = 9.0;
    const pelY1 = -14.70;
    const c1X = 0.30 + Math.sin(degRad(lean1)) * 8.6;
    const c1Y = pelY1 - Math.cos(degRad(lean1)) * 8.6;
    const rH1 = fkArmHand(c1X - 0.4, c1Y + 0.35, -34, 80, 5.1, 4.3);
    const lH1 = fkArmHand(c1X + 0.4, c1Y - 0.35, 18, 102, 5.1, 4.3);
    const s1 = makePose({
      pelvisX: 0.30, pelvisY: pelY1, torsoLean: lean1, headTilt: -lean1 * 0.30,
      hipYaw: 0.16, shoulderYaw: -0.22,
      lFootX: -4.6, lFootY: -bootLowestOffsetY(20), lFootAngle: 20, // Rear foot firmly planted pushing!
      rFootX: 3.0, rFootY: -3.4, rFootAngle: 4,                     // Near knee driving forward
      lHandX: lH1.x, lHandY: lH1.y, lElbowBend: 1,
      rHandX: rH1.x, rHandY: rH1.y, rElbowBend: 1,
      fkArms: { rUpper: -34, rElbow: 80, lUpper: 18, lElbow: 102 },
      clampFeet: false,
    });

    // Stage 2 (u = 0.67): REAL AIRBORNE STRIDE LAUNCH (both feet off ground, rear heel folding, lead knee bent!)
    const lean2 = 9.5;
    const pelY2 = -16.65;
    const c2X = 0.50 + Math.sin(degRad(lean2)) * 8.6;
    const c2Y = pelY2 - Math.cos(degRad(lean2)) * 8.6;
    const rH2 = fkArmHand(c2X - 0.75, c2Y + 0.35, -50, 77, 5.1, 4.3);
    const lH2 = fkArmHand(c2X + 0.75, c2Y - 0.35, 23, 112, 5.1, 4.3);
    const lFk2 = fkLegAnkle(0.50 - 0.16 * 1.65, pelY2 - 0.08, -20, 96, 7.3, 7.2);
    const rFk2 = fkLegAnkle(0.50 + 0.16 * 1.65, pelY2 + 0.08, 44, 44, 7.3, 7.2);
    const s2 = makePose({
      pelvisX: 0.50, pelvisY: pelY2, torsoLean: lean2, headTilt: -lean2 * 0.30,
      hipYaw: 0.16, shoulderYaw: -0.34,
      lFootX: lFk2.x, lFootY: lFk2.y, lFootAngle: ankleInteriorToBootAngle(-20 - 96, 124), // Relaxed plantar-flexed recovering foot!
      rFootX: rFk2.x, rFootY: rFk2.y, rFootAngle: ankleInteriorToBootAngle(44 - 44, 88),   // Dorsiflexed lead foot ready to land!
      lHandX: lH2.x, lHandY: lH2.y, lElbowBend: 1,
      rHandX: rH2.x, rHandY: rH2.y, rElbowBend: 1,
      fkArms: { rUpper: -50, rElbow: 77, lUpper: 23, lElbow: 112 },
      clampFeet: false,
    });

    if (u < 0.335) return blendPose(s0, s1, easeInOutQuad(u / 0.335));
    if (u < 0.67) return blendPose(s1, s2, easeInOutQuad((u - 0.335) / 0.335));
    return blendPose(s2, runEntry, easeInOutQuad((u - 0.67) / 0.33));
  }

  if (clip === 'run') {
    return evalRunPose(u);
  }

  if (clip === 'skid') {
    // Decisive braking heel-dig with continuous arm recovery & open counterbalance silhouette:
    //   F1: Backward lean (-14°), steady head height, braced bent front knee (~22° flex),
    //       near arm open forward (+26°/104°), dark far arm clearly visible behind back (-46°/78°)!
    //   F2: Smooth deceleration (-6°), near arm easing down (+12°), far arm easing forward (-20°)
    //   F3: Upright idle (continuous same-side arm recovery throughout!)
    const idle = evalIdlePose(ent, breath);
    const leanPeak = -14;
    const pelYPeak = -13.5;
    const cX = -1.5 + Math.sin(degRad(leanPeak)) * 8.6;
    const cY = pelYPeak - Math.cos(degRad(leanPeak)) * 8.6;
    const rH = fkArmHand(cX + 0.55, cY + 0.35, 26, 104, 5.1, 4.3);
    const lH = fkArmHand(cX - 0.65, cY - 0.35, -46, 78, 5.1, 4.3); // Clearly visible counterbalance behind back!

    const skidPeak = makePose({
      pelvisX: -1.5,
      pelvisY: pelYPeak,
      torsoLean: leanPeak,
      headTilt: -leanPeak * 0.30,
      hipYaw: 0.34,
      shoulderYaw: 0.24,

      lFootX: -5.4,
      lFootY: BASE_ANKLE_Y,
      lFootAngle: 8,
      rFootX: 7.4,
      rFootY: -bootLowestOffsetY(-24),
      rFootAngle: -24,

      lHandX: lH.x,
      lHandY: lH.y,
      lElbowBend: 1,
      rHandX: rH.x,
      rHandY: rH.y,
      rElbowBend: 1,
      fkArms: { rUpper: 26, rElbow: 104, lUpper: -46, lElbow: 78 },
      clampFeet: false,
    });

    const leanMid = -5.5;
    const pelYMid = -14.3;
    const cmX = -0.6 + Math.sin(degRad(leanMid)) * 8.6;
    const cmY = pelYMid - Math.cos(degRad(leanMid)) * 8.6;
    const rHm = fkArmHand(cmX + 0.25, cmY + 0.35, 12, 82, 5.1, 4.3);
    const lHm = fkArmHand(cmX - 0.35, cmY - 0.35, -20, 76, 5.1, 4.3);
    const skidMid = makePose({
      ...idle,
      pelvisX: -0.6,
      pelvisY: pelYMid,
      torsoLean: leanMid,
      headTilt: -leanMid * 0.30,
      hipYaw: 0.24,
      shoulderYaw: 0.14,
      lFootX: -3.6,
      rFootX: 4.8,
      rFootY: -bootLowestOffsetY(-8),
      rFootAngle: -8,
      lHandX: lHm.x,
      lHandY: lHm.y,
      lElbowBend: 1,
      rHandX: rHm.x,
      rHandY: rHm.y,
      rElbowBend: 1,
      fkArms: { rUpper: 12, rElbow: 82, lUpper: -20, lElbow: 76 },
      clampFeet: false,
    });

    if (u < 0.50) return blendPose(skidPeak, skidMid, easeInOutQuad(u / 0.50));
    return blendPose(skidMid, idle, easeOutCubic((u - 0.50) / 0.50));
  }

  if (clip === 'turn') {
    const idle = evalIdlePose(ent, breath);
    // True 180-degree athletic directional pivot:
    //   u = 0.0 (F1): Athletic braking lean entering from left run (-8° lean, slightly flexed knees, contralateral bent arms)
    //   u = 0.5 (F2): Front-facing pivot keeping consistent height/width, clean knee alignment, asymmetrical bent arms!
    //   u = 1.0 (F3): Right-facing CONTRALATERAL exit (near leg forward, NEAR arm BACK -26°, FAR arm FORWARD +18°!)
    const e = easeInOutQuad(u);
    const p = Math.sin(u * Math.PI);
    const faceYaw = lerp(-0.90, 1.0, e);
    const lean = lerp(-8, 6.5, e);
    const pelY = lerp(-14.2, -14.6, e) + 0.75 * p; // Consistent height across F1, F2, F3 (no shrinking on F2!)
    const cX = Math.sin(degRad(lean)) * 8.6;
    const cY = pelY - Math.cos(degRad(lean)) * 8.6;

    // Frame 1 (left-facing braking entry): compact bent arms coiled for turn
    const rH0 = fkArmHand(cX + 0.8, cY + 0.35, 24, -84, 5.1, 4.3);
    const lH0 = fkArmHand(cX - 0.8, cY - 0.35, -18, -104, 5.1, 4.3);
    // Frame 2 (front-facing mid-pivot): handled by asymmetric frontFacing pivot arms in drawCharacter
    const lH1 = { x: cX - 3.0, y: cY + 6.8 };
    const rH1 = { x: cX + 3.4, y: cY + 6.0 };
    // Frame 3 (right-facing CONTRALATERAL exit ready to sprint right: near arm BACK, far arm FORWARD!)
    const rH2 = fkArmHand(cX - 0.6, cY + 0.35, -26, 82, 5.1, 4.3);
    const lH2 = fkArmHand(cX + 0.6, cY - 0.35, 18, 102, 5.1, 4.3);

    let lHand, rHand, lBend, rBend;
    if (u < 0.5) {
      const k = easeInOutQuad(u / 0.5);
      lHand = { x: lerp(lH0.x, lH1.x, k), y: lerp(lH0.y, lH1.y, k) };
      rHand = { x: lerp(rH0.x, rH1.x, k), y: lerp(rH0.y, rH1.y, k) };
      lBend = k < 0.5 ? -1 : 1;
      rBend = -1;
    } else {
      const k = easeInOutQuad((u - 0.5) / 0.5);
      lHand = { x: lerp(lH1.x, lH2.x, k), y: lerp(lH1.y, lH2.y, k) };
      rHand = { x: lerp(rH1.x, rH2.x, k), y: lerp(rH1.y, rH2.y, k) };
      lBend = 1;
      rBend = 1;
    }

    const lFootX = u < 0.5 ? lerp(-3.0, -2.5, easeInOutQuad(u / 0.5)) : lerp(-2.5, -2.6, easeInOutQuad((u - 0.5) / 0.5));
    const rFootX = u < 0.5 ? lerp(2.8, 2.5, easeInOutQuad(u / 0.5)) : lerp(2.5, 3.0, easeInOutQuad((u - 0.5) / 0.5));

    return makePose({
      ...idle,
      pelvisY: pelY,
      torsoLean: lean,
      headTilt: -lean * 0.25,
      hipYaw: lerp(-0.22, 0.20, e),
      shoulderYaw: lerp(-0.24, -0.20, e),
      lFootX,
      lFootY: BASE_ANKLE_Y - 0.9 * p,
      lFootAngle: 7 * p,
      lFootTurnOut: p > 0.65 ? 0.95 : 0.0,
      rFootX,
      rFootY: BASE_ANKLE_Y,
      rFootTurnOut: p > 0.65 ? 0.95 : 0.0,
      lHandX: lHand.x,
      lHandY: lHand.y,
      lElbowBend: lBend,
      rHandX: rHand.x,
      rHandY: rHand.y,
      rElbowBend: rBend,
      fkArms: u > 0.85 ? { rUpper: -26, rElbow: 82, lUpper: 18, lElbow: 102 } : null,
      clampFeet: false,
      faceYaw,
    });
  }

  if (clip === 'careful') {
    const idle = evalIdlePose(ent, breath);
    const sx = (ent.jumpTargetX !== undefined && ent.jumpStartX !== undefined)
      ? (ent.jumpTargetX - ent.jumpStartX) * ent.facing
      : 11;
    const S = clamp(sx, 2, 13);

    // Gingerly reach front toe forward, test stone, shift weight, draw rear foot up!
    const pFront = smoothstep(0.0, 0.52, u);
    const pRear = smoothstep(0.38, 0.96, u);
    const rX = idle.rFootX + S * (pFront - u);
    const lX = idle.lFootX + S * (pRear - u);
    const rLift = Math.sin(pFront * Math.PI) * 1.6;
    const lLift = Math.sin(pRear * Math.PI) * 1.2;

    return makePose({
      ...idle,
      pelvisX: (rX + lX) * 0.5,
      pelvisY: -14.1 + Math.sin(u * Math.PI) * 0.6,
      torsoLean: 12 + Math.sin(u * Math.PI) * 4,
      headTilt: 8, // Looking down carefully at footing/spikes!
      hipYaw: 0.45,
      shoulderYaw: 0.20,

      lFootX: lX,
      lFootY: BASE_ANKLE_Y - lLift,
      lFootAngle: 14 * Math.sin(pRear * Math.PI),
      rFootX: rX,
      rFootY: BASE_ANKLE_Y - rLift,
      rFootAngle: 12 * Math.sin(pFront * Math.PI), // Reaching cautiously with toe!

      lHandX: -5.4,
      lHandY: -17.0,
      lElbowBend: -1,
      rHandX: 6.2,
      rHandY: -16.8,
      rElbowBend: 1,
    });
  }

  if (clip === 'crouch') {
    const idle = evalIdlePose(ent, breath);
    const low = makePose({
      pelvisX: -0.6,
      pelvisY: -8.6,
      torsoLean: 24,
      headTilt: -10,
      hipYaw: 0.55,
      shoulderYaw: 0.40,

      lFootX: -5.4,
      lFootY: BASE_ANKLE_Y,
      lFootAngle: 28, // Rear heel raised, crouched on ball of foot
      rFootX: 4.8,
      rFootY: BASE_ANKLE_Y,
      rFootAngle: 0,

      lHandX: -3.2,
      lHandY: -8.5,
      lElbowBend: 1,
      rHandX: 5.8,
      rHandY: -6.8,
      rElbowBend: 1,
    });
    return blendPose(idle, low, easeOutCubic(u));
  }

  if (clip === 'pickup') {
    const idle = evalIdlePose(ent, breath);
    const it = ent.pickupItem;
    const isElixir = it && it.type !== 'sword';

    const kneel = makePose({
      pelvisX: -0.5,
      pelvisY: -8.8,
      torsoLean: 32,
      headTilt: 10,
      hipYaw: 0.58,
      shoulderYaw: 0.65,
      lFootX: -5.4, lFootY: BASE_ANKLE_Y, lFootAngle: 32,
      rFootX: 4.6, rFootY: BASE_ANKLE_Y, rFootAngle: 0,
      lHandX: -2.4, lHandY: -9.5, lElbowBend: 1,
      rHandX: 5.8, rHandY: -2.2, rElbowBend: 1, // Reaching down to floor item!
    });

    if (isElixir) {
      // DRINK ANIMATION: kneel & grab flask -> stand bringing flask to lips -> head tilts back!
      const drinkPose = makePose({
        pelvisX: 0.0,
        pelvisY: -14.2,
        torsoLean: -4,
        headTilt: -22, // Tilting head back to drink!
        hipYaw: 0.35,
        shoulderYaw: 0.52,
        lFootX: -3.2, lFootY: BASE_ANKLE_Y,
        rFootX: 3.4, rFootY: BASE_ANKLE_Y,
        lHandX: -3.0, lHandY: -15.5, lElbowBend: 1,
        rHandX: 3.2, rHandY: -24.4, rElbowBend: 1, // Flask right at lips!
        heldFlask: it.type,
      });
      if (u < 0.38) return blendPose(idle, kneel, easeOutCubic(u / 0.38));
      if (u < 0.68) {
        const res = blendPose(kneel, drinkPose, easeInOutQuad((u - 0.38) / 0.30));
        res.heldFlask = u >= 0.42 ? it.type : null;
        return res;
      }
      if (u < 0.84) return drinkPose;
      const res = blendPose(drinkPose, idle, easeInOutQuad((u - 0.84) / 0.16));
      res.heldFlask = null;
      return res;
    }

    // SWORD PICKUP: kneel -> lift Guild Sabre triumphantly -> settle
    const raiseSword = makePose({
      pelvisX: 0.0,
      pelvisY: -14.6,
      torsoLean: 4,
      headTilt: -10,
      hipYaw: 0.45,
      shoulderYaw: 0.72,
      lFootX: -3.4, lFootY: BASE_ANKLE_Y,
      rFootX: 3.8, rFootY: BASE_ANKLE_Y,
      lHandX: -4.2, lHandY: -16.2, lElbowBend: 1,
      rHandX: 7.4, rHandY: -24.8, rElbowBend: 1,
      swordAngle: 155,
      swordVisibleOverride: true,
    });
    if (u < 0.42) return blendPose(idle, kneel, easeOutCubic(u / 0.42));
    if (u < 0.76) {
      const res = blendPose(kneel, raiseSword, easeOutCubic((u - 0.42) / 0.34));
      res.swordVisibleOverride = u >= 0.45;
      return res;
    }
    const res = blendPose(raiseSword, idle, easeInOutQuad((u - 0.76) / 0.24));
    res.swordVisibleOverride = false;
    return res;
  }

  if (clip === 'jump_up') {
    const crouch = makePose({
      pelvisX: -0.4, pelvisY: -10.2, torsoLean: 18, headTilt: -14,
      hipYaw: 0.35, shoulderYaw: 0.25,
      lFootX: -3.2, lFootY: BASE_ANKLE_Y, lFootAngle: 10,
      rFootX: 3.2, rFootY: BASE_ANKLE_Y, rFootAngle: 0,
      lHandX: -4.6, lHandY: -12.5, lElbowBend: 1,
      rHandX: -2.2, rHandY: -12.0, rElbowBend: 1,
      clampFeet: true,
    });
    const reach = makePose({
      pelvisX: 0.2, pelvisY: -14.4, torsoLean: 4, headTilt: -18,
      hipYaw: 0.30, shoulderYaw: 0.40,
      lFootX: -2.6, lFootY: -2.6, lFootAngle: 28,
      rFootX: 2.2, rFootY: -3.8, rFootAngle: 22,
      lHandX: 3.2, lHandY: -29.8, lElbowBend: -1, // Both hands reaching straight up to grab ledge!
      rHandX: 4.6, rHandY: -29.2, rElbowBend: -1,
      clampFeet: false,
    });
    if (u < 0.25) return blendPose(crouch, reach, easeInOutQuad(u / 0.25) * 0.25);
    return blendPose(crouch, reach, easeOutCubic((u - 0.20) / 0.55));
  }

  if (clip === 'stand_jump') {
    const windup = makePose({
      pelvisX: -1.0, pelvisY: -10.0, torsoLean: 24, headTilt: -12,
      hipYaw: 0.45, shoulderYaw: 0.30,
      lFootX: -3.6, lFootY: BASE_ANKLE_Y, lFootAngle: 14,
      rFootX: 3.6, rFootY: BASE_ANKLE_Y, rFootAngle: 0,
      lHandX: -6.2, lHandY: -12.2, lElbowBend: 1,
      rHandX: -3.8, rHandY: -11.5, rElbowBend: 1,
      clampFeet: true,
    });
    const extend = makePose({
      pelvisX: 0.6, pelvisY: -15.0, torsoLean: 22, headTilt: -10,
      hipYaw: 0.62, shoulderYaw: -0.45,
      lFootX: -7.0, lFootY: -1.8, lFootAngle: 40,
      rFootX: 6.2, rFootY: -5.8, rFootAngle: 12,
      lHandX: 6.8, lHandY: -24.5, lElbowBend: 1,
      rHandX: 8.6, rHandY: -23.2, rElbowBend: 1,
      clampFeet: false,
    });
    const tuck = makePose({
      pelvisX: 0.4, pelvisY: -14.2, torsoLean: 18, headTilt: -4,
      hipYaw: 0.52, shoulderYaw: 0.20,
      lFootX: -5.2, lFootY: -5.2, lFootAngle: 28,
      rFootX: 6.8, rFootY: -6.0, rFootAngle: 4,
      lHandX: -4.2, lHandY: -18.8, lElbowBend: 1,
      rHandX: 7.4, rHandY: -20.5, rElbowBend: 1,
      clampFeet: false,
    });
    const landPrep = makePose({
      pelvisX: 0.2, pelvisY: -13.6, torsoLean: 14, headTilt: 6,
      hipYaw: 0.45, shoulderYaw: 0.25,
      lFootX: -3.6, lFootY: -2.0, lFootAngle: 8,
      rFootX: 5.2, rFootY: -1.6, rFootAngle: -14,
      lHandX: -4.4, lHandY: -16.8, lElbowBend: 1,
      rHandX: 5.4, rHandY: -16.5, rElbowBend: 1,
      clampFeet: false,
    });

    if (u <= 0.001) return windup;
    if (u < 0.22) return blendPose(windup, extend, easeOutCubic(u / 0.22));
    if (u < 0.68) return blendPose(extend, tuck, easeInOutQuad((u - 0.22) / 0.46));
    return blendPose(tuck, landPrep, easeInOutQuad((u - 0.68) / 0.32));
  }

  if (clip === 'run_jump') {
    // Dynamic leaping split stride across chasms!
    const launch = makePose({
      pelvisX: 0.8, pelvisY: -14.8, torsoLean: 28, headTilt: -14,
      hipYaw: 0.78, shoulderYaw: -0.72,
      lFootX: -8.6, lFootY: -2.2, lFootAngle: 46,
      rFootX: 8.6, rFootY: -6.2, rFootAngle: -8,
      lHandX: 8.4, lHandY: -23.8, lElbowBend: 1,
      rHandX: -6.8, rHandY: -17.5, rElbowBend: 1,
      clampFeet: false,
    });
    const apex = makePose({
      pelvisX: 0.6, pelvisY: -14.6, torsoLean: 24, headTilt: -8,
      hipYaw: 0.68, shoulderYaw: -0.45,
      lFootX: -7.2, lFootY: -5.6, lFootAngle: 36,
      rFootX: 8.2, rFootY: -6.6, rFootAngle: 4,
      lHandX: 7.2, lHandY: -22.2, lElbowBend: 1,
      rHandX: -5.4, rHandY: -18.0, rElbowBend: 1,
      clampFeet: false,
    });
    const reachLand = makePose({
      pelvisX: 0.4, pelvisY: -13.4, torsoLean: 18, headTilt: 4,
      hipYaw: 0.55, shoulderYaw: -0.25,
      lFootX: -4.2, lFootY: -2.6, lFootAngle: 14,
      rFootX: 6.4, rFootY: -1.6, rFootAngle: -16,
      lHandX: 4.8, lHandY: -18.5, lElbowBend: 1,
      rHandX: -4.2, rHandY: -16.8, rElbowBend: 1,
      clampFeet: false,
    });
    if (u < 0.45) return blendPose(launch, apex, easeInOutQuad(u / 0.45));
    return blendPose(apex, reachLand, easeInOutQuad((u - 0.45) / 0.55));
  }

  if (clip === 'fall') {
    const cyc = Math.sin(u * Math.PI * 2);
    const cyc2 = Math.cos(u * Math.PI * 2);
    return makePose({
      pelvisX: 0,
      pelvisY: -13.6,
      torsoLean: 8 + cyc * 4,
      headTilt: 14, // Looking down toward landing!
      hipYaw: 0.32,
      shoulderYaw: cyc * 0.25,
      lFootX: -3.2 + cyc * 1.4,
      lFootY: -3.4 - cyc * 1.2,
      lFootAngle: 18 + cyc * 10,
      rFootX: 3.4 - cyc * 1.4,
      rFootY: -4.2 + cyc * 1.2,
      rFootAngle: 14 - cyc * 10,
      // Arms raised upward windmilling for balance!
      lHandX: -4.8 + cyc2 * 1.8,
      lHandY: -26.8 + cyc * 1.4,
      lElbowBend: -1,
      rHandX: 5.4 - cyc2 * 1.8,
      rHandY: -27.2 - cyc * 1.4,
      rElbowBend: -1,
      clampFeet: false,
    });
  }

  if (clip === 'land') {
    const idle = evalIdlePose(ent, breath);
    const absorb = makePose({
      pelvisX: 0.2, pelvisY: -9.8, torsoLean: 22, headTilt: -6,
      hipYaw: 0.45, shoulderYaw: 0.30,
      lFootX: -4.2, lFootY: BASE_ANKLE_Y, lFootAngle: 14,
      rFootX: 4.4, rFootY: BASE_ANKLE_Y, rFootAngle: 0,
      lHandX: -4.6, lHandY: -11.5, lElbowBend: 1,
      rHandX: 5.4, rHandY: -10.8, rElbowBend: 1,
    });
    // Quick compress then smooth rise
    const k = u < 0.22 ? easeOutCubic(u / 0.22) : 1 - easeInOutQuad((u - 0.22) / 0.78);
    return blendPose(idle, absorb, k);
  }

  if (clip === 'hard_land') {
    const idle = evalIdlePose(ent, breath);
    const crunch = makePose({
      pelvisX: 0.6, pelvisY: -7.4, torsoLean: 34, headTilt: 14,
      hipYaw: 0.55, shoulderYaw: 0.45,
      lFootX: -5.6, lFootY: BASE_ANKLE_Y, lFootAngle: 34,
      rFootX: 4.8, rFootY: BASE_ANKLE_Y, rFootAngle: 0,
      lHandX: -3.2, lHandY: -8.0, lElbowBend: 1,
      rHandX: 6.2, rHandY: -1.8, rElbowBend: 1, // Bracing hand right onto the stone floor!
    });
    if (u < 0.16) return blendPose(idle, crunch, easeOutCubic(u / 0.16));
    if (u < 0.48) return crunch;
    return blendPose(crunch, idle, easeInOutQuad((u - 0.48) / 0.52));
  }

  if (clip === 'hang') {
    // Hands LOCKED EXACTLY on the oblique 3D ledge rim; body hangs & sways gently under gravity!
    const sway = Math.sin(u * Math.PI * 2);
    const legLag = Math.sin(u * Math.PI * 2 - 0.65);

    const rHandX = 4.1;
    const rHandY = -25.1;
    const lHandX = ent.facing > 0 ? 4.1 + ISO_DX * 0.26 : 4.1 - ISO_DX * 0.26;
    const lHandY = -25.1 + ISO_DY * 0.26;

    return makePose({
      pelvisX: 0.3 + sway * 0.85,
      pelvisY: -11.3,
      torsoLean: 5 + sway * 2.8,
      headTilt: -10,
      hipYaw: 0.22,
      shoulderYaw: 0.35,

      lFootX: -1.4 + legLag * 1.4,
      lFootY: 2.6,
      lFootAngle: 26 + legLag * 8,
      rFootX: 1.2 + legLag * 1.2,
      rFootY: 2.0,
      rFootAngle: 22 + legLag * 8,

      lHandX,
      lHandY,
      lElbowBend: -1,
      rHandX,
      rHandY,
      rElbowBend: -1,
      clampFeet: false,
    });
  }

  if (clip === 'climb_up') {
    // Authentic 4-stage mantle pull-up with hands locked onto the ledge rim through u=0.68!
    const idle = evalIdlePose(ent, breath);

    // Compute exact ledge corner in current local space from ent.hangLedge!
    let ledgeLocalX = 4.1;
    let ledgeLocalY = -25.1;
    if (ent.hangLedge) {
      const edgeWorldX = ent.hangLedge.facing > 0
        ? (ent.hangLedge.openCol + 1) * TILE_W
        : ent.hangLedge.openCol * TILE_W;
      const edgeWorldY = floorY(ent.hangLedge.row) + SLAB_FRONT_OFF;
      ledgeLocalX = (edgeWorldX - ent.x) * ent.facing;
      ledgeLocalY = edgeWorldY - ent.y;
    }

    const rGripX = clamp(ledgeLocalX + 1.0, -7, 8);
    const rGripY = clamp(ledgeLocalY, -27, -2);
    const lGripX = clamp(ledgeLocalX + (ent.facing > 0 ? 3.2 : -1.5), -8, 9);
    const lGripY = clamp(ledgeLocalY - 1.8, -28.5, -3);

    // Stage 0 (u=0): Hanging at rim
    const s0 = makePose({
      pelvisX: 0.2, pelvisY: -11.5, torsoLean: 6, headTilt: -10,
      hipYaw: 0.25, shoulderYaw: 0.35,
      lFootX: -1.6, lFootY: 1.6, lFootAngle: 22,
      rFootX: 1.4, rFootY: 1.0, rFootAngle: 18,
      lHandX: lGripX, lHandY: lGripY, lElbowBend: -1,
      rHandX: rGripX, rHandY: rGripY, rElbowBend: -1,
      clampFeet: false,
    });
    // Stage 1 (u=0.30): Pull chest up & ELBOW OVER the ledge rim!
    const s1 = makePose({
      pelvisX: 0.8, pelvisY: -12.6, torsoLean: 24, headTilt: -10,
      hipYaw: 0.45, shoulderYaw: 0.50,
      lFootX: -3.2, lFootY: -1.4, lFootAngle: 28,
      rFootX: 4.0, rFootY: -4.2, rFootAngle: 12, // Front knee tucking up!
      lHandX: lGripX + 0.8, lHandY: lGripY, lElbowBend: -1,
      rHandX: rGripX + 0.8, rHandY: rGripY, rElbowBend: -1,
      clampFeet: false,
    });
    // Stage 2 (u=0.62): KNEE UP & front foot planted on top of ledge, hands pressing off rim!
    const s2 = makePose({
      pelvisX: 0.4, pelvisY: -9.2, torsoLean: 30, headTilt: -8,
      hipYaw: 0.62, shoulderYaw: 0.45,
      lFootX: -5.6, lFootY: -2.2, lFootAngle: 34,
      rFootX: 4.8, rFootY: BASE_ANKLE_Y, rFootAngle: 0,
      lHandX: clamp(lGripX + 1.2, -4, 6), lHandY: clamp(lGripY, -8, -1.6), lElbowBend: 1,
      rHandX: clamp(rGripX + 1.5, -2, 7), rHandY: clamp(rGripY, -8, -1.6), rElbowBend: 1,
      clampFeet: false,
    });
    // Stage 3 (u=1.0): Standing cleanly on top of the ledge!
    if (u < 0.30) return blendPose(s0, s1, easeInOutQuad(u / 0.30));
    if (u < 0.62) return blendPose(s1, s2, easeInOutQuad((u - 0.30) / 0.32));
    return blendPose(s2, idle, easeOutCubic((u - 0.62) / 0.38));
  }

  if (clip === 'climb_down') {
    // Smooth reverse of climb_up: crouch -> plant hands on rim -> swing legs over -> lower into hang
    const idle = evalIdlePose(ent, breath);
    let ledgeLocalX = 4.1;
    let ledgeLocalY = -25.1;
    if (ent.hangLedge) {
      const edgeWorldX = ent.hangLedge.facing > 0
        ? (ent.hangLedge.openCol + 1) * TILE_W
        : ent.hangLedge.openCol * TILE_W;
      const edgeWorldY = floorY(ent.hangLedge.row) + SLAB_FRONT_OFF;
      ledgeLocalX = (edgeWorldX - ent.x) * ent.facing;
      ledgeLocalY = edgeWorldY - ent.y;
    }
    const rGripX = clamp(ledgeLocalX + 0.6, -6, 7);
    const rGripY = clamp(ledgeLocalY, -27, -2);
    const lGripX = clamp(ledgeLocalX + (ent.facing > 0 ? 2.6 : -1.8), -7, 8);
    const lGripY = clamp(ledgeLocalY - 1.8, -28.5, -3);

    const s1 = makePose({
      pelvisX: -0.2, pelvisY: -9.4, torsoLean: 28, headTilt: 8,
      hipYaw: 0.45, shoulderYaw: 0.40,
      lFootX: -4.2, lFootY: BASE_ANKLE_Y, lFootAngle: 18,
      rFootX: 4.2, rFootY: BASE_ANKLE_Y, rFootAngle: 0,
      lHandX: lGripX, lHandY: clamp(lGripY, -8, -1.6), lElbowBend: 1,
      rHandX: rGripX, rHandY: clamp(rGripY, -8, -1.6), rElbowBend: 1,
      clampFeet: false,
    });
    const s2 = makePose({
      pelvisX: 0.2, pelvisY: -12.2, torsoLean: 16, headTilt: -6,
      hipYaw: 0.35, shoulderYaw: 0.35,
      lFootX: -2.4, lFootY: -0.6, lFootAngle: 26,
      rFootX: 2.2, rFootY: -1.8, rFootAngle: 22,
      lHandX: lGripX, lHandY: lGripY, lElbowBend: -1,
      rHandX: rGripX, rHandY: rGripY, rElbowBend: -1,
      clampFeet: false,
    });
    const s3 = makePose({
      pelvisX: 0.2, pelvisY: -11.5, torsoLean: 6, headTilt: -12,
      hipYaw: 0.25, shoulderYaw: 0.35,
      lFootX: -1.6, lFootY: 1.6, lFootAngle: 22,
      rFootX: 1.4, rFootY: 1.0, rFootAngle: 18,
      lHandX: 4.1 + (ent.facing > 0 ? ISO_DX * 0.26 : -ISO_DX * 0.26),
      lHandY: -25.1 + ISO_DY * 0.26,
      lElbowBend: -1,
      rHandX: 4.1,
      rHandY: -25.1,
      rElbowBend: -1,
      clampFeet: false,
    });

    if (u < 0.32) return blendPose(idle, s1, easeInOutQuad(u / 0.32));
    if (u < 0.70) return blendPose(s1, s2, easeInOutQuad((u - 0.32) / 0.38));
    return blendPose(s2, s3, easeOutCubic((u - 0.70) / 0.30));
  }

  return evalIdlePose(ent, breath);
}

function evalIdlePose(ent, breath) {
  const b = Math.sin(breath);
  const isCeline = ent.palette === 'celine';
  return makePose({
    pelvisX: 0,
    pelvisY: -15.55 + b * 0.18, // Tall, confident upright stand (natural micro-unlocked knees!)
    torsoLean: (isCeline ? 1.5 : 3) + b * 0.8,
    headTilt: (isCeline ? 0 : 1) - b * 0.4,
    hipYaw: 0.26,
    shoulderYaw: 0.26,

    lFootX: -2.2,
    lFootY: BASE_ANKLE_Y,
    lFootAngle: 0,
    lFootTurnOut: 0.25,

    rFootX: 2.5,
    rFootY: BASE_ANKLE_Y,
    rFootAngle: 0,
    rFootTurnOut: 0.0,

    lHandX: isCeline ? -1.8 : -2.6,
    lHandY: -15.2 + b * 0.22,
    lElbowBend: 1,

    rHandX: isCeline ? 4.8 : 3.2,
    rHandY: (isCeline ? -18.2 : -15.4) + b * 0.22,
    rElbowBend: 1,
  });
}

// ---------------------------------------------------------------------------
// Drawing Primitives (2x Crisp Anatomical Shapes)
// ---------------------------------------------------------------------------

function drawLimbTaper(ctx, x1, y1, x2, y2, r1, r2, fill, hi = null, outline = null) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.05) return;
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

  // Subtle front-edge rim light for 2x cylindrical volume
  if (hi) {
    ctx.beginPath();
    ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
    ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
    ctx.lineTo(x2 + nx * (r2 * 0.32), y2 + ny * (r2 * 0.32));
    ctx.lineTo(x1 + nx * (r1 * 0.32), y1 + ny * (r1 * 0.32));
    ctx.closePath();
    ctx.fillStyle = hi;
    ctx.fill();
  }

  if (outline) {
    ctx.beginPath();
    ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
    ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
    ctx.moveTo(x1 - nx * r1, y1 - ny * r1);
    ctx.lineTo(x2 - nx * r2, y2 - ny * r2);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Smooth joint cap at origin
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x1, y1, r1 * 0.96, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoot(ctx, ankle, angleDeg, turnOut, pal, isFront, outline, hS, flipX = false) {
  const a = degRad(angleDeg);
  const ah = 1.5 * hS;

  ctx.save();
  ctx.translate(ankle.x, ankle.y);
  if (flipX && turnOut <= 0.55) {
    ctx.scale(-1, 1);
    ctx.rotate(-a);
  } else {
    ctx.rotate(a);
  }

  const fill = isFront ? pal.boots : '#0d0f13';
  const hi = isFront ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';

  if (turnOut > 0.55) {
    // Turned-out rear fencing boot (foreshortened perpendicular stance!)
    ctx.beginPath();
    ctx.moveTo(-1.3, -0.3);
    ctx.lineTo(1.2, -0.3);
    ctx.lineTo(2.0, ah - 0.3);
    ctx.lineTo(1.8, ah);
    ctx.lineTo(-1.6, ah);
    ctx.lineTo(-1.7, ah - 0.5);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    // Crisp sole & toe cap
    ctx.fillStyle = pal.bootSole;
    ctx.fillRect(-1.6, ah - 0.45, 3.5, 0.45);
    ctx.fillStyle = hi;
    ctx.fillRect(-0.5, 0.2, 1.8, 0.5);
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 0.45;
      ctx.stroke();
    }
  } else {
    // Profile boot with articulated heel, arch, instep, and toe!
    ctx.beginPath();
    ctx.moveTo(-1.15, -0.35);       // Back ankle
    ctx.lineTo(-1.55, ah - 0.25);   // Heel back
    ctx.lineTo(-1.4, ah);           // Heel bottom
    ctx.lineTo(0.2, ah);            // Arch rear
    ctx.lineTo(0.7, ah - 0.15);     // Arch lift
    ctx.lineTo(2.2, ah);            // Ball of foot
    ctx.lineTo(3.55, ah - 0.15);    // Toe tip bottom
    ctx.lineTo(3.75, ah - 0.6);     // Toe tip front
    ctx.lineTo(2.4, ah - 1.05);     // Vamp
    ctx.lineTo(1.0, -0.25);         // Front ankle
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // Sole line
    ctx.fillStyle = pal.bootSole;
    ctx.fillRect(-1.45, ah - 0.4, 4.9, 0.42);
    // Boot cuff / vamp glint
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.moveTo(0.9, -0.1);
    ctx.lineTo(2.4, ah - 0.9);
    ctx.lineTo(2.1, ah - 0.6);
    ctx.lineTo(0.7, 0.25);
    ctx.closePath();
    ctx.fill();

    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 0.45;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHand(ctx, hand, elbow, skin, skinShade, outline) {
  const ang = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(ang);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0.3, 0, 1.0, 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinShade;
  ctx.beginPath();
  ctx.ellipse(0.2, 0.32, 0.72, 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSwordWeapon(ctx, hand, angleDeg, pal, ent, pose, vis, time) {
  const slide = pose.sheatheSlide || 0;
  const baseLen = (pal.swordLen || 17.8) * (1 - slide * 0.72);
  if (baseLen < 2) return null;

  const r = degRad(angleDeg);
  const dx = Math.sin(r);
  const dy = Math.cos(r);
  const nx = -dy;
  const ny = dx;

  // Pommel behind hand, guard snugly in front of fist
  const pomX = hand.x - dx * 2.1;
  const pomY = hand.y - dy * 2.1;
  const guardX = hand.x + dx * 1.0;
  const guardY = hand.y + dy * 1.0;
  const tipX = guardX + dx * baseLen;
  const tipY = guardY + dy * baseLen;

  // Subtle sword tip lag curvature during fast movement!
  const lag = clamp(vis.swordLag, -12, 12);
  const midX = guardX + dx * (baseLen * 0.55) + nx * (lag * 0.06);
  const midY = guardY + dy * (baseLen * 0.55) + ny * (lag * 0.06);

  // Active lunge / slash motion trail
  if (pose.lungeSlash > 0.05) {
    const a = pose.lungeSlash * 0.34;
    ctx.save();
    const tg = ctx.createLinearGradient(guardX - dx * 5, guardY - dy * 5, tipX, tipY);
    tg.addColorStop(0, 'rgba(255,255,255,0)');
    tg.addColorStop(0.5, `rgba(225,244,255,${(a * 0.7).toFixed(2)})`);
    tg.addColorStop(1, `rgba(255,255,255,${a.toFixed(2)})`);
    ctx.strokeStyle = tg;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(guardX - dx * 6, guardY - dy * 6);
    ctx.lineTo(tipX + dx * 1.5, tipY + dy * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  // Leather-wrapped grip & compact pommel
  ctx.strokeStyle = '#2a221c';
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(pomX, pomY);
  ctx.lineTo(guardX, guardY);
  ctx.stroke();
  ctx.fillStyle = pal.hilt;
  ctx.beginPath();
  ctx.arc(pomX, pomY, 0.75, 0, Math.PI * 2);
  ctx.fill();

  // Blade silhouette tailored to weapon style
  const style = pal.swordStyle || 'sabre';
  const baseHalfW = style === 'broadsword' ? 1.1 : style === 'rapier' || style === 'ornate_rapier' ? 0.6 : 0.8;

  // Boss Phase 2/3 blade aura shimmer for Dr. Zins
  if (ent.type === 'zins' && ent.bossPhase >= 2) {
    ctx.save();
    ctx.strokeStyle = ent.bossPhase >= 3 ? 'rgba(255, 72, 92, 0.38)' : 'rgba(245, 196, 81, 0.32)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(guardX, guardY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();
    ctx.restore();
  }

  // Shaded lower bevel of blade (+n = bottom edge when pointing forward)
  ctx.beginPath();
  ctx.moveTo(guardX - nx * baseHalfW, guardY - ny * baseHalfW);
  ctx.quadraticCurveTo(midX - nx * (baseHalfW * 0.65), midY - ny * (baseHalfW * 0.65), tipX, tipY);
  ctx.quadraticCurveTo(midX + nx * (baseHalfW * 0.65), midY + ny * (baseHalfW * 0.65), guardX + nx * baseHalfW, guardY + ny * baseHalfW);
  ctx.closePath();
  ctx.fillStyle = pal.swordShade || '#94a8bc';
  ctx.fill();

  // Bright honed upper edge (-n = top lit edge when pointing forward)
  ctx.beginPath();
  ctx.moveTo(guardX - nx * baseHalfW, guardY - ny * baseHalfW);
  ctx.quadraticCurveTo(midX - nx * (baseHalfW * 0.65), midY - ny * (baseHalfW * 0.65), tipX, tipY);
  ctx.quadraticCurveTo(midX, midY, guardX, guardY);
  ctx.closePath();
  ctx.fillStyle = pal.sword;
  ctx.fill();

  // Thin dark metallic spine definition
  ctx.strokeStyle = 'rgba(10, 16, 24, 0.42)';
  ctx.lineWidth = 0.38;
  ctx.beginPath();
  ctx.moveTo(guardX + nx * baseHalfW, guardY + ny * baseHalfW);
  ctx.quadraticCurveTo(midX + nx * (baseHalfW * 0.65), midY + ny * (baseHalfW * 0.65), tipX, tipY);
  ctx.stroke();

  // Guard / Hilt style (+n = finger/knuckle side, -n = thumb/top side!)
  if (style === 'rapier' || style === 'ornate_rapier') {
    // Sleek fencing bell/cup-guard curving cleanly over the fingers + fine quillons
    ctx.fillStyle = pal.hilt;
    ctx.beginPath();
    ctx.ellipse(guardX - dx * 0.35, guardY - dy * 0.35, 1.35, 2.0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.hiltDark;
    ctx.lineWidth = 0.45;
    ctx.stroke();
    ctx.strokeStyle = pal.hilt;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(guardX + nx * 2.5, guardY + ny * 2.5);
    ctx.lineTo(guardX - nx * 2.2, guardY - ny * 2.2);
    ctx.stroke();
  } else if (style === 'broadsword') {
    // Heavy wide cavalry crossguard
    ctx.strokeStyle = pal.hiltDark;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(guardX + nx * 3.0, guardY + ny * 3.0);
    ctx.lineTo(guardX - nx * 2.8, guardY - ny * 2.8);
    ctx.stroke();
    ctx.strokeStyle = pal.hilt;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(guardX + nx * 2.8, guardY + ny * 2.8);
    ctx.lineTo(guardX - nx * 2.6, guardY - ny * 2.6);
    ctx.stroke();
  } else {
    // Authentic Swiss ceremonial sabre: compact crossguard + sleek D-guard knuckle-bow on the FINGER (+n) side!
    ctx.strokeStyle = pal.hiltDark;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.moveTo(guardX - nx * 1.4, guardY - ny * 1.4);
    ctx.lineTo(guardX + nx * 2.0, guardY + ny * 2.0);
    ctx.stroke();
    ctx.strokeStyle = pal.hilt;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(guardX - nx * 1.35, guardY - ny * 1.35);
    ctx.lineTo(guardX + nx * 1.95, guardY + ny * 1.95);
    ctx.stroke();
    // Knuckle-bow hugging cleanly UNDER the fingers (+n) back to the pommel!
    ctx.strokeStyle = pal.hiltDark;
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(guardX + nx * 1.85, guardY + ny * 1.85);
    ctx.quadraticCurveTo(hand.x + nx * 1.95, hand.y + ny * 1.95, pomX + nx * 0.45, pomY + ny * 0.45);
    ctx.stroke();
    ctx.strokeStyle = pal.hilt;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(guardX + nx * 1.85, guardY + ny * 1.85);
    ctx.quadraticCurveTo(hand.x + nx * 1.95, hand.y + ny * 1.95, pomX + nx * 0.45, pomY + ny * 0.45);
    ctx.stroke();
  }

  // Successful parry blade-contact clash spark (crisp metallic steel burst!)
  if (vis.clashSparkT > 0) {
    const k = vis.clashSparkT / 0.18;
    const cx = guardX + dx * (baseLen * 0.36);
    const cy = guardY + dy * (baseLen * 0.36);
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.35, 0, 1);
    // Subtle crisp shock ring
    ctx.strokeStyle = 'rgba(255, 240, 165, 0.72)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, (1 - k) * 4.5 + 1.2, 0, Math.PI * 2);
    ctx.stroke();
    // Sharp thin metallic spark rays + scattered hot flecks
    const ray = 3.8 * k + 1.2;
    ctx.strokeStyle = '#fff5bd';
    ctx.lineWidth = 0.55;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.35;
      const len = i % 2 === 0 ? ray : ray * 0.65;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 0.7, cy + Math.sin(a) * 0.7);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.stroke();
      // Tiny detached flying spark fleck
      ctx.fillStyle = '#ffcf5c';
      ctx.fillRect(cx + Math.cos(a) * (len + 1.3) - 0.3, cy + Math.sin(a) * (len + 1.3) - 0.3, 0.6, 0.6);
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.0 * k + 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Readable enemy windup / feint blade-glint telegraph (same timing & color coding, sharper 2x star!)
  if (ent.strikeTelegraph > 0 && (ent.state === 'combat_strike' || ent.state === 'combat_feint')) {
    const gx = tipX;
    const gy = tipY;
    ctx.save();
    if (ent.state === 'combat_feint') {
      drawDiamondStar(ctx, gx, gy, 2.8, '#f0b84a', '#fff0c2');
    } else {
      const starCol = ent.strikeKind === 'heavy' ? '#ff9442' :
        ent.strikeKind === 'riposte' ? '#8cecff' : '#fff5a8';
      const arm = ent.strikeKind === 'heavy' ? 5.2 : 4.2;
      drawDiamondStar(ctx, gx, gy, arm, starCol, '#ffffff');
    }
    ctx.restore();
  }

  return { tipX, tipY };
}

function drawDiamondStar(ctx, x, y, r, color, core) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.24, y - r * 0.24);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.24, y + r * 0.24);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.24, y + r * 0.24);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.24, y - r * 0.24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.0, r * 0.26), 0, Math.PI * 2);
  ctx.fill();
}

function drawTorsoAndCostume(ctx, pelvis, chest, lHip, rHip, lShoulder, rShoulder, pal, flashing, outline, hemAng, wS, hS, faceYaw = 1, shoulderYaw = 0) {
  const jacket = flashing ? '#ffffff' : pal.jacket;
  const jacketHi = flashing ? '#ffffff' : pal.jacketHi;
  const jacketDark = flashing ? '#ffcccc' : pal.jacketDark;

  const frontView = Math.abs(faceYaw) < 0.35;
  const faceSign = faceYaw < -0.35 ? -1 : 1;

  // Spine axis (pelvis -> waist -> chest):
  // ux, uy points UP along spine; fx, fy points FORWARD (+x when upright & facing right, -x when facing left)!
  const dxT = chest.x - pelvis.x;
  const dyT = chest.y - pelvis.y;
  const tLen = Math.hypot(dxT, dyT) || 1;
  const ux = dxT / tLen;
  const uy = dyT / tLen;
  const fx = (-dyT / tLen) * faceSign;
  const fy = (dxT / tLen) * faceSign;

  const waist = { x: lerp(pelvis.x, chest.x, 0.38), y: lerp(pelvis.y, chest.y, 0.38) };
  const shYaw = clamp(Math.abs(rShoulder.x - lShoulder.x) / (4.7 * wS), 0, 1);
  const hipYaw = clamp(Math.abs(rHip.x - lHip.x) / (3.7 * wS), 0, 1);

  // Anatomical full-bodied ribcage, waist, and pelvis widths (steady across the entire run cycle!)
  const chestBack = (frontView ? 3.25 : 2.85) * wS;
  const chestFront = (frontView ? 3.25 : 3.05) * wS;
  const waistBack = (frontView ? 2.40 : 2.15) * wS;
  const waistFront = (frontView ? 2.40 : 2.28) * wS;
  const hipBack = (frontView ? 2.65 : 2.55) * wS;
  const hipFront = (frontView ? 2.65 : 2.58) * wS;

  const pSL = { x: chest.x - fx * chestBack, y: chest.y - fy * chestBack };
  const pSR = { x: chest.x + fx * chestFront, y: chest.y + fy * chestFront };
  const pWL = { x: waist.x - fx * waistBack, y: waist.y - fy * waistBack };
  const pWR = { x: waist.x + fx * waistFront, y: waist.y + fy * waistFront };
  const pHL = { x: pelvis.x - fx * hipBack, y: pelvis.y - fy * hipBack };
  const pHR = { x: pelvis.x + fx * hipFront, y: pelvis.y + fy * hipFront };
  const waistL = pWL;
  const waistR = pWR;

  // Secondary-motion coat-tail / jacket hem behind pelvis (suppressed on front view)
  const hemRad = degRad(hemAng);
  const tailLen = frontView ? 0 : (pal.coatStyle === 'suit_tails' ? 5.6 * hS : pal.coatStyle === 'courier' ? 2.2 * hS : 1.6 * hS);
  if (tailLen > 1.2) {
    const tx = pHL.x - ux * tailLen + Math.sin(hemRad) * tailLen * 0.7 * faceSign;
    const ty = pHL.y - uy * tailLen + Math.cos(hemRad) * 0.4;
    const tx2 = pelvis.x - ux * (tailLen * 0.75) + Math.sin(hemRad) * tailLen * 0.4 * faceSign;
    const ty2 = pelvis.y - uy * (tailLen * 0.75);
    ctx.beginPath();
    ctx.moveTo(pHL.x, pHL.y);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx2, ty2);
    ctx.lineTo(pelvis.x + fx * 0.6, pelvis.y + fy * 0.6);
    ctx.closePath();
    ctx.fillStyle = jacketDark;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 0.45;
      ctx.stroke();
    }
  }

  // Main articulated torso silhouette (broad athletic shoulders -> solid waist -> hips)
  ctx.beginPath();
  ctx.moveTo(pSL.x, pSL.y);
  ctx.lineTo(pSR.x, pSR.y);
  ctx.lineTo(pWR.x, pWR.y);
  ctx.lineTo(pHR.x, pHR.y);
  ctx.lineTo(pHL.x, pHL.y);
  ctx.lineTo(pWL.x, pWL.y);
  ctx.closePath();
  ctx.fillStyle = jacket;
  ctx.fill();

  // Directional 2x volume shading (back-side shadow + front-chest highlight)
  ctx.beginPath();
  ctx.moveTo(pSL.x, pSL.y);
  ctx.lineTo(chest.x - fx * 0.4, chest.y - fy * 0.4);
  ctx.lineTo(pelvis.x - fx * 0.3, pelvis.y - fy * 0.3);
  ctx.lineTo(pHL.x, pHL.y);
  ctx.lineTo(pWL.x, pWL.y);
  ctx.closePath();
  ctx.fillStyle = jacketDark;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(pSR.x, pSR.y);
  ctx.lineTo(lerp(chest.x, pSR.x, 0.42), lerp(chest.y, pSR.y, 0.42));
  ctx.lineTo(lerp(waist.x, pWR.x, 0.42), lerp(waist.y, pWR.y, 0.42));
  ctx.lineTo(pWR.x, pWR.y);
  ctx.closePath();
  ctx.fillStyle = jacketHi;
  ctx.fill();

  // Costume-specific silhouette & chest details
  if (!flashing) {
    if (pal.coatStyle === 'courier') {
      // High collar + iconic diagonal white Swiss courier strap + brass buckle
      // Shifts slightly with shoulderYaw so torso counter-rotation reads clearly in 3D!
      const twistShift = frontView ? 0 : clamp(shoulderYaw * 1.45, -0.85, 0.85);
      const sxTop = lerp(pSL.x, chest.x, frontView ? 0.25 : 0.55) + fx * twistShift;
      const syTop = lerp(pSL.y, chest.y, frontView ? 0.25 : 0.55) + fy * twistShift;
      const sxBot = lerp(pHR.x, pelvis.x, frontView ? 0.18 : 0.30) + fx * (twistShift * 0.45);
      const syBot = lerp(pHR.y, pelvis.y, frontView ? 0.18 : 0.30) + fy * (twistShift * 0.45);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = frontView ? 1.35 : 1.15 - Math.max(0, twistShift) * 0.25;
      ctx.beginPath();
      ctx.moveTo(sxTop, syTop);
      ctx.lineTo(sxBot, syBot);
      ctx.stroke();
      // Small brass buckle
      const bx = lerp(sxTop, sxBot, 0.52);
      const by = lerp(syTop, syBot, 0.52);
      ctx.fillStyle = '#e0b84c';
      ctx.fillRect(bx - 0.65, by - 0.65, 1.3, 1.3);
      // Collar rim
      ctx.strokeStyle = jacketHi;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(chest.x - 1.2, chest.y + 0.2);
      ctx.lineTo(chest.x + 1.4, chest.y + 0.1);
      ctx.stroke();
    } else if (pal.coatStyle === 'armored') {
      // Heavy ballistic tactical vest & shoulder pauldrons!
      ctx.beginPath();
      ctx.moveTo(lerp(pSL.x, pSR.x, 0.12), lerp(pSL.y, pSR.y, 0.12));
      ctx.lineTo(lerp(pSL.x, pSR.x, 0.92), lerp(pSL.y, pSR.y, 0.92));
      ctx.lineTo(lerp(pWL.x, pWR.x, 0.90), lerp(pWL.y, pWR.y, 0.90));
      ctx.lineTo(lerp(pWL.x, pWR.x, 0.14), lerp(pWL.y, pWR.y, 0.14));
      ctx.closePath();
      ctx.fillStyle = pal.vestColor || '#242b2e';
      ctx.fill();
      ctx.strokeStyle = pal.vestHi || '#3c464a';
      ctx.lineWidth = 0.55;
      ctx.stroke();
      // Heavy shoulder pauldron plates
      ctx.fillStyle = pal.vestHi || '#3c464a';
      ctx.beginPath();
      ctx.ellipse(rShoulder.x, rShoulder.y - 0.2, 2.2, 1.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.fillRect(rShoulder.x - 0.4, rShoulder.y - 0.5, 0.8, 0.8);
    } else if (pal.coatStyle === 'fencer') {
      // Asymmetric crimson fencing plastron & high collar
      ctx.beginPath();
      ctx.moveTo(chest.x - 0.4, chest.y - 0.4);
      ctx.lineTo(pSR.x, pSR.y + 0.2);
      ctx.lineTo(pWR.x, pWR.y);
      ctx.lineTo(waistL.x + 0.6, waistL.y);
      ctx.closePath();
      ctx.fillStyle = pal.accent;
      ctx.fill();
      // Crisp white fencing collar
      ctx.strokeStyle = '#f0f6fc';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(chest.x - 1.3, chest.y);
      ctx.lineTo(chest.x + 1.5, chest.y);
      ctx.stroke();
    } else if (pal.coatStyle === 'suit_tails') {
      // Tailored Dr. Zins suit: white V-shirt, crimson silk tie, gold pocket accent!
      ctx.beginPath();
      ctx.moveTo(chest.x - 0.6, chest.y - 0.3);
      ctx.lineTo(chest.x + 1.6, chest.y - 0.2);
      ctx.lineTo(lerp(chest.x, pelvis.x, 0.48) + 0.8, lerp(chest.y, pelvis.y, 0.48));
      ctx.closePath();
      ctx.fillStyle = pal.shirt || '#f4f2ec';
      ctx.fill();
      // Crimson silk tie
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(chest.x + 0.7, chest.y + 0.1);
      ctx.lineTo(lerp(chest.x, pelvis.x, 0.56) + 0.7, lerp(chest.y, pelvis.y, 0.56));
      ctx.stroke();
      // Crimson pocket square
      ctx.fillStyle = pal.accent;
      ctx.fillRect(pSR.x - 1.5, pSR.y + 2.4, 1.3, 0.8);
    } else if (pal.coatStyle === 'blazer') {
      // Celine's Federal Audit blazer + cream silk blouse lapel
      ctx.beginPath();
      ctx.moveTo(chest.x - 0.3, chest.y);
      ctx.lineTo(chest.x + 1.4, chest.y);
      ctx.lineTo(lerp(chest.x, pelvis.x, 0.52) + 0.5, lerp(chest.y, pelvis.y, 0.52));
      ctx.closePath();
      ctx.fillStyle = pal.accent;
      ctx.fill();
    } else {
      // Vault guard tunic / epaulette / sentry sash & brass buttons
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(pSL.x + 0.5, pSL.y + 0.3);
      ctx.lineTo(pHR.x - 0.4, pHR.y - 0.5);
      ctx.stroke();
      if (pal.coatStyle === 'epaulette' || pal.coatStyle === 'sentry') {
        ctx.fillStyle = pal.accent;
        ctx.fillRect(rShoulder.x - 1.0, rShoulder.y - 1.1, 2.2, 0.85);
      }
    }

    // Waist belt + buckle (all except Celine & Zins's buttoned suit)
    if (pal.coatStyle !== 'suit_tails' && pal.coatStyle !== 'blazer') {
      ctx.strokeStyle = pal.boots;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(pHL.x, pHL.y - 0.5);
      ctx.lineTo(pHR.x, pHR.y - 0.5);
      ctx.stroke();
      ctx.fillStyle = '#d9b24c';
      ctx.fillRect(lerp(pHL.x, pHR.x, 0.65) - 0.6, lerp(pHL.y, pHR.y, 0.65) - 1.0, 1.2, 1.0);
    }
  }

  // Crisp 0.5px torso outline
  if (outline) {
    ctx.beginPath();
    ctx.moveTo(pSL.x, pSL.y);
    ctx.lineTo(pSR.x, pSR.y);
    ctx.lineTo(pWR.x, pWR.y);
    ctx.lineTo(pHR.x, pHR.y);
    ctx.lineTo(pHL.x, pHL.y);
    ctx.lineTo(pWL.x, pWL.y);
    ctx.closePath();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Hero / Deepfake neat courier collar wrap (clean silhouette, zero stray sliver behind upper back!)
  if (pal.scarfColor && !flashing) {
    ctx.fillStyle = pal.scarfStripe || pal.jacketDark;
    ctx.beginPath();
    ctx.ellipse(chest.x + 0.1, chest.y - 0.35, 2.05, 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.scarfColor;
    ctx.fillRect(chest.x - 1.25, chest.y - 0.6, 2.55, 0.42);
  }
  return {
    torsoBackX: pWL.x,
    torsoFrontX: pWR.x,
    chestBackX: pSL.x,
    chestFrontX: pSR.x,
    hipBackX: pHL.x,
    hipFrontX: pHR.x,
  };
}

function drawHeadAndHair(ctx, neck, head, headAngleDeg, pal, flashing, outline, hairAng, wS, hS, faceYaw = 1) {
  const skin = flashing ? '#ffffff' : pal.skin;
  const skinShade = flashing ? '#ffdddd' : pal.skinShade;
  const rx = 2.25 * wS;
  const ry = 2.65 * hS;

  // Articulated neck
  drawLimbTaper(ctx, neck.x, neck.y + 0.5, head.x - 0.1 * Math.sign(faceYaw || 1), head.y + 1.5, 1.05 * wS, 0.9 * wS, skinShade, skin);

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(degRad(headAngleDeg));

  const frontView = Math.abs(faceYaw) < 0.35;
  const flipHead = faceYaw < -0.35;
  if (flipHead) {
    ctx.scale(-1, 1);
  }

  // Head oval + subtle forward nose/jaw profile silhouette (suppressed when facing directly toward viewer)
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();

  if (!frontView) {
    // Subtle nose/brow & chin profile toward +x
    ctx.beginPath();
    ctx.moveTo(rx * 0.78, -0.7);
    ctx.lineTo(rx + 0.55, 0.05);
    ctx.lineTo(rx * 0.72, 0.45);
    ctx.lineTo(rx * 0.85, 1.45);
    ctx.lineTo(0.2, ry * 0.92);
    ctx.closePath();
    ctx.fillStyle = skin;
    ctx.fill();

    // Back-of-head shadow crescent
    ctx.beginPath();
    ctx.arc(-0.35, 0.1, rx * 0.92, Math.PI * 0.55, Math.PI * 1.45);
    ctx.fillStyle = skinShade;
    ctx.fill();
  }

  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Expressive eye(s) & brow(s)
  if (!flashing) {
    if (frontView) {
      // Front-facing passing silhouette during 180-degree turn (both eyes & nose bridge!)
      const shiftX = faceYaw * 0.6;
      ctx.fillStyle = '#181a20';
      ctx.fillRect(-1.1 + shiftX, -0.5, 0.65, 0.7);
      ctx.fillRect(0.45 + shiftX, -0.5, 0.65, 0.7);
      ctx.fillStyle = pal.hair;
      ctx.fillRect(-1.25 + shiftX, -1.1, 0.95, 0.35);
      ctx.fillRect(0.3 + shiftX, -1.1, 0.95, 0.35);
      ctx.fillStyle = skinShade;
      ctx.fillRect(-0.15 + shiftX, 0.1, 0.35, 0.65);
    } else {
      ctx.fillStyle = '#181a20';
      ctx.fillRect(rx * 0.36, -0.55, 0.75, 0.75);
      ctx.fillStyle = pal.hair;
      ctx.fillRect(rx * 0.25, -1.15, 1.15, 0.4);
    }
  }

  // Distinct hair / headwear per archetype
  const hw = pal.headwear || 'hair_courier';
  if (hw === 'hair_courier') {
    if (frontView) {
      // Front-facing athletic hair crown during turn passing frame
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.ellipse(0, -1.15, rx * 1.04, ry * 0.62, 0, Math.PI * 0.95, Math.PI * 2.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.hairHi;
      ctx.beginPath();
      ctx.ellipse(0, -ry * 0.76, 1.1, 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Natural, compact athletic courier hair hugging the skull & nape
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.moveTo(rx * 0.95, -1.05);
      ctx.quadraticCurveTo(rx * 0.55, -ry * 1.15, -0.35, -ry * 1.08);
      ctx.quadraticCurveTo(-rx * 1.15, -ry * 0.92, -rx * 1.05, -0.15);
      ctx.quadraticCurveTo(-rx * 1.05, 0.75, -rx * 0.45, 0.95);
      ctx.lineTo(-rx * 0.35, -0.2);
      ctx.quadraticCurveTo(0.2, -1.25, rx * 0.95, -1.05);
      ctx.closePath();
      ctx.fill();
      const hShift = clamp(hairAng * 0.03, -0.55, 0.55);
      ctx.beginPath();
      ctx.moveTo(-rx * 0.85, -1.35);
      ctx.quadraticCurveTo(-rx * 1.18 + hShift, -0.85, -rx * 1.02 + hShift, 0.25);
      ctx.lineTo(-rx * 0.65, 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.hairHi;
      ctx.beginPath();
      ctx.ellipse(-0.3, -ry * 0.80, 1.15, 0.32, -0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (hw === 'hair_zins') {
    // Slicked-back aristocratic silver hair (exposing full face profile!) + monocle gleam
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.moveTo(rx * 0.65, -ry * 0.72);
    ctx.quadraticCurveTo(-0.3, -ry * 1.18, -rx * 0.95, -ry * 0.45);
    ctx.lineTo(-rx * 1.1, 0.75);
    ctx.lineTo(-rx * 0.45, 0.8);
    ctx.quadraticCurveTo(-0.4, -0.5, rx * 0.65, -ry * 0.72);
    ctx.closePath();
    ctx.fill();
    // Silver temple wing & crown sheen
    ctx.fillStyle = pal.hairHi;
    ctx.beginPath();
    ctx.moveTo(rx * 0.35, -ry * 0.88);
    ctx.quadraticCurveTo(-0.5, -ry * 1.05, -rx * 0.75, -ry * 0.45);
    ctx.lineTo(-rx * 0.5, -ry * 0.35);
    ctx.closePath();
    ctx.fill();
    // Silver monocle glint over eye!
    if (!flashing) {
      ctx.strokeStyle = '#d4e8ff';
      ctx.lineWidth = 0.42;
      ctx.beginPath();
      ctx.arc(rx * 0.52, -0.25, 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (hw === 'hair_celine') {
    // Neat chestnut bob + animated swaying ponytail
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.ellipse(-0.4, -0.9, rx * 1.05, ry * 0.78, -0.1, Math.PI * 0.78, Math.PI * 2.1);
    ctx.fill();
    const sway = clamp(hairAng * 0.09, -1.5, 1.5);
    ctx.beginPath();
    ctx.moveTo(-rx * 0.85, -0.4);
    ctx.quadraticCurveTo(-rx - 1.8, 0.8, -rx - 1.2 + sway, 3.0);
    ctx.lineTo(-rx * 0.5, 1.2);
    ctx.closePath();
    ctx.fill();
  } else if (hw === 'cap_flat' || hw === 'cap_peaked') {
    // Vault security cap (rookie flat vs junior tall peaked with gold band)
    const capH = hw === 'cap_peaked' ? 2.4 : 1.8;
    ctx.fillStyle = pal.hair;
    ctx.fillRect(-rx, -1.0, 1.4, 1.8);
    ctx.fillStyle = pal.capColor;
    ctx.beginPath();
    ctx.moveTo(-rx - 0.6, -1.0);
    ctx.lineTo(-rx - 0.2, -1.0 - capH);
    ctx.lineTo(rx + 0.6, -1.0 - capH + (hw === 'cap_peaked' ? -0.35 : 0.2));
    ctx.lineTo(rx + 0.4, -1.0);
    ctx.closePath();
    ctx.fill();
    // Visor brim extending forward
    ctx.fillStyle = pal.capVisor;
    ctx.fillRect(0.2, -1.35, rx + 1.6, 0.75);
    // Brass badge / band
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-rx, -1.55, rx * 2, 0.55);
  } else if (hw === 'beret_crest') {
    // Disciplined Alpine sentry beret with angled crown & brass crest
    ctx.fillStyle = pal.hair;
    ctx.fillRect(-rx, -0.8, 1.4, 1.7);
    ctx.fillStyle = pal.capColor;
    ctx.beginPath();
    ctx.ellipse(-0.5, -1.9, rx * 1.28, 1.45, -0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0.6, -2.2, 1.0, 1.0);
  } else if (hw === 'helmet_heavy') {
    // Heavy Brawler armored tactical helmet + brow guard + chinstrap
    ctx.fillStyle = pal.capColor;
    ctx.beginPath();
    ctx.arc(-0.15, -0.45, rx + 0.85, Math.PI * 0.82, Math.PI * 2.08);
    ctx.lineTo(rx + 1.3, -0.75);
    ctx.lineTo(-rx - 0.8, 0.4);
    ctx.closePath();
    ctx.fill();
    // Visor rim & chinstrap
    ctx.fillStyle = pal.capVisor;
    ctx.fillRect(0.3, -1.35, rx + 1.25, 0.85);
    ctx.strokeStyle = pal.capVisor;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(-0.8, 0.4);
    ctx.lineTo(0.4, ry - 0.2);
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-1.4, -ry - 0.45, 2.8, 0.55);
  } else if (hw === 'visor_sleek') {
    // Duellist sleek aerodynamic fencing/tactical visor helmet
    ctx.fillStyle = pal.capColor;
    ctx.beginPath();
    ctx.ellipse(-0.35, -0.65, rx + 0.75, ry * 0.92, -0.1, Math.PI * 0.72, Math.PI * 2.12);
    ctx.closePath();
    ctx.fill();
    // Dark tactical visor slit across eyes
    ctx.fillStyle = '#0e1621';
    ctx.fillRect(0.1, -1.15, rx + 0.65, 1.1);
    ctx.fillStyle = pal.hilt || '#52b0e0';
    ctx.fillRect(0.6, -0.95, rx - 0.1, 0.45);
    // Crimson fencing crest stripe
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-1.6, -ry - 0.35, 3.0, 0.6);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main Character Renderer (Exported to render.js)
// ---------------------------------------------------------------------------

export function drawCharacter(ctx, ent, time, debugOut = null) {
  const pal = resolveProfile(ent);
  const vis = getEntityVis(ent, time);

  // Visual delta time for pose blending & spring-damped secondary motion
  let dt = time - vis.lastTime;
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.2) dt = 0;
  vis.lastTime = time;

  const clip = ent.anim || 'idle';

  // Detect state transitions for smooth pose cross-fade & unsheathe draw flourish!
  if (clip !== vis.lastAnim) {
    const wasCombat = vis.lastAnim.startsWith('combat_');
    const nowCombat = clip.startsWith('combat_');
    if (!wasCombat && clip === 'combat_idle' && ent.swordDrawn) {
      vis.drawTimer = 0.16;
    }
    if (vis.lastPose) {
      vis.blendFrom = vis.lastPose;
      vis.blendT = 0;
      // Snappier blend into reactive combat states, silky blend for locomotion
      vis.blendDur = (clip === 'combat_parry' || clip === 'combat_hit') ? 0.04
        : (clip === 'combat_strike' && ent.strikeIsRiposte) ? 0.04
        : (clip === 'dead' || clip === 'hang') ? 0.05
        : 0.085;
    }
    vis.lastAnim = clip;
  }

  // Trigger vivid blade clash spark on parry success or parried recoil!
  if ((ent.parrySuccess && !vis.lastParrySuccess) ||
      (clip === 'combat_parried' && ent.animT < 0.12 && vis.clashSparkT <= 0.02) ||
      (ent.pendingRiposte && clip === 'combat_parry' && ent.animT < 0.15 && vis.clashSparkT <= 0.02)) {
    vis.clashSparkT = 0.18;
  }
  vis.lastParrySuccess = !!ent.parrySuccess;
  if (vis.drawTimer > 0) vis.drawTimer = Math.max(0, vis.drawTimer - dt);
  if (vis.clashSparkT > 0) vis.clashSparkT = Math.max(0, vis.clashSparkT - dt);

  // Evaluate target pose & blend cleanly from previous clip
  const rawPose = evalPose(ent, time, vis);
  let pose = rawPose;
  if (vis.blendFrom && vis.blendT < 1) {
    vis.blendT = dt > 0 ? Math.min(1, vis.blendT + dt / vis.blendDur) : 1;
    pose = blendPose(vis.blendFrom, rawPose, easeOutCubic(vis.blendT));
    if (vis.blendT >= 1) vis.blendFrom = null;
  }
  vis.lastPose = pose;

  // Update spring-damped secondary motion (hair, scarf/coat hem, sword tip lag)
  if (dt > 0) {
    const vxVis = clamp(((ent.x - vis.lastX) / dt) * ent.facing, -160, 160);
    const vyVis = clamp((ent.y - vis.lastY) / dt, -160, 160);
    vis.lastX = ent.x;
    vis.lastY = ent.y;

    const targetHair = clamp(-vxVis * 0.22 - vyVis * 0.12 + Math.sin(time * 4.5) * 2.5, -24, 24);
    const targetHem = clamp(-vxVis * 0.28 - vyVis * 0.14 + Math.sin(time * 3.8 + 1) * 3.0, -30, 30);

    // Damped spring integration
    const stepSpring = (val, vel, target, k, damp) => {
      const acc = (target - val) * k - vel * damp;
      const nVel = vel + acc * dt;
      return [val + nVel * dt, nVel];
    };
    [vis.hairAng, vis.hairVel] = stepSpring(vis.hairAng, vis.hairVel, targetHair, 110, 14);
    [vis.hemAng, vis.hemVel] = stepSpring(vis.hemAng, vis.hemVel, targetHem, 95, 12);

    const angVel = clamp(((pose.swordAngle - vis.lastSwordAngle + 540) % 360 - 180) / dt, -900, 900);
    vis.lastSwordAngle = pose.swordAngle;
    [vis.swordLag, vis.swordLagVel] = stepSpring(vis.swordLag, vis.swordLagVel, clamp(-angVel * 0.015, -10, 10), 160, 18);
  }

  // Bone lengths scaled by archetype
  const hS = pal.heightScale || 1.0;
  const wS = pal.widthScale || 1.0;
  const L_THIGH = 7.3 * hS;
  const L_SHIN = 7.2 * hS;
  const L_TORSO = 8.6 * hS;
  const L_NECK = 1.5 * hS;
  const L_UPPER = 5.0 * hS;
  const L_FORE = 4.3 * hS;
  const ANKLE_H = 1.5 * hS;

  // Solve skeleton in local character space (+x = facing, +y = down, y = 0 = floor!)
  const pelvis = { x: pose.pelvisX * wS, y: pose.pelvisY * hS };
  const leanRad = degRad(pose.torsoLean);
  const chest = {
    x: pelvis.x + Math.sin(leanRad) * L_TORSO,
    y: pelvis.y - Math.cos(leanRad) * L_TORSO,
  };
  const neckRad = degRad(pose.torsoLean * 0.65 + pose.headTilt * 0.35);
  const neck = {
    x: chest.x + Math.sin(neckRad) * L_NECK,
    y: chest.y - Math.cos(neckRad) * L_NECK,
  };
  const headRad = degRad(pose.torsoLean * 0.35 + pose.headTilt);
  const head = {
    x: neck.x + Math.sin(headRad) * (2.15 * hS),
    y: neck.y - Math.cos(headRad) * (2.15 * hS),
  };

  // Counter-rotating hip & shoulder sockets (symmetrical L/R vertical hip heights; clean front-facing alignment!)
  const fYaw = pose.faceYaw ?? 1;
  const frontFacing = Math.abs(fYaw) < 0.35;
  const rHip = frontFacing
    ? { x: pelvis.x + 1.55 * wS, y: pelvis.y + 0.12 }
    : { x: pelvis.x + pose.hipYaw * 1.65 * wS, y: pelvis.y + 0.08 };
  const lHip = frontFacing
    ? { x: pelvis.x - 1.55 * wS, y: pelvis.y + 0.12 }
    : { x: pelvis.x - pose.hipYaw * 1.65 * wS, y: pelvis.y - 0.08 };
  const rShoulder = frontFacing
    ? { x: chest.x + 2.85 * wS, y: chest.y + 0.2 }
    : { x: chest.x + pose.shoulderYaw * 2.2 * wS, y: chest.y + 0.35 };
  const lShoulder = frontFacing
    ? { x: chest.x - 2.85 * wS, y: chest.y + 0.2 }
    : { x: chest.x - pose.shoulderYaw * 2.2 * wS, y: chest.y - 0.35 };

  // Foot targets (clamped strictly at -ANKLE_H when grounded so boots NEVER sink below the floor!)
  let lFootTarget = { x: pose.lFootX * wS, y: pose.lFootY * hS };
  let rFootTarget = { x: pose.rFootX * wS, y: pose.rFootY * hS };
  if (ent.grounded && ent.alive && pose.clampFeet) {
    if (lFootTarget.y > -ANKLE_H) lFootTarget.y = -ANKLE_H;
    if (rFootTarget.y > -ANKLE_H) rFootTarget.y = -ANKLE_H;
  }

  // Two-Bone IK for both legs:
  //   - Facing right (fYaw >= 0.35): bendDir = -1 (knees bend forward +x)
  //   - Facing left (fYaw < -0.35, e.g. turn frame 1): bendDir = +1 (knees bend forward -x, NEVER broken backwards!)
  //   - Facing camera (frontFacing, turn frame 2): clean athletic pivot knees (not bow-legged!)
  let lLegIK, rLegIK;
  if (frontFacing) {
    lLegIK = {
      mid: { x: lerp(lHip.x, lFootTarget.x, 0.5) - 0.55 * wS, y: lerp(lHip.y, lFootTarget.y, 0.5) + 0.15 * hS },
      end: lFootTarget,
    };
    rLegIK = {
      mid: { x: lerp(rHip.x, rFootTarget.x, 0.5) + 0.55 * wS, y: lerp(rHip.y, rFootTarget.y, 0.5) + 0.15 * hS },
      end: rFootTarget,
    };
  } else {
    const kneeBend = fYaw < -0.35 ? 1 : -1;
    lLegIK = solveTwoBoneIK(lHip, lFootTarget, L_THIGH, L_SHIN, kneeBend);
    rLegIK = solveTwoBoneIK(rHip, rFootTarget, L_THIGH, L_SHIN, kneeBend);
  }

  // Arms: direct FK during locomotion (when pose.fkArms is set) so elbow angles & back-swing never clamp or flip;
  // asymmetrical bent pivot arms during front-facing turn (left lower-bent at waist, right higher swinging across);
  // 2-bone IK for fencing/ledge-grabbing!
  const lHandTarget = { x: pose.lHandX * wS, y: pose.lHandY * hS };
  const rHandTarget = { x: pose.rHandX * wS, y: pose.rHandY * hS };
  let lArmIK, rArmIK;
  if (frontFacing) {
    lArmIK = {
      mid: { x: lShoulder.x - 1.45 * wS, y: lShoulder.y + 4.3 * hS },
      end: { x: lShoulder.x - 0.65 * wS, y: lShoulder.y + 6.9 * hS },
    };
    rArmIK = {
      mid: { x: rShoulder.x + 1.65 * wS, y: rShoulder.y + 3.6 * hS },
      end: { x: rShoulder.x + 0.55 * wS, y: rShoulder.y + 5.7 * hS },
    };
  } else if (pose.fkArms) {
    lArmIK = fkArmJoints(lShoulder.x, lShoulder.y, pose.fkArms.lUpper, pose.fkArms.lElbow, L_UPPER, L_FORE);
    rArmIK = fkArmJoints(rShoulder.x, rShoulder.y, pose.fkArms.rUpper, pose.fkArms.rElbow, L_UPPER, L_FORE);
  } else {
    lArmIK = solveTwoBoneIK(lShoulder, lHandTarget, L_UPPER, L_FORE, pose.lElbowBend);
    rArmIK = solveTwoBoneIK(rShoulder, rHandTarget, L_UPPER, L_FORE, pose.rElbowBend);
  }

  // -------------------------------------------------------------------------
  // Render Character
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.translate(ent.x, ent.y);

  // 1. World-space Oblique Contact Shadow (tracks exact foot stance width & softens cleanly in flight!)
  if (ent.grounded) {
    ctx.save();
    const fMin = Math.min(lLegIK.end.x, rLegIK.end.x) * ent.facing;
    const fMax = Math.max(lLegIK.end.x, rLegIK.end.x) * ent.facing;
    const sCenter = (fMin + fMax) * 0.5;
    const lowestFootY = Math.max(lLegIK.end.y, rLegIK.end.y);
    const flightLift = ent.alive ? clamp((-ANKLE_H - lowestFootY) / 3.0, 0, 1) : 0;
    const sHalfW = ent.alive ? clamp((fMax - fMin) * 0.5 + 4.4, 7.2, 16.0) * (1 - flightLift * 0.22) : 13.5;

    ctx.transform(1, 0, ISO_DX / ISO_DY, 1, sCenter + 1.2, -0.6);
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.18 * (1 - flightLift * 0.45)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, sHalfW + 1.6, 2.3 * (1 - flightLift * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.34 * (1 - flightLift * 0.50)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, sHalfW * 0.76, 1.4 * (1 - flightLift * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (ent.facing < 0) {
    ctx.scale(-1, 1);
  }

  // Deepfake holographic jitter & chromatic echo
  if (pal.glitch) {
    const jitter = Math.sin(time * 29 + ent.x) > 0.74 ? 1.3 : 0;
    ctx.translate(jitter, 0);
    ctx.globalAlpha = 0.84 + 0.12 * Math.sin(time * 15);
  }

  const flashing = ent.hurtFlash > 0 && Math.floor(ent.hurtFlash * 24) % 2 === 0;
  const jacket = flashing ? '#ffffff' : pal.jacket;
  const jacketHi = flashing ? '#ffffff' : pal.jacketHi;
  const jacketDark = flashing ? '#ffcccc' : pal.jacketDark;
  const pants = flashing ? '#ffffff' : pal.pants;
  const pantsHi = flashing ? '#ffffff' : pal.pantsHi;
  const pantsDark = flashing ? '#ffcccc' : pal.pantsDark;
  const skin = flashing ? '#ffffff' : pal.skin;
  const skinShade = flashing ? '#ffdddd' : pal.skinShade;
  const outline = 'rgba(6, 9, 14, 0.62)';

  // 2. Back Arm (lArm) — clearly darker burgundy shade behind torso (zero bright highlight) so near vs far arm separation is instant!
  const backArmCol = flashing ? '#ffcccc' : (pal.coatStyle === 'courier' ? '#5e0f13' : jacketDark);
  const backForeCol = pal.shortSleeves ? skinShade : backArmCol;
  drawLimbTaper(ctx, lShoulder.x, lShoulder.y, lArmIK.mid.x, lArmIK.mid.y, 1.50 * wS, 1.18 * wS, backArmCol, null, outline);
  drawLimbTaper(ctx, lArmIK.mid.x, lArmIK.mid.y, lArmIK.end.x, lArmIK.end.y, 1.14 * wS, 0.90 * wS, backForeCol, null, outline);
  drawHand(ctx, lArmIK.end, lArmIK.mid, skinShade, skinShade, outline);

  // 3. Back Leg (lLeg) + Boot (tighter hip cap so leg joins cleanly inside pelvis silhouette)
  const bootFlip = fYaw < -0.35;
  drawLimbTaper(ctx, lHip.x, lHip.y, lLegIK.mid.x, lLegIK.mid.y, 1.65 * wS, 1.30 * wS, pantsDark, null, outline);
  drawLimbTaper(ctx, lLegIK.mid.x, lLegIK.mid.y, lLegIK.end.x, lLegIK.end.y, 1.28 * wS, 0.94 * wS, pantsDark, null, outline);
  drawBoot(ctx, lLegIK.end, pose.lFootAngle, pose.lFootTurnOut, pal, frontFacing, outline, hS, bootFlip);

  // 4. Sheathed Scabbard at hip — consistent diagonal angle with subtle 1-frame lagging bounce follow-through!
  const showDrawnSword = pose.swordVisibleOverride !== null ? pose.swordVisibleOverride : !!ent.swordDrawn;
  if (ent.hasSword && pal.sword && ent.alive) {
    const sYaw = clamp(fYaw, -1, 1);
    const runBounceLag = clip === 'run' ? Math.sin(((ent.animT || 0) - 0.08) * Math.PI * 4) * 0.55 : 0;
    const scabLag = clamp(vis.hemAng * 0.03 + runBounceLag, -0.65, 0.65);
    const sx0 = frontFacing ? pelvis.x - 1.9 : pelvis.x - 0.8 * sYaw;
    const sy0 = pelvis.y + 0.55;
    const tipDx = frontFacing ? -1.4 : -6.2 * sYaw;
    const tipDy = frontFacing ? 5.8 : 4.5 + scabLag;
    ctx.strokeStyle = '#1b1916';
    ctx.lineWidth = showDrawnSword ? 0.95 : 1.25;
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx0 + tipDx, sy0 + tipDy);
    ctx.stroke();
    if (!frontFacing) {
      ctx.strokeStyle = pal.hilt;
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx0 + tipDx * 0.20, sy0 + tipDy * 0.20);
      ctx.stroke();
      if (!showDrawnSword) {
        ctx.strokeStyle = pal.hilt;
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(sx0, sy0);
        ctx.lineTo(sx0 - tipDx * 0.22, sy0 - tipDy * 0.22);
        ctx.stroke();
      }
    }
  }

  // 5. Tailored Torso, Costume, Belt & Secondary-Motion Coat-Tail
  const torsoBounds = drawTorsoAndCostume(ctx, pelvis, chest, lHip, rHip, lShoulder, rShoulder, pal, flashing, outline, vis.hemAng, wS, hS, fYaw, pose.shoulderYaw);

  // Record exact rendered joints when requested (used by ?bones=1 overlay & arm-check reports!)
  if (debugOut) {
    const angFromDown = (a, b) => (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
    const wrapDiff = (d) => ((d + 540) % 360) - 180;
    const rUpperDeg = angFromDown(rShoulder, rArmIK.mid);
    const lUpperDeg = angFromDown(lShoulder, lArmIK.mid);
    const rForeDeg = angFromDown(rArmIK.mid, rArmIK.end);
    const lForeDeg = angFromDown(lArmIK.mid, lArmIK.end);
    const rThighDeg = angFromDown(rHip, rLegIK.mid);
    const lThighDeg = angFromDown(lHip, lLegIK.mid);
    const rShinDeg = angFromDown(rLegIK.mid, rLegIK.end);
    const lShinDeg = angFromDown(lLegIK.mid, lLegIK.end);
    // Compute exact rendered toe-tip points (matching drawBoot local toe (3.55, 1.35)) & shin-to-foot interior angles!
    const computeToe = (ankle, footAngleDeg, turnOut, flipX) => {
      if (turnOut > 0.55) {
        return { x: ankle.x + 0.4, y: ankle.y + 1.5 * hS };
      }
      const rad = degRad(footAngleDeg);
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const lx = 3.55;
      const ly = 1.35 * hS;
      if (flipX) {
        return { x: ankle.x - (lx * c + ly * s), y: ankle.y + (-lx * s + ly * c) };
      }
      return { x: ankle.x + (lx * c - ly * s), y: ankle.y + (lx * s + ly * c) };
    };
    const rToe = computeToe(rLegIK.end, pose.rFootAngle, pose.rFootTurnOut, bootFlip);
    const lToe = computeToe(lLegIK.end, pose.lFootAngle, pose.lFootTurnOut, bootFlip);
    // Anatomical shin-to-foot interior angle: 90° = perpendicular, 115-130° = relaxed plantar-flexed
    const norm360 = (a) => ((a % 360) + 360) % 360;
    const rAnkleIntDeg = norm360(pose.rFootAngle + 90 + rShinDeg);
    const lAnkleIntDeg = norm360(pose.lFootAngle + 90 + lShinDeg);
    Object.assign(debugOut, {
      upperArmLen: L_UPPER,
      foreArmLen: L_FORE,
      pelvis: { ...pelvis },
      chest: { ...chest },
      rShoulder: { ...rShoulder },
      rElbow: { ...rArmIK.mid },
      rHand: { ...rArmIK.end },
      lShoulder: { ...lShoulder },
      lElbow: { ...lArmIK.mid },
      lHand: { ...lArmIK.end },
      rHip: { ...rHip },
      rKnee: { ...rLegIK.mid },
      rAnkle: { ...rLegIK.end },
      rToe,
      lHip: { ...lHip },
      lKnee: { ...lLegIK.mid },
      lAnkle: { ...lLegIK.end },
      lToe,
      torsoBackX: torsoBounds.torsoBackX,
      torsoFrontX: torsoBounds.torsoFrontX,
      chestBackX: torsoBounds.chestBackX,
      chestFrontX: torsoBounds.chestFrontX,
      hipBackX: torsoBounds.hipBackX,
      hipFrontX: torsoBounds.hipFrontX,
      rUpperDeg,
      lUpperDeg,
      rElbowFlex: wrapDiff(rForeDeg - rUpperDeg),
      lElbowFlex: wrapDiff(lForeDeg - lUpperDeg),
      rThighDeg,
      lThighDeg,
      rKneeFlex: wrapDiff(rThighDeg - rShinDeg),
      lKneeFlex: wrapDiff(lThighDeg - lShinDeg),
      rAnkleIntDeg,
      lAnkleIntDeg,
      rFootLowestY: rLegIK.end.y + bootLowestOffsetY(pose.rFootAngle, hS),
      lFootLowestY: lLegIK.end.y + bootLowestOffsetY(pose.lFootAngle, hS),
      torsoLean: pose.torsoLean,
    });
  }

  // 6. Neck, Head, Face Direction (with 3/4 & front-facing turn yaw) & Archetype Headwear
  const headDeg = pose.torsoLean * 0.3 + pose.headTilt;
  drawHeadAndHair(ctx, neck, head, headDeg, pal, flashing, outline, vis.hairAng, wS, hS, fYaw);

  // 7. Front Leg (rLeg) + Boot (tighter hip cap on front-facing turn so near hip never pops as a disc!)
  const nearHipR = (frontFacing ? 1.48 : 1.68) * wS;
  drawLimbTaper(ctx, rHip.x, rHip.y, rLegIK.mid.x, rLegIK.mid.y, nearHipR, 1.34 * wS, pants, pantsHi, outline);
  drawLimbTaper(ctx, rLegIK.mid.x, rLegIK.mid.y, rLegIK.end.x, rLegIK.end.y, 1.32 * wS, 0.98 * wS, pants, pantsHi, outline);
  drawBoot(ctx, rLegIK.end, pose.rFootAngle, pose.rFootTurnOut, pal, true, outline, hS, bootFlip);

  // 8. Drawn Sword (anchored strictly inside rArmIK.end — never detached from hand!)
  if (showDrawnSword && pal.sword) {
    drawSwordWeapon(ctx, rArmIK.end, pose.swordAngle, pal, ent, pose, vis, time);
  }

  // 9. Held Elixir Flask during drink animation!
  if (pose.heldFlask) {
    const isPoison = pose.heldFlask === 'poison';
    const isLarge = pose.heldFlask === 'large_elixir';
    ctx.save();
    ctx.translate(rArmIK.end.x + 0.8, rArmIK.end.y - 1.0);
    ctx.rotate(-0.65);
    ctx.fillStyle = isPoison ? '#3a86e8' : '#e02f3f';
    ctx.beginPath();
    ctx.ellipse(0, 0, isLarge ? 2.1 : 1.6, isLarge ? 2.4 : 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0ecf5';
    ctx.fillRect(-0.6, -3.2, 1.2, 1.4);
    ctx.restore();
  }

  // 10. Front Arm (rArm) + Hand drawn cleanly OVER sword grip & torso with crisp outline contrast!
  const frontForeCol = pal.shortSleeves ? skin : jacket;
  const frontForeHi = pal.shortSleeves ? null : jacketHi;
  const nearArmOutline = 'rgba(8, 6, 10, 0.84)';
  drawLimbTaper(ctx, rShoulder.x, rShoulder.y, rArmIK.mid.x, rArmIK.mid.y, 1.55 * wS, 1.2 * wS, jacket, jacketHi, nearArmOutline);
  drawLimbTaper(ctx, rArmIK.mid.x, rArmIK.mid.y, rArmIK.end.x, rArmIK.end.y, 1.15 * wS, 0.9 * wS, frontForeCol, frontForeHi, nearArmOutline);
  // Crisp shirt cuff at wrist (for long-sleeved characters)
  if (!flashing && !pal.shortSleeves) {
    const cuAng = Math.atan2(rArmIK.end.y - rArmIK.mid.y, rArmIK.end.x - rArmIK.mid.x);
    ctx.fillStyle = pal.coatStyle === 'suit_tails' ? '#f4f2ec' : pal.jacketHi;
    ctx.beginPath();
    ctx.arc(rArmIK.end.x - Math.cos(cuAng) * 0.9, rArmIK.end.y - Math.sin(cuAng) * 0.9, 0.95 * wS, 0, Math.PI * 2);
    ctx.fill();
  }
  drawHand(ctx, rArmIK.end, rArmIK.mid, skin, skinShade, outline);

  // 11. Celine's glowing Auditor Smartcard tablet
  if (ent.palette === 'celine') {
    ctx.fillStyle = '#1b2d40';
    ctx.fillRect(rArmIK.end.x - 0.8, rArmIK.end.y - 3.6, 4.4, 5.4);
    ctx.fillStyle = '#5ee8ff';
    ctx.fillRect(rArmIK.end.x - 0.3, rArmIK.end.y - 3.0, 3.4, 4.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rArmIK.end.x + 0.2, rArmIK.end.y - 2.3, 2.2, 0.8);
    ctx.fillRect(rArmIK.end.x + 0.2, rArmIK.end.y - 1.0, 1.6, 0.6);
  }

  // 12. Deepfake holographic scanlines & chromatic glitch tears
  if (pal.glitch) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const scanY = -28 + ((time * 36) % 28);
    ctx.fillStyle = 'rgba(120, 240, 255, 0.42)';
    ctx.fillRect(-7, scanY, 14, 0.8);
    if (Math.sin(time * 23) > 0.68) {
      ctx.fillStyle = 'rgba(214, 120, 255, 0.38)';
      ctx.fillRect(-8, -18 + Math.sin(time * 41) * 8, 16, 1.2);
    }
    ctx.restore();
  }

  ctx.restore();
}


// Read-only kinematics sampler backed by the EXACT drawCharacter rendering path (no-op canvas ctx)
const NOOP_CTX = {
  save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, transform() {},
  beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
  quadraticCurveTo() {}, fill() {}, stroke() {}, fillRect() {},
  createLinearGradient() { return { addColorStop() {} }; },
};

export function sampleRunKinematics(u) {
  const ent = {
    x: 0, y: 0, vx: 104, vy: 0, facing: 1, palette: 'hero',
    grounded: true, alive: true, hasSword: true, swordDrawn: false,
    hurtFlash: 0, anim: 'run', animT: u, state: 'run',
  };
  const debug = {};
  drawCharacter(NOOP_CTX, ent, 2.0 + u * 0.42, debug);
  return { u, ...debug };
}
