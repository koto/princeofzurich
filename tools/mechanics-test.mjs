// Targeted mechanics checks run against the real update loop.
import { make } from './sim.mjs';
import { fy } from '../src/level.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
function at(level, room, c, r, face = 1) { const s = make(level); const h = s.g.hero; h.room = room; h.x = c * 32 + 16; h.y = fy(r); h.rw = r; h.face = face; h.go('idle'); s.idle(2); return s; }

{ // spikes: running kills, careful step survives (L2 b1 spikes cols 3,4)
  let s = at(1, 'b1', 1, 3); s.until('right', (h) => h.dead || h.x > 200, 300); ok(s.g.hero.dead && s.g.hero.cause === 'spikes', 'running into spikes is lethal');
  s = at(1, 'b1', 1, 3); s.until('right shift', (h) => h.dead || h.x > 200, 900); s.idle(20); ok(!s.g.hero.dead && s.g.hero.x > 200, 'careful step crosses spikes safely');
}
{ // careful step never walks off an edge: L1 b1 gap at col 5 (x 160..192)
  const s = at(0, 'b1', 3, 3); s.until('right shift', () => false, 0); s.set('right shift'); s.tick(300);
  const h = s.g.hero; ok(!h.dead && h.y === fy(3) && h.x < 192 && h.x > 150, 'careful step stops at the lip (x=' + h.x.toFixed(1) + ')');
}
{ // explicit floor-count checks using L5 a2/b2-like columns: use L1 b3 col 8, r1 floor above r3
  let s = at(0, 'b3', 8, 2); s.g.hero.startFall(0, 0); s.g.hero.go('fall', { vx: 0, vy: 0.4, fallDist: 0 }); // from row 2 down: nothing between? row3 floor -> 1 floor
  s.tick(80); ok(s.g.hero.hp === 3 && !s.g.hero.dead, '1 floor fall is safe');
  s = at(0, 'b3', 2, 1); s.g.hero.go('fall', { vx: 0, vy: 0.4, fallDist: 0 }); s.tick(120); ok(s.g.hero.hp === 2 && !s.g.hero.dead, '2 floor fall costs 1 health (hp=' + s.g.hero.hp + ')');
  s = at(0, 'b3', 2, 0); s.g.hero.go('fall', { vx: 0, vy: 0.4, fallDist: 0 }); s.tick(150); ok(s.g.hero.dead && s.g.hero.cause === 'fall', '3 floor fall is lethal');
}
{ // ledge grab while falling with shift held
  const s = at(0, 'b2', 5, 3); const h = s.g.hero; // ledge (6,2) plate platform; drop from row 1 next to it
  h.y = fy(1); h.rw = 1; h.x = 6 * 32 - 4; h.go('fall', { vx: 0, vy: 0.4, fallDist: 0 }); h.face = 1;
  s.set('shift'); let grabbed = false; for (let i = 0; i < 80; i++) { s.tick(1); if (h.st === 'hang') { grabbed = true; break; } }
  ok(grabbed, 'grab ledge while falling with Shift held'); s.set('shift'); s.tick(30); ok(h.st === 'hang', 'hang while Shift held');
  s.set(''); s.tick(60); ok(h.st !== 'hang' && !h.dead, 'release Shift drops safely (st=' + h.st + ')');
}
{ // slicer lethal in window
  const s = at(2, 'b1', 3, 3); let died = false; for (let i = 0; i < 4000 && !died; i++) { s.set('right'); s.tick(1); if (s.g.hero.dead) died = true; if (s.g.hero.x > 300) { s.set(''); s.idle(5); s.g.hero.x = 80; s.g.hero.go('idle'); } }
  ok(died, 'slicer kills when run through at a bad moment');
}
{ // loose floor collapses after stepping; debris
  const s = at(0, 'b2', 7, 2); const h = s.g.hero; s.set('right shift'); s.tick(20); s.set(''); s.tick(60);
  ok(!(s.g.level.tile('b2', 7, 2) === 'L'), 'loose floor collapsed after being stepped on');
}
{ // room transitions all 4 directions
  let s = at(0, 'b1', 10, 3); s.until('right', (h) => h.room !== 'b1', 200); ok(s.g.hero.room === 'b2' && s.g.hero.x < 40, 'flip right');
  s.until('left', (h) => h.room !== 'b2', 200); ok(s.g.hero.room === 'b1' && s.g.hero.x > 340, 'flip left');
  s = at(0, 'a2', 5, 3); s.g.hero.go('fall', { vx: 0, vy: 0.4, fallDist: 0 }); s.tick(100); ok(s.g.hero.room === 'b2' && !s.g.hero.dead, 'flip down (fall into room below) -> ' + s.pos());
  s = at(0, 'b3', 11, 0); s.set('left'); s.tick(2); s.set('up shift'); s.tick(40); ok(s.g.hero.room === 'a3' && s.g.hero.rw === 3, 'flip up (climb to room above) -> ' + s.pos());
}
{ // jump distances
  let s = at(0, 'b1', 4, 3); s.g.hero.x = 140; s.set('right up'); s.tick(2); s.set(''); s.tick(60); ok(!s.g.hero.dead && s.g.hero.x > 190, 'standing jump clears a 1-tile gap (x=' + s.g.hero.x.toFixed(0) + ')');
  s = at(0, 'b1', 4, 3); s.g.hero.x = 140; s.tick(1); s.set('right'); s.tick(12); s.set('right up'); s.tick(2); s.set('right'); s.tick(40); ok(!s.g.hero.dead && s.g.hero.x > 190, 'running jump clears a gap');
}
{ // sword mode: hero without sword is killed by a guard in one hit (L1 a4 guard)
  const s = at(0, 'a4', 4, 3); s.tick(100); ok(s.g.hero.dead || s.g.hero.st !== 'idle', 'unarmed hero is attacked by guard: dead=' + s.g.hero.dead);
}
{ // maxhp and sword do NOT persist across restartLevel (no infinite HP exploit)
  const s = at(0, 'a1', 10, 3);
  s.set('shift'); s.tick(35); s.set('');
  ok(s.g.hero.maxhp === 4, 'picking up Large Elixir increases hero maxhp to 4');
  s.g.restartLevel();
  ok(s.g.hero.maxhp === 3 && !s.g.hero.hasSword, 'restartLevel resets maxhp and sword to level-start state');
}
{ // standing still inside a CERN slicer kills when it snaps shut
  const s = at(2, 'b1', 5, 3);
  s.tick(120);
  ok(s.g.hero.dead && s.g.hero.cause === 'sliced', 'standing idle inside a slicer is lethal');
}
{ // loose floor falling 1 floor with hero standing on it does NOT self-damage hero as debris
  const s = at(0, 'b2', 7, 2);
  s.tick(90);
  ok(!s.g.hero.dead && s.g.hero.hp === 3 && s.g.hero.rw === 3, 'loose floor rider takes 0 debris damage on 1-floor drop (hp=' + s.g.hero.hp + ')');
}
{ // rubble-held plate holds gate open permanently (L2 b3: L at 3,2 above plate a at 3,3)
  const s = at(1, 'b3', 3, 2);
  s.tick(80);
  // move hero off plate a to col 4
  s.g.hero.x = 4 * 32 + 16; s.g.hero.go('idle');
  s.tick(450);
  ok(s.g.level.gates['1'].open > 0.9, 'rubble resting on plate holds gate 1 permanently open');
}
{ // closing plate closes an open gate (L3 a4: plate c at 6,2 closes gate 1)
  const s = at(2, 'a4', 5, 3);
  s.tick(45);
  const openBefore = s.g.level.gates['1'].open;
  s.g.hero.x = 6 * 32 + 16; s.g.hero.y = fy(2); s.g.hero.rw = 2; s.g.hero.go('idle');
  s.tick(60);
  ok(openBefore > 0.8 && s.g.level.gates['1'].timer === 0 && s.g.level.gates['1'].open < 0.2, 'closing plate c shuts gate 1');
}
{ // Céline climax completes Level 5 when Zins is defeated
  const s = at(4, 'c3', 8, 3);
  for (const a of s.g.actors) if (a.boss) a.dead = true;
  s.hold('right', 18); s.tick(10);
  ok(s.g.mode === 'cards', 'reaching Céline after defeating Zins triggers ending cards');
}
{ // audio SFX wiring: gate, slicer, final-minute tick, pause ducking
  const events = []; const ducks = [];
  const s = at(2, 'b1', 1, 3);
  s.g.io.sfx = (n) => events.push(n);
  s.g.io.duck = (d) => ducks.push(d);
  s.g.timeLeft = 59.5;
  s.tick(120);
  s.hits.add('esc'); s.tick(1);
  ok(events.includes('slicer') && events.includes('tick') && ducks.includes(true),
    `audio wiring emits slicer=${events.includes('slicer')}, tick=${events.includes('tick')}, pauseDuck=${ducks.includes(true)}`);
}
{ // pit between hero and guard suppresses forced alertStop / auto-draw
  const s = at(1, 'b4', 5, 3); // L2 b4 has pit at cols 6,7 and guard at col 10
  s.g.hero.x = 5 * 32 + 24; s.tick(10);
  ok(!s.g.hero.alertStop && !s.g.hero.pendingDraw, 'pit suppresses forced auto-draw across chasm');
}
{ // parry-riposte: successful parry puts attacker in long recoil and allows fast riposte
  const s = at(1, 'b2', 9, 3);
  const h = s.g.hero, g = s.g.actors.find((a) => a.kind === 'guard');
  h.hasSword = true; h.armed = true; h.st = 'fready'; h.x = g.x - 28; h.face = 1; g.face = -1;
  g.go('fstrike'); h.go('fparry');
  s.tick(7);
  ok(g.st === 'frecoil' && g.longRecoil && h.parried, 'parry puts attacker in long recoil and flags riposte');
  s.set('shift'); s.tick(2); s.set('');
  ok(h.st === 'fstrike' && h.fast, 'Shift after parry cancels immediately into fast riposte');
}
console.log(fails ? fails + ' FAILED' : 'all mechanics checks passed'); process.exit(fails ? 1 : 0);
