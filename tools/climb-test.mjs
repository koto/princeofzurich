// Exhaustive climbing & ledge-grabbing tests against the real 60 FPS game loop.
// Covers all 9 failure cases from CRITIQUE.md §0, owner feedback (L1 b2), and upward routes in L1-L5.
import { make } from './sim.mjs';
import { fy, TW } from '../src/level.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function place(level, room, x, r, face = 1, clearGuards = false) {
  const s = make(level);
  const h = s.g.hero;
  if (clearGuards) s.g.actors = [h];
  h.room = room; h.x = x; h.y = fy(r); h.rw = r; h.face = face;
  h.armed = false; h.alertStop = false; h.pendingDraw = false;
  h.go('idle');
  s.idle(2);
  return s;
}

function climbUp(s, keys, holdFrames = 4, settle = 90) {
  s.hold(keys, holdFrames);
  s.idle(settle);
  return s.g.hero;
}

// --- 1. CRITIQUE §0 Case 1: L1 b2 (ledge col 6, row 2, lip x=192) with ArrowUp alone ---
{
  const s = place(0, 'b2', 180, 3, 1);
  const h = climbUp(s, 'up', 3);
  ok(h.room === 'b2' && h.rw === 2 && h.col() === 6 && h.st === 'idle',
    `L1 b2 Up alone at x=180 climbs onto (6,2) -> ${s.pos()}`);
}

// --- 2. CRITIQUE §0 Case 2: Brief chord tap Shift+Up (80ms = 5 frames) ---
{
  const s = place(0, 'b2', 180, 3, 1);
  const h = climbUp(s, 'shift up', 5);
  ok(h.room === 'b2' && h.rw === 2 && h.col() === 6 && h.st === 'idle',
    `L1 b2 brief Shift+Up tap (80ms) climbs onto (6,2) -> ${s.pos()}`);
}

// --- 3. Hold Shift + tap Up hangs, then releasing Shift slightly before Up still pulls up ---
{
  const s = place(0, 'b2', 180, 3, 1);
  const h = s.g.hero;
  s.hold('shift up', 3);
  s.hold('shift', 25);
  ok(h.st === 'hang' && h.rw === 2, `L1 b2 Shift held + Up tap hangs -> ${s.pos()}`);
  // Release Shift for 4 frames (within hangGrace), then tap Up
  s.idle(4);
  s.hold('up', 3);
  s.idle(50);
  ok(h.rw === 2 && h.st === 'idle' && h.col() === 6,
    `L1 b2 hang -> release Shift briefly -> Up pulls up -> ${s.pos()}`);
}

// --- 4. CRITIQUE §0 Cases 3-5: Wide horizontal auto-align sweep (before & under lip x=192) ---
{
  const xs = [152, 160, 168, 172, 180, 191, 192, 195, 200, 210];
  let allOk = true, bad = [];
  for (const x of xs) {
    const s = place(0, 'b2', x, 3, 1);
    const h = climbUp(s, 'up', 4, 100);
    if (!(h.room === 'b2' && h.rw === 2 && h.col() === 6 && h.st === 'idle')) {
      allOk = false; bad.push(`${x}->${s.pos()}`);
    }
  }
  ok(allOk, `L1 b2 horizontal sweep x=${xs[0]}..${xs[xs.length - 1]} all climb (Up alone)${bad.length ? ' FAILED: ' + bad.join(', ') : ''}`);
}

// --- 5. CRITIQUE §0 Case 6: Right+Up and Right+Shift+Up near ledge ---
{
  for (const keys of ['right up', 'right shift up']) {
    const s = place(0, 'b2', 180, 3, 1);
    const h = climbUp(s, keys, 4);
    ok(h.room === 'b2' && h.rw === 2 && h.col() === 6,
      `L1 b2 '${keys}' at x=180 climbs onto (6,2) -> ${s.pos()}`);
  }
}

// --- 6. CRITIQUE §0 Case 7: Run right toward ledge, release Right and press Up during skid ---
{
  const s = place(0, 'b2', 110, 3, 1);
  const h = s.g.hero;
  s.until('right', (hero) => hero.x >= 165, 60);
  s.hold('up', 4);
  s.idle(100);
  ok(h.room === 'b2' && h.rw === 2 && h.col() === 6 && h.st === 'idle',
    `L1 b2 run -> release -> Up during skid climbs onto (6,2) -> ${s.pos()}`);
}

// --- 7. CRITIQUE §0 Case 8: Short standing jump across gap catching far ledge with Shift ---
{
  // L1 b1 gap at col 5 (x=160..192); short standing jump from x=120, 125, 130 with Shift
  for (const x0 of [120, 125, 130]) {
    const s = place(0, 'b1', x0, 3, 1);
    const h = s.g.hero;
    s.hold('right up', 3);
    s.hold('shift', 65);
    const caught = !h.dead && (h.st === 'hang' || (h.col() >= 6 && h.rw === 3));
    if (h.st === 'hang') { s.hold('up', 4); s.idle(50); }
    ok(caught && !h.dead && h.col() >= 6 && h.rw === 3,
      `L1 b1 short standing jump x=${x0} catches far ledge with Shift -> ${s.pos()}`);
  }
}

// --- 8. CRITIQUE §0 Case 9: Room-up climb at b3 (11,0) from right third of tile + auto-turn ---
{
  for (const [x, face] of [[358, -1], [374, -1], [378, -1], [368, 1]]) {
    const s = place(0, 'b3', x, 0, face);
    const h = climbUp(s, 'up', 4, 100);
    ok(h.room === 'a3' && h.rw === 3 && h.col() === 10 && h.st === 'idle',
      `L1 b3 (11,0) x=${x} face=${face} climbs up to a3 (10,3) -> ${s.pos()}`);
  }
}

// --- 9. Diagonal double-room-boundary exploit blocked at L1 b3 (11,0) facing right ---
{
  const s = place(0, 'b3', 378, 0, 1);
  const h = climbUp(s, 'up', 4, 100);
  ok(h.room !== 'a4', `L1 b3 (11,0) cannot exploit-climb diagonally into a4 -> ${s.pos()}`);
}

// --- 10. Climb back up from row 3 to row 2, 1, 0 and through room-up shafts in every level ---
{
  const stairs = [
    { lvl: 0, room: 'b3', steps: [[3, 3, 1, 2], [7, 2, 1, 1], [10, 1, 1, 0]], roomUp: [11, 0, -1, 'a3', 3] },
    { lvl: 1, room: 'b2', steps: [[1, 3, 1, 2]], roomUp: null },
    { lvl: 1, room: 'b5', steps: [[1, 3, 1, 2], [5, 2, 1, 1], [7, 1, 1, 0]], roomUp: [8, 0, -1, 'a5', 3] },
    { lvl: 2, room: 'b4', steps: [[8, 3, 1, 2], [9, 2, -1, 1], [7, 1, 1, 0]], roomUp: [8, 0, -1, 'a4', 3] },
    { lvl: 2, room: 'b5', steps: [[3, 3, 1, 2], [7, 2, 1, 1], [10, 1, 1, 0]], roomUp: [11, 0, -1, 'a5', 3] },
    { lvl: 3, room: 'b6', steps: [[3, 3, 1, 2], [7, 2, 1, 1], [10, 1, 1, 0]], roomUp: [11, 0, -1, 'a6', 3] },
    { lvl: 4, room: 'a3', steps: [[2, 3, 1, 2], [5, 2, 1, 1], [8, 1, 1, 0]], roomUp: [9, 0, -1, 'b3', 3] },
    { lvl: 4, room: 'b1', steps: [[10, 3, -1, 2], [6, 2, -1, 1], [3, 1, -1, 0]], roomUp: [2, 0, 1, 'c1', 3] },
  ];
  for (const st of stairs) {
    let allSteps = true, detail = '';
    for (const [c, r, face, targetR] of st.steps) {
      const s = place(st.lvl, st.room, c * TW + 16, r, face, true);
      const h = climbUp(s, 'up', 4, 100);
      if (h.rw !== targetR || h.st !== 'idle') {
        allSteps = false; detail += ` step(${c},${r})->${s.pos()}`;
      }
    }
    if (st.roomUp) {
      const [c, r, face, targetRoom, targetR] = st.roomUp;
      const s = place(st.lvl, st.room, c * TW + 16, r, face, true);
      const h = climbUp(s, 'up', 4, 100);
      if (h.room !== targetRoom || h.rw !== targetR || h.st !== 'idle') {
        allSteps = false; detail += ` roomUp(${c},${r})->${s.pos()}`;
      }
    }
    ok(allSteps, `L${st.lvl + 1} ${st.room} upward route climbs with Up alone${detail}`);
  }
}

// --- 11. Falling past a ledge with Shift held catches it cleanly ---
{
  const s = place(0, 'b2', 180, 1, 1);
  const h = s.g.hero;
  h.startFall(0, 0);
  s.hold('shift', 45);
  ok(h.st === 'hang' && h.rw === 2, `L1 b2 falling past (6,2) catches ledge with Shift -> ${s.pos()}`);
  s.hold('up', 4);
  s.idle(50);
  ok(h.st === 'idle' && h.rw === 2 && h.col() === 6, `L1 b2 caught fall -> Up pulls up -> ${s.pos()}`);
}

console.log(fails ? `${fails} FAILED` : 'all climb checks passed');
process.exit(fails ? 1 : 0);
