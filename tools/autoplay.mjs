// Autopilot: plans routes with BFS over the same coarse model as validate.mjs and executes them
// through the real game loop (macros: run, careful step, running jump, drop, climb). Fights with a parry-riposte bot.
// Usage: node tools/autoplay.mjs [level 1-5 | all] [--god]
import { make, defs } from './sim.mjs';
import { COLS, ROWS, TW, supportsCh, ceilingCh, slicerOpen } from '../src/level.js';

const WAY = [
  [['b2', 6, 2], ['a3', 4, 3], ['a1', 7, 3, 'pick'], ['a1', 2, 2]],
  [['b3', 3, 3], ['a3', 8, 3], ['a2', 8, 2, 'pick']],
  [['a4', 5, 3], ['a2', 5, 3]],
  [['b3', 3, 3], ['a5', 2, 3], ['a2', 8, 2, 'pick']],
  [['b2', 7, 3], ['c1', 6, 1, 'pick'], ['c3', 3, 3]],
];
const args = process.argv.slice(2);
const god = args.includes('--god');
const which = args.find((a) => /^\d|all/.test(a)) || 'all';

function run(li) {
  const s = make(li, god); const g = s.g; let frames = 0;
  const H = () => g.hero;
  const L = () => g.level;
  const norm = (room, c, r) => { const lv = L(); let R = lv.rooms[room]; if (c < 0) { if (!R.l) return null; room = R.l; c += COLS; } else if (c >= COLS) { if (!R.r) return null; room = R.r; c -= COLS; } R = lv.rooms[room]; if (r < 0) { if (!R.u) return null; room = R.u; r += ROWS; } else if (r >= ROWS) { if (!R.d) return null; room = R.d; r -= ROWS; } return [room, c, r]; };
  const T = (room, c, r) => L().tile(room, c, r);
  const key = (n) => n.join(':');
  function plan(from, to) {
    const prev = new Map([[key(from), null]]); const q = [from];
    const add = (cur, n, e) => { if (n && !prev.has(key(n))) { prev.set(key(n), { from: cur, e, n }); q.push(n); } };
    while (q.length) {
      const cur = q.shift(); const [room, c, r] = cur;
      if (key(cur) === key(to)) break;
      for (const d of [-1, 1]) {
        const a = T(room, c + d, r); if (a === '#') continue;
        if (supportsCh(a)) add(cur, norm(room, c + d, r), { t: 'walk', d });
        else {
          for (let gp = 1; gp <= 2; gp++) { const m = T(room, c + d * gp, r); if (supportsCh(m) || m === '#') break; if (supportsCh(T(room, c + d * (gp + 1), r))) add(cur, norm(room, c + d * (gp + 1), r), { t: 'jump', d, g: gp }); }
          const n0 = norm(room, c + d, r);
          if (n0) for (let k = 1; k <= 3; k++) { const t = T(n0[0], n0[1], n0[2] + k); if (t === '~' || t === 'v') break; if (supportsCh(t)) { if (k <= 2) add(cur, norm(n0[0], n0[1], n0[2] + k), { t: 'drop', d }); break; } }
        }
        if (!ceilingCh(T(room, c, r - 1)) && supportsCh(T(room, c + d, r - 1)) && T(room, c + d, r - 1) !== '#') add(cur, norm(room, c + d, r - 1), { t: 'climb', d });
      }
    }
    if (!prev.has(key(to))) return null;
    const path = []; let k = key(to); while (prev.get(k)) { const p = prev.get(k); path.unshift(p); k = key(p.from); } return path;
  }
  const tick = () => { fightBot(); s.tick(1); frames++; if (process.env.TR && frames > +process.env.TR && frames < +process.env.TR + 400 && frames % 10 === 0) console.log('     tr', frames, s.pos()); if (frames > 60 * 3300) throw new Error('timeout'); };
  function fightBot() {
    const h = H(), lv = L();
    const foes = g.actors.filter((a) => a !== h && !a.dead && a.room === h.room && (a.kind === 'guard' || a.kind === 'deepfake') && Math.abs(a.y - h.y) < 24 && Math.abs(a.x - h.x) < 230);
    if (!foes.length || h.dead) return false;
    const f = foes.sort((p, q) => Math.abs(p.x - h.x) - Math.abs(q.x - h.x))[0];
    if (!(h.st === 'fready' || h.st === 'sheathe' || h.st === 'draw' || h.st === 'fparry' || h.armed)) return false;
    const d = Math.abs(f.x - h.x);
    const c0 = Math.floor(Math.min(f.x, h.x) / TW), c1 = Math.floor(Math.max(f.x, h.x) / TW); let hole = false; for (let c = c0; c <= c1; c++) if (!supportsCh(lv.tile(h.room, c, h.rw))) hole = true;
    if (f.kind !== 'deepfake' && (d > 100 || hole)) { if (h.armed && h.st === 'fready') { s.set('down'); return true; } return false; }
    if (f.kind === 'deepfake') { if (h.armed) s.set('down'); else s.set(f.x > h.x ? 'right' : 'left'); return true; }
    // Immediate riposte after a successful parry
    if (h.st === 'fparry') {
      if (h.parried && h.t >= 3) { s.set('shift'); return true; }
      s.set(''); return true;
    }
    if (h.st === 'fready') {
      if (f.st === 'fstrike' && f.t <= 5 && d <= 40) s.set('up');
      else if (f.st === 'frecoil' && d <= 36) s.set('shift');
      else if (h.riposte > 0 && d <= 36) s.set('shift');
      else if (d > 32) s.set(f.x > h.x ? 'right' : 'left');
      else if (f.st !== 'fparry' && Math.random() < 0.06) s.set('shift');
      else s.set('');
    } else s.set('');
    return true;
  }
  const busy = () => { const h = H(); return g.actors.some((a) => a !== h && !a.dead && a.room === h.room && (a.kind === 'guard' || a.kind === 'deepfake') && Math.abs(a.y - h.y) < 24 && (h.armed || h.st === 'draw' || h.st === 'fready' || h.st === 'fparry')); };
  function hazardBetween(room, r, c0, c1, ch) {
    const a = Math.max(0, Math.min(c0, c1)), b = Math.min(COLS - 1, Math.max(c0, c1));
    for (let c = a; c <= b; c++) if (T(room, c, r) === ch) return c;
    return -1;
  }
  function goX(x, tol = 3, precise = false) {
    for (let i = 0; i < 900; i++) {
      const h = H(), lv = L();
      if (h.dead) return false;
      if (busy()) { tick(); continue; }
      if (h.st === 'fall' || h.st === 'land' || h.st === 'climb' || h.st === 'hang' || h.st === 'jump' || h.st === 'dying') { s.set(''); tick(); continue; }
      const dx = x - h.x; if (Math.abs(dx) <= tol) { s.set(''); for (let k = 0; k < 20 && H().st !== 'idle'; k++) tick(); return true; }
      const dir = Math.sign(dx), cNow = h.col(), cGoal = Math.floor(x / TW);
      // Wait before entering a closing beam shutter
      const nextC = Math.max(0, Math.min(COLS - 1, Math.floor((h.x + dir * 18) / TW)));
      if (T(h.room, nextC, h.rw) === 'S' && nextC !== cNow) {
        const p = (lv.t + nextC * 37) % 110;
        if (p >= 22 && p <= 78) { s.set(''); tick(); continue; }
      }
      // Careful-step across spikes or near spikes
      const spikes = hazardBetween(h.room, h.rw, cNow - 1, cGoal, '^') >= 0 || T(h.room, cNow, h.rw) === '^' || T(h.room, cNow + dir, h.rw) === '^';
      const slicer = hazardBetween(h.room, h.rw, cNow, cGoal, 'S') >= 0;
      const runOk = !precise && !spikes && (Math.abs(dx) > 50 || slicer);
      s.set(runOk ? (dir > 0 ? 'right' : 'left') : (dir > 0 ? 'right shift' : 'left shift')); tick();
    }
    return false;
  }
  const face = (d) => { if (H().face !== d) { s.set(d > 0 ? 'right' : 'left'); s.tick(2); s.set(''); for (let k = 0; k < 20 && H().st !== 'idle'; k++) tick(); } };
  function exec(e, cur) {
    const [room, c, r] = cur;
    const edge = e.d > 0 ? (c + 1) * TW : c * TW;
    if (e.t === 'walk' && (c + e.d < 0 || c + e.d >= COLS)) {
      const rm = H().room;
      const spikes = T(rm, c, r) === '^' || T(rm, c + e.d, r) === '^';
      s.set((e.d > 0 ? 'right' : 'left') + (spikes ? ' shift' : ''));
      for (let i = 0; i < 300 && H().room === rm && !H().dead; i++) tick();
      for (let i = 0; i < 6 && !H().dead; i++) tick();
      s.set(''); for (let k = 0; k < 25 && H().st !== 'idle'; k++) tick();
    } else if (e.t === 'walk') {
      const tx = e.d > 0 ? edge + 16 : edge - 16;
      if (!goX(Math.max(2, Math.min(381, tx)), 6)) return false;
    } else if (e.t === 'drop') {
      s.set(e.d > 0 ? 'right' : 'left'); const r0 = H().rw, rm = H().room;
      for (let i = 0; i < 400 && !(H().st === 'idle' && (H().rw !== r0 || H().room !== rm)) && !H().dead; i++) {
        if (H().st === 'fall' || H().rw !== r0 || H().room !== rm) s.set('');
        if (H().st === 'idle' && i > 40) break; tick();
      }
      s.set(''); for (let k = 0; k < 30; k++) tick();
    } else if (e.t === 'jump') {
      const approach = edge - e.d * (e.g === 1 ? 2 : 6);
      if (!goX(approach, 4, true)) return false; face(e.d);
      if (e.g === 1) { s.set((e.d > 0 ? 'right' : 'left') + ' up'); s.tick(3); s.set(''); for (let k = 0; k < 60; k++) tick(); }
      else {
        const back = Math.max(6, Math.min(378, edge - e.d * 36)); goX(back, 6); face(e.d);
        s.set(e.d > 0 ? 'right' : 'left'); for (let i = 0; i < 80 && Math.abs(H().x - (edge - e.d * 8)) > 6 && (H().x - (edge - e.d * 8)) * e.d < 0; i++) tick();
        s.set((e.d > 0 ? 'right' : 'left') + ' up'); s.tick(3); s.set(e.d > 0 ? 'right' : 'left'); for (let k = 0; k < 40; k++) tick(); s.set(''); for (let k = 0; k < 40 && H().st !== 'idle'; k++) tick();
      }
    } else if (e.t === 'climb') {
      if (!goX(edge - e.d * 12, 4, true)) return false; face(e.d);
      s.set('up'); for (let k = 0; k < 4; k++) tick(); s.set(''); for (let k = 0; k < 70 && H().st !== 'idle'; k++) tick();
    }
    return true;
  }
  function goTo(target, label) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const h = H();
      if (h.dead) { for (let k = 0; k < 300 && g.hero.dead; k++) tick(); continue; }
      const cur = [h.room, h.col(), h.rw];
      if (!supportsCh(T(...cur))) { s.set(''); for (let k = 0; k < 20; k++) tick(); continue; }
      if (key(cur) === key(target)) { s.set(''); for (let k = 0; k < 30; k++) tick(); return true; }
      const path = plan(cur, target); if (!path) { console.log(`  no path from ${key(cur)} to ${label}`); return false; }
      const p0 = path[0]; if (process.env.DBG) console.log('   ', attempt, s.pos(), JSON.stringify(p0.e), key(p0.from));
      let k = 0;
      while (p0.e.t === 'walk' && path[k + 1] && path[k + 1].e.t === 'walk' && path[k + 1].e.d === p0.e.d && path[k + 1].n[0] === p0.from[0] && path[k].n[0] === p0.from[0]) k++;
      if (p0.e.t === 'walk' && k > 0 && path[k].n[0] === p0.from[0]) goX(path[k].n[1] * TW + 16, 6); else exec(p0.e, p0.from);
      if (H().dead) { for (let j = 0; j < 300 && g.hero.dead; j++) tick(); }
    }
    return false;
  }
  const def = defs[li]; const wp = WAY[li].slice();
  wp.push([L().door.room, L().door.c, L().door.r]);
  console.log(`Level ${li + 1} ${def.name}${god ? ' (god)' : ''}`);
  for (const t of wp) {
    const ok = goTo(t.slice(0, 3), key(t));
    console.log(`  waypoint ${key(t)}: ${ok ? 'ok' : 'FAILED'} @frame ${frames}  hp=${H().hp}/${H().maxhp}`);
    if (ok && t[3] === 'pick') { s.set('shift'); for (let k = 0; k < 40; k++) tick(); s.set(''); console.log('  picked up item, sword=' + H().hasSword + ' hp=' + H().hp + '/' + H().maxhp); }
    if (!ok) return false;
    if (g.mode !== 'play') break;
  }
  const d = L().door; goX(d.c * TW + 16, 4, true);
  for (let i = 0; i < 400 && L().doorOpen < 0.95; i++) tick();
  s.set('up'); for (let i = 0; i < 120 && g.mode === 'play'; i++) tick(); s.set('');
  const done = g.mode === 'cards';
  console.log(`  ${done ? 'COMPLETED' : 'NOT COMPLETED'} in ${(frames / 60).toFixed(0)}s of game time; hero hp ${H().hp}/${H().maxhp}; mode=${g.mode}`);
  return done;
}
let okAll = true;
for (let i = 0; i < 5; i++) { if (which !== 'all' && +which !== i + 1) continue; try { okAll = run(i) && okAll; } catch (e) { console.log("  ERROR", e.stack); okAll = false; } }
process.exit(okAll ? 0 : 1);
