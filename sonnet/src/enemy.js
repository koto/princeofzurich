// Guards, the Deepfake and Dr. Zins: Actors driven by a small AI that produces virtual key input.
import { Actor } from './player.js';
import { TW, supportsCh, isGateCh } from './level.js';

export const SKILLS = {
  g1: { hp: 2, parry: 0.22, strike: 0.30, react: 22, retreat: 0.04 },
  g2: { hp: 3, parry: 0.35, strike: 0.40, react: 18, retreat: 0.05 },
  g3: { hp: 3, parry: 0.45, strike: 0.48, react: 15, retreat: 0.06 },
  g4: { hp: 4, parry: 0.54, strike: 0.52, react: 13, retreat: 0.08 },
  zins: { hp: 5, parry: 0.62, strike: 0.62, react: 10, retreat: 0.10 },
  deepfake: { hp: 99, parry: 1, strike: 0, react: 20, retreat: 0 },
};

export function makeGuard(game, spec, room) {
  const type = spec.type || 'g1';
  const a = new Actor(game, type === 'deepfake' ? 'deepfake' : 'guard', room, spec.c, spec.r, spec.face || -1);
  a.skill = SKILLS[type] || SKILLS.g1;
  a.boss = type === 'zins';
  a.gtype = type;
  a.hp = a.maxhp = spec.hp || a.skill.hp;
  a.armed = true; a.st = 'fready';
  a.ai = { cd: 30, alert: 0, reacted: false };
  return a;
}

export function floorBetween(a, h, level) {
  if (a.room !== h.room || Math.abs(a.y - h.y) > 24) return false;
  const c0 = Math.floor(Math.min(a.x, h.x) / TW), c1 = Math.floor(Math.max(a.x, h.x) / TW);
  for (let c = c0; c <= c1; c++) { const ch = level.tile(a.room, c, a.rw); if (!supportsCh(ch) || level.blocks(ch)) return false; }
  return true;
}

export function canSee(a, h, level) {
  if (a.room !== h.room || Math.abs(a.y - h.y) > 24 || h.dead) return false;
  if (h.st === 'hang' || h.st === 'climb' || h.st === 'climbdown') return false;
  if (Math.abs(a.x - h.x) > 150) return false;
  const c0 = Math.floor(Math.min(a.x, h.x) / TW), c1 = Math.floor(Math.max(a.x, h.x) / TW);
  for (let c = c0; c <= c1; c++) { const ch = level.tile(a.room, c, a.rw); if (ch === '#' || (isGateCh(ch) && level.blocks(ch))) return false; }
  return true;
}

function safeAhead(a, s, level) {
  const nx = a.x + s * 12, c = Math.floor(nx / TW), ch = level.tile(a.room, c, a.rw);
  return supportsCh(ch) && ch !== '^' && ch !== 'S' && !level.blocks(ch);
}

export function guardInput(a, hero, level) {
  const inp = { l: false, r: false, u: false, d: false, s: false };
  if (a.dead || hero.dead || a.ghost) return inp;
  const sk = a.skill, ai = a.ai;
  const sees = canSee(a, hero, level);
  if (sees) ai.alert = 300; else if (ai.alert > 0) ai.alert--;
  if (ai.alert <= 0) return inp;
  const dx = hero.x - a.x, dist = Math.abs(dx), tw = Math.sign(dx) || a.face;
  // Boss riposte: Dr. Zins counters cleanly after parrying a strike
  if (a.boss && a.st === 'fparry' && a.parried && a.t >= 4 && dist <= 36) {
    if (!ai.riposteTry) { ai.riposteTry = true; if (Math.random() < 0.65) { inp.s = true; return inp; } }
    return inp;
  }
  if (a.st !== 'fparry') ai.riposteTry = false;
  if (a.st !== 'fready') return inp;
  if (sees) a.face = tw;
  const key = tw > 0 ? 'r' : 'l', back = tw > 0 ? 'l' : 'r';
  if (a.kind === 'deepfake') {
    if (hero.st === 'fstrike' && hero.t >= 1 && hero.t <= 5 && dist <= 34) inp.u = true;
    else if (dist > 28 && sees && ai.cd-- <= 0 && safeAhead(a, tw, level)) { inp[key] = true; ai.cd = 4; }
    return inp;
  }
  if (hero.st === 'fstrike' && hero.t >= 1 && hero.t <= 5 && dist <= 36) {
    if (!ai.reacted) { ai.reacted = true; if (Math.random() < sk.parry) { inp.u = true; return inp; } }
  }
  if (hero.st !== 'fstrike') ai.reacted = false;
  if (--ai.cd > 0) return inp;
  ai.cd = Math.round(sk.react * (0.6 + 0.8 * Math.random()));
  if (!sees) return inp;
  if (dist > 34) { if (safeAhead(a, tw, level)) inp[key] = true; ai.cd = Math.min(ai.cd, a.boss ? 5 : 6); }
  else {
    const r = Math.random(), hunt = !hero.armed ? 0.9 : (a.riposte > 0 ? 0.85 : sk.strike);
    if (a.boss && !ai.feint && dist >= 26 && dist <= 34 && r > 0.82 && safeAhead(a, -tw, level)) {
      ai.feint = true; ai.cd = 6; inp[back] = true;
    } else if (r < hunt) { ai.feint = false; inp.s = true; }
    else if (r < hunt + sk.retreat && dist < 30 && safeAhead(a, -tw, level)) inp[back] = true;
    else if (r < hunt + sk.retreat + 0.1 && dist > 28 && safeAhead(a, tw, level)) inp[key] = true;
  }
  return inp;
}
