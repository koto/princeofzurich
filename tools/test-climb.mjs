#!/usr/bin/env node
// tools/test-climb.mjs
// Automated climbing / ledge test. Drives the real game code with synthesized key presses.
//  Part A: focused scenarios in purpose-built test rooms (standstill, facing away, under the
//          overhang, against the step wall, straight after a run, buffered presses, tap-to-climb,
//          Shift-hang, falling catches, jump catches, cross-room climbs, climb down & back).
//  Part B: every upward route in every real level: stand in (or beside) each open column under
//          a climbable ledge, press Up once, and require the hero to end up standing on the ledge.
// Exit code 1 on any failure.

import { Sim, Report } from './sim.mjs';
import { LEVELS } from '../src/levels/index.js';
import { COLS, ROWS, TILE_W, floorY, tileCenterX, colOfX, LevelState } from '../src/level.js';

const R = new Report('test-climb');

function room(grid, links = {}, extra = {}) {
  return { links: { left: null, right: null, up: null, down: null, ...links }, grid, ...extra };
}

function testLevel(rooms, start = { room: 0, col: 1, row: 2, facing: 1, hasSword: false }) {
  return { id: 0, name: 'Climb Test', subtitle: '', ice: false, start, rooms };
}

// Geometry modelled on the very first climb of the game: holes over cols 1..6, ledge from col 7,
// step wall at col 8 on the lower floor.
const STEP_ROOM = testLevel({
  0: room([
    '############',
    '#......_____',
    '#_______####',
    '############',
  ]),
});

function onUpper(s, row = 1, room = 0) {
  const p = s.p;
  return p.alive && p.grounded && p.row === row && p.roomId === room && p.state === 'idle';
}

function scenario(label, fn, def = STEP_ROOM) {
  const s = new Sim(def, { noEnemies: true });
  try {
    fn(s);
  } catch (e) {
    R.check(false, label, `threw ${e.stack}`);
  }
}

// ---------------------------------------------------------------- Part A
// 1. Standstill in the open column facing the ledge
scenario('A1 standstill facing ledge', (s) => {
  s.place(0, 6, 2, { facing: 1 });
  s.tap('up', 5);
  s.waitIdle(120);
  R.check(onUpper(s), 'A1 standstill facing ledge', JSON.stringify(s.snap()));
});

// 2. Standstill facing away from the only ledge -> auto-turn
scenario('A2 facing away', (s) => {
  s.place(0, 6, 2, { facing: -1 });
  s.tap('up', 5);
  s.waitIdle(120);
  R.check(onUpper(s), 'A2 facing away auto-turns', JSON.stringify(s.snap()));
});

// 3. Standing under the overhang (past the ledge lip) at several offsets -> auto-align
for (const off of [2, 8, 14, 20, 25]) {
  scenario(`A3 under overhang +${off}`, (s) => {
    s.place(0, 7, 2, { x: 7 * TILE_W + off, facing: 1 });
    s.tap('up', 5);
    s.waitIdle(150);
    R.check(onUpper(s), `A3 under overhang +${off}px`, JSON.stringify(s.snap()));
  });
}

// 4. Standing at far side of the open column / one column back, facing either way
for (const [x, f] of [[6 * TILE_W + 2, 1], [6 * TILE_W + 2, -1], [5 * TILE_W + 20, 1], [5 * TILE_W + 10, -1]]) {
  scenario(`A4 in/near open column x=${x} f=${f}`, (s) => {
    s.place(0, colOfX(x), 2, { x, facing: f });
    s.tap('up', 5);
    s.waitIdle(150);
    R.check(onUpper(s), `A4 open column x=${x} facing=${f}`, JSON.stringify(s.snap()));
  });
}

// 5. Run into the step wall, stop against it, press Up
scenario('A5 against step wall', (s) => {
  s.place(0, 2, 2, { facing: 1 });
  s.hold('right', 80);
  s.waitIdle(60);
  const x0 = s.p.x;
  s.tap('up', 5);
  s.waitIdle(150);
  R.check(onUpper(s), 'A5 run into step wall then Up', `start x=${x0.toFixed(1)} ${JSON.stringify(s.snap())}`);
});

// 6. Straight after a run: release Right and press Up during the skid
for (const delay of [0, 2, 6, 10]) {
  scenario(`A6 up during skid +${delay}f`, (s) => {
    s.place(0, 2, 2, { facing: 1 });
    s.press('right');
    s.stepUntil((q) => q.p.x >= 6 * TILE_W + 4, 200);
    s.release('right');
    s.step(delay);
    s.tap('up', 5);
    s.waitIdle(180);
    R.check(onUpper(s), `A6 Up ${delay} frames after releasing run`, JSON.stringify(s.snap()));
  });
}

// 7. Up pressed while still holding Right (running at the wall under the ledge)
for (const at of [4, 5, 6, 7]) {
  scenario(`A7 run+up at col ${at}`, (s) => {
    s.place(0, 1, 2, { facing: 1 });
    s.press('right');
    s.stepUntil((q) => q.p.x >= at * TILE_W + 8, 200);
    s.tap('up', 5);
    s.step(30);
    s.release('right');
    s.waitIdle(200);
    R.check(onUpper(s), `A7 Up while running (held Right) from col ${at}`, JSON.stringify(s.snap()));
  });
}

// 8. Buffered: Up pressed slightly before the run-stop / during a turn / during landing
scenario('A8 up during turn', (s) => {
  s.place(0, 6, 2, { facing: -1 });
  s.press('right');
  s.step(3);
  s.release('right');
  s.tap('up', 3);
  s.waitIdle(150);
  R.check(onUpper(s), 'A8 Up pressed during turn', JSON.stringify(s.snap()));
});
scenario('A8b up pressed while landing from a drop', (s) => {
  s.place(0, 7, 1, { x: 7 * TILE_W + 4, facing: -1 });
  s.press('left');
  s.stepUntil((q) => q.p.state === 'fall', 60);
  s.release('left');
  s.stepUntil((q) => q.p.grounded, 90);
  s.tap('up', 3);
  s.waitIdle(160);
  R.check(onUpper(s), 'A8b Up pressed on landing climbs straight back', JSON.stringify(s.snap()));
});

// 9. A quick tap (5 frames ~83ms) must climb all the way, not grab-and-drop
scenario('A9 quick tap climbs fully', (s) => {
  s.place(0, 6, 2, { facing: 1 });
  s.tap('up', 2);
  s.step(150);
  R.check(onUpper(s), 'A9 2-frame tap climbs fully', JSON.stringify(s.snap()));
});

// 10. Shift held while jumping up -> hang and keep hanging, then Up pulls up
scenario('A10 shift hang', (s) => {
  s.place(0, 6, 2, { facing: 1 });
  s.press('shift');
  s.tap('up', 4);
  s.step(200);
  const hanging = s.p.state === 'hang';
  R.check(hanging, 'A10 Shift+Up hangs (3.3s later still hanging)', JSON.stringify(s.snap()));
  s.tap('up', 4);
  s.release('shift');
  s.waitIdle(120);
  R.check(onUpper(s), 'A10 Up from hang pulls up', JSON.stringify(s.snap()));
});

// 11. Hold Up from standstill (no tap) -> climbs
scenario('A11 hold up', (s) => {
  s.place(0, 7, 2, { x: 7 * TILE_W + 10, facing: 1 });
  s.hold('up', 90);
  s.waitIdle(60);
  R.check(onUpper(s), 'A11 holding Up climbs', JSON.stringify(s.snap()));
});

// 12. Run off the upper ledge, press Shift while falling -> catch the edge
scenario('A12 fall catch', (s) => {
  s.place(0, 9, 1, { facing: -1 });
  s.press('left');
  s.stepUntil((q) => q.p.state === 'fall', 120);
  s.release('left');
  s.press('shift');
  s.step(30);
  const caught = s.p.state === 'hang' || s.p.state === 'climb_up';
  R.check(caught, 'A12 Shift while falling off ledge catches it', JSON.stringify(s.snap()));
  s.release('shift');
  s.tap('up', 4);
  s.waitIdle(120);
  R.check(onUpper(s), 'A12 climb back after fall-catch', JSON.stringify(s.snap()));
});

// 13. Climb down from the ledge (Down at edge) then Up to climb back
scenario('A13 climb down/up', (s) => {
  s.place(0, 7, 1, { x: 7 * TILE_W + 12, facing: -1 });
  s.tap('down', 4);
  s.step(30);
  R.check(s.p.state === 'hang', 'A13 Down near edge -> hang', JSON.stringify(s.snap()));
  s.tap('up', 4);
  s.waitIdle(120);
  R.check(onUpper(s), 'A13 Up from hang climbs back', JSON.stringify(s.snap()));
  s.tap('down', 4);
  s.step(20);
  s.tap('down', 4);
  s.waitIdle(120);
  R.check(s.p.alive && s.p.grounded && s.p.row === 2, 'A13 Down twice drops to floor below', JSON.stringify(s.snap()));
});

// 14. Jumps still work: Up+Right toward a pit is a jump, not a climb
const PIT_ROOM = testLevel({
  0: room([
    '############',
    '#..........#',
    '#____.__..__',
    '#___________',
  ]),
});
scenario('A14 stand jump over pit', (s) => {
  s.place(0, 4, 2, { facing: 1 });
  s.hold(['right', 'up'], 6);
  s.waitIdle(120);
  R.check(s.p.alive && s.p.row === 2 && colOfX(s.p.x) >= 6, 'A14 standing jump clears 1-tile pit', JSON.stringify(s.snap()));
}, PIT_ROOM);
const PIT2_ROOM = testLevel({
  0: room([
    '############',
    '#..........#',
    '#______..___',
    '#___________',
  ]),
});
scenario('A15 running jump over 2-tile pit', (s) => {
  s.place(0, 1, 2, { facing: 1 });
  s.press('right');
  s.stepUntil((q) => q.p.x >= 6 * TILE_W + 8, 200);
  s.tap('up', 5);
  s.stepUntil((q) => q.p.grounded && q.p.state !== 'run_jump', 120);
  s.release('right');
  s.waitIdle(120);
  R.check(s.p.alive && s.p.row === 2 && colOfX(s.p.x) >= 9, 'A15 running jump clears 2-tile pit', JSON.stringify(s.snap()));
}, PIT2_ROOM);

// 16. Running jump that falls short of a far ledge: Shift catches it
const GAP_ROOM = testLevel({
  0: room([
    '############',
    '#..........#',
    '#____...____',
    '#___________',
  ]),
});
scenario('A16 jump catch', (s) => {
  s.place(0, 1, 2, { facing: 1 });
  s.press('right');
  s.stepUntil((q) => q.p.x >= 4 * TILE_W + 20, 200);
  s.tap('up', 4);
  s.press('shift');
  s.step(60);
  s.release('right');
  const ok = s.p.state === 'hang' || (s.p.grounded && s.p.row === 2 && colOfX(s.p.x) >= 9);
  R.check(ok, 'A16 short running jump + Shift catches far ledge (or lands)', JSON.stringify(s.snap()));
  s.release('shift');
  if (s.p.state === 'hang') {
    s.tap('up', 4);
    s.waitIdle(120);
  }
  R.check(s.p.alive && s.p.row === 2 && colOfX(s.p.x) >= 8, 'A16 ends on far ledge', JSON.stringify(s.snap()));
}, GAP_ROOM);

// 17. Cross-room climb: from row 0 of the lower room into row 3 of the room above
const STACK = testLevel({
  0: room([
    '############',
    '#__________#',
    '#__________#',
    '#____.._____',
  ], { down: 1 }),
  1: room([
    '#__________#',
    '#__________#',
    '#__________#',
    '############',
  ], { up: 0 }),
}, { room: 1, col: 1, row: 0, facing: 1 });
for (const [x, f] of [[5 * TILE_W + 16, 1], [6 * TILE_W + 16, -1], [7 * TILE_W + 12, -1], [4 * TILE_W + 20, 1]]) {
  scenario(`A17 cross-room x=${x}`, (s) => {
    s.place(1, colOfX(x), 0, { x, facing: f });
    s.tap('up', 5);
    s.waitIdle(150);
    R.check(onUpper(s, 3, 0), `A17 cross-room climb from x=${x} facing ${f}`, JSON.stringify(s.snap()));
  }, STACK);
}

// 18. Closed gate on the ledge blocks climbing onto it
const GATE_ROOM = testLevel({
  0: room([
    '############',
    '#.....G_____',
    '#__________#',
    '############',
  ], {}, { gates: [{ id: 'g', col: 6, row: 1 }], plates: [] }),
});
scenario('A18 closed gate not climbable', (s) => {
  s.place(0, 5, 2, { facing: 1 });
  s.tap('up', 5);
  s.step(90);
  R.check(s.p.row === 2, 'A18 cannot climb onto a closed gate tile', JSON.stringify(s.snap()));
}, GATE_ROOM);

// ---------------------------------------------------------------- Part B
// Every upward route in every level.
let routes = 0;
for (let li = 0; li < LEVELS.length; li++) {
  const def = LEVELS[li];
  const ls = new LevelState(def);
  for (const [ridStr] of Object.entries(def.rooms)) {
    const rid = Number(ridStr);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // standable open column under a hole with a ledge beside it
        if (ls.isWall(rid, c, r) || !ls.hasFloor(rid, c, r)) continue;
        if (ls.getTile(rid, c, r) === '^') continue;
        const rm = ls.getRoom(rid);
        let tRoom = rid, tRow = r - 1;
        if (tRow < 0) { if (rm.links.up === null) continue; tRoom = rm.links.up; tRow = ROWS - 1; }
        if (ls.getTile(tRoom, c, tRow) !== '.') continue;
        for (const d of [-1, 1]) {
          const lc = c + d;
          const lch = ls.getTile(tRoom, lc, tRow);
          if (lch === '#' || !ls.hasFloor(tRoom, lc, tRow)) continue;
          if (lc >= 0 && lc < COLS && ls.getGateAt(tRoom, lc, tRow)) continue; // gate ledges vary at runtime
          routes++;
          const tag = `L${li + 1} room ${rid} col ${c} row ${r} -> ${d > 0 ? 'right' : 'left'} ledge`;
          // From the column centre facing away, and from beside the column (under the ledge)
          const starts = [[tileCenterX(c), -d]];
          const besideCol = c + d;
          if (besideCol >= 0 && besideCol < COLS && !ls.isWall(rid, besideCol, r) && ls.hasFloor(rid, besideCol, r) &&
              ls.getTile(rid, besideCol, r) !== '^' && !ls.getGateAt(rid, besideCol, r)) {
            starts.push([d > 0 ? (c + 1) * TILE_W + 14 : c * TILE_W - 14, d]);
          }
          for (const [x, f] of starts) {
            const s = new Sim(li, { noEnemies: true });
            s.place(rid, colOfX(x), r, { x, facing: f });
            s.tap('up', 5);
            s.waitIdle(160);
            const p = s.p;
            const ok = p.alive && p.grounded && p.row === tRow && p.roomId === (tRoom === rid ? rid : tRoom) ||
              (p.alive && p.grounded && p.row === tRow && p.roomId === tRoom);
            R.check(ok, `B ${tag} from x=${x.toFixed(0)} facing ${f}`, JSON.stringify(s.snap()));
          }
        }
      }
    }
  }
}
console.log(`Scanned ${routes} upward routes across ${LEVELS.length} levels.`);

process.exit(R.print() ? 0 : 1);
