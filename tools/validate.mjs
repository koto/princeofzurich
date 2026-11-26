#!/usr/bin/env node
// tools/validate.mjs
// Validates all 10 levels:
//  1. Grid dimensions, link symmetry, plate/gate/exit consistency
//  2. No '.' directly above '#' (prevents invisible floors over visual pits)
//  3. No fatal >=3-floor drops onto walkable floors in linked lower rooms (catches broken recovery pits)
//  4. Coarse reachability BFS from start -> plates (incl. vertical falling-debris triggers & tailwind jumps) -> gates -> exit
//  5. Return-reachability (soft-lock check): from EVERY reachable non-lethal tile, the exit must remain reachable!

import { LEVELS } from '../src/levels/index.js';
import { COLS, ROWS, isWalkableBaseTile } from '../src/level.js';

let totalErrors = 0;

function error(levelName, msg) {
  console.error(`  [ERROR] ${levelName}: ${msg}`);
  totalErrors++;
}

function tileAt(level, roomId, c, r) {
  const rm = level.rooms[roomId];
  if (!rm) return '#';
  if (c < 0) {
    if (rm.links?.left != null) return tileAt(level, rm.links.left, COLS + c, r);
    return '#';
  }
  if (c >= COLS) {
    if (rm.links?.right != null) return tileAt(level, rm.links.right, c - COLS, r);
    return '#';
  }
  if (r < 0) {
    if (rm.links?.up != null) return tileAt(level, rm.links.up, c, ROWS + r);
    return '#';
  }
  if (r >= ROWS) {
    if (rm.links?.down != null) return tileAt(level, rm.links.down, c, r - ROWS);
    return '.';
  }
  return rm.grid[r][c];
}

function hasFloor(level, roomId, c, r) {
  return isWalkableBaseTile(tileAt(level, roomId, c, r));
}

function resolvePos(level, roomId, c, r) {
  let rid = roomId;
  let cc = c;
  let rr = r;
  while (cc < 0) {
    const nxt = level.rooms[rid]?.links?.left;
    if (nxt == null) return null;
    rid = nxt;
    cc += COLS;
  }
  while (cc >= COLS) {
    const nxt = level.rooms[rid]?.links?.right;
    if (nxt == null) return null;
    rid = nxt;
    cc -= COLS;
  }
  while (rr < 0) {
    const nxt = level.rooms[rid]?.links?.up;
    if (nxt == null) return null;
    rid = nxt;
    rr += ROWS;
  }
  while (rr >= ROWS) {
    const nxt = level.rooms[rid]?.links?.down;
    if (nxt == null) return null;
    rid = nxt;
    rr -= ROWS;
  }
  return { roomId: rid, c: cc, r: rr };
}

function getNeighbors(level, cur, gateMap, unlocked) {
  const out = [];
  const add = (pos) => {
    if (!pos) return;
    const ch = tileAt(level, pos.roomId, pos.c, pos.r);
    if (ch === '#' || !hasFloor(level, pos.roomId, pos.c, pos.r)) return;
    const gid = gateMap.get(`${pos.roomId},${pos.c},${pos.r}`);
    if (gid && !unlocked.has(gid)) return;
    out.push(pos);
  };

  // A. Walk left/right 1 tile (or step off into 1-2 floor drop)
  for (const dir of [-1, 1]) {
    const next = resolvePos(level, cur.roomId, cur.c + dir, cur.r);
    if (next) {
      const ch = tileAt(level, next.roomId, next.c, next.r);
      if (ch !== '#') {
        if (hasFloor(level, next.roomId, next.c, next.r)) {
          add(next);
        } else {
          let drop = next;
          for (let f = 1; f <= 2; f++) {
            drop = resolvePos(level, drop.roomId, drop.c, drop.r + 1);
            if (!drop) break;
            const dch = tileAt(level, drop.roomId, drop.c, drop.r);
            if (dch === '#') break;
            if (hasFloor(level, drop.roomId, drop.c, drop.r)) {
              if (dch !== '^') add(drop);
              break;
            }
          }
        }
      }
    }
  }

  // B. Drop through loose floor directly underneath
  if (tileAt(level, cur.roomId, cur.c, cur.r) === 'L') {
    let drop = cur;
    for (let f = 1; f <= 2; f++) {
      drop = resolvePos(level, drop.roomId, drop.c, drop.r + 1);
      if (!drop) break;
      const dch = tileAt(level, drop.roomId, drop.c, drop.r);
      if (dch === '#') break;
      if (hasFloor(level, drop.roomId, drop.c, drop.r)) {
        if (dch !== '^') add(drop);
        break;
      }
    }
  }

  // C. Standing jump (clears 1 tile), Running jump (clears 2 tiles), & Tailwind jump (clears 3 tiles in wind.dir!)
  const curRoom = level.rooms[cur.roomId];
  for (const dir of [-1, 1]) {
    const spans = [2, 3];
    if (curRoom?.wind && curRoom.wind.dir === dir) spans.push(4);
    for (const span of spans) {
      let clear = true;
      for (let step = 1; step < span; step++) {
        const mid = resolvePos(level, cur.roomId, cur.c + dir * step, cur.r);
        if (!mid) { clear = false; break; }
        const mch = tileAt(level, mid.roomId, mid.c, mid.r);
        const mgid = gateMap.get(`${mid.roomId},${mid.c},${mid.r}`);
        if (mch === '#' || (mgid && !unlocked.has(mgid))) { clear = false; break; }
      }
      if (!clear) continue;
      const land = resolvePos(level, cur.roomId, cur.c + dir * span, cur.r);
      if (land) add(land);
    }
  }

  // D. Jump up & grab ledge (above tile is '.' or breakable loose floor 'L', adjacent tile at r-1 has floor)
  const above = resolvePos(level, cur.roomId, cur.c, cur.r - 1);
  if (above) {
    const ach = tileAt(level, above.roomId, above.c, above.r);
    if (ach === '.' || ach === 'L') {
      for (const dir of [-1, 1]) {
        const ledge = resolvePos(level, above.roomId, above.c + dir, above.r);
        if (ledge) add(ledge);
      }
    }
  }

  return out;
}

function validateLevel(level) {
  const tag = `Level ${level.id + 1} (${level.name})`;
  const roomIds = Object.keys(level.rooms).map(Number);
  console.log(`Checking ${tag} — ${roomIds.length} rooms...`);

  if (roomIds.length < 8 || roomIds.length > 14) {
    error(tag, `Room count ${roomIds.length} outside expected range 8..14`);
  }

  // 1. Check grid sizes, link symmetry, no '.' over '#', and plates/gates/exits
  const opp = { left: 'right', right: 'left', up: 'down', down: 'up' };
  const allPlates = [];
  const allGates = [];
  const allExits = [];
  let multiFloorRooms = 0;

  for (const rid of roomIds) {
    const rm = level.rooms[rid];
    if (!rm.grid || rm.grid.length !== ROWS) {
      error(tag, `Room ${rid}: grid must have ${ROWS} rows`);
      continue;
    }
    const floorsUsed = new Set();
    for (let r = 0; r < ROWS; r++) {
      if (rm.grid[r].length !== COLS) {
        error(tag, `Room ${rid} row ${r}: length ${rm.grid[r].length} !== ${COLS}`);
      }
      for (let c = 0; c < COLS; c++) {
        const ch = rm.grid[r][c];
        if (isWalkableBaseTile(ch)) floorsUsed.add(r);
        // No '.' or 'L' directly above '#' (causes invisible floor / falling through wall block)
        if ((ch === '.' || ch === 'L') && r + 1 < ROWS && rm.grid[r + 1][c] === '#') {
          error(tag, `Room ${rid} (${c},${r}): '${ch}' sits directly above '#' (use '_' or align shaft)`);
        }
      }
    }
    if (floorsUsed.size >= 2) multiFloorRooms++;

    // Link symmetry
    for (const dir of ['left', 'right', 'up', 'down']) {
      const target = rm.links?.[dir];
      if (target != null) {
        const other = level.rooms[target];
        if (!other) {
          error(tag, `Room ${rid}.links.${dir} points to missing room ${target}`);
        } else if (other.links?.[opp[dir]] !== rid) {
          error(tag, `Asymmetric link: Room ${rid}.${dir}=${target}, but Room ${target}.${opp[dir]}=${other.links?.[opp[dir]]}`);
        }
      }
    }

    if (rm.plates) {
      for (const p of rm.plates) {
        const ch = rm.grid[p.row]?.[p.col];
        if (ch !== 'P' && ch !== 'Q') {
          error(tag, `Room ${rid}: plate at (${p.col},${p.row}) has tile '${ch}' instead of P/Q`);
        }
        allPlates.push({ roomId: rid, ...p });
      }
    }

    if (rm.gates) {
      for (const g of rm.gates) {
        const ch = rm.grid[g.row]?.[g.col];
        if (ch !== 'G') {
          error(tag, `Room ${rid}: gate '${g.id}' at (${g.col},${g.row}) has tile '${ch}' instead of G`);
        }
        allGates.push({ roomId: rid, ...g });
      }
    }

    if (rm.exits) {
      for (const ex of rm.exits) {
        const ch = rm.grid[ex.row]?.[ex.col];
        if (ch !== 'E') {
          error(tag, `Room ${rid}: exit '${ex.id}' at (${ex.col},${ex.row}) has tile '${ch}' instead of E`);
        }
        allExits.push({ roomId: rid, ...ex });
      }
    }
  }

  // 2. Start & Exit exist
  if (!level.start || !level.rooms[level.start.room]) {
    error(tag, 'Missing or invalid start room');
  } else {
    const s = level.start;
    if (!hasFloor(level, s.room, s.col, s.row) || tileAt(level, s.room, s.col, s.row) === '#') {
      error(tag, `Start position (${s.room}: ${s.col},${s.row}) is not a valid floor`);
    }
  }

  if (allExits.length === 0) {
    error(tag, 'No exit door defined');
  }

  // 3. Every gate and exit has an opening plate
  const openPlateTargets = new Set();
  for (const p of allPlates) {
    if (p.action !== 'close') {
      const targets = Array.isArray(p.targetId) ? p.targetId : [p.targetId];
      for (const t of targets) openPlateTargets.add(t);
    }
  }
  for (const g of allGates) {
    if (!openPlateTargets.has(g.id)) {
      error(tag, `Gate '${g.id}' in Room ${g.roomId} has no opening pressure plate`);
    }
  }
  for (const ex of allExits) {
    if (!openPlateTargets.has(ex.id)) {
      error(tag, `Exit '${ex.id}' in Room ${ex.roomId} has no opening pressure plate`);
    }
  }

  // 4. Coarse reachability BFS from start -> open plates -> gates -> exit
  const unlocked = new Set();
  for (const g of allGates) {
    if (g.initiallyOpen) unlocked.add(g.id);
  }
  const gateMap = new Map(allGates.map((g) => [`${g.roomId},${g.col},${g.row}`, g.id]));
  const plateMap = new Map(allPlates.filter((p) => p.action !== 'close').map((p) => [`${p.roomId},${p.col},${p.row}`, p]));

  let visited = new Map();
  let changed = true;

  while (changed) {
    changed = false;
    visited = new Map();
    const startPos = { roomId: level.start.room, c: level.start.col, r: level.start.row };
    const startKey = `${startPos.roomId},${startPos.c},${startPos.r}`;
    visited.set(startKey, startPos);
    const queue = [startPos];

    while (queue.length > 0) {
      const cur = queue.shift();
      const k = `${cur.roomId},${cur.c},${cur.r}`;

      const pl = plateMap.get(k);
      if (pl) {
        const targets = Array.isArray(pl.targetId) ? pl.targetId : [pl.targetId];
        for (const tid of targets) {
          if (!unlocked.has(tid)) {
            unlocked.add(tid);
            changed = true;
          }
        }
      }

      // Vertical falling-debris trigger: if standing on 'L' OR standing directly under 'L' (bump!),
      // trace falling slab down through '.' / chained 'L' to see if it depresses a lower 'P' plate!
      const triggerDebrisFrom = (startPos) => {
        let curD = startPos;
        for (let step = 0; step < 12; step++) {
          curD = resolvePos(level, curD.roomId, curD.c, curD.r + 1);
          if (!curD) break;
          const dch = tileAt(level, curD.roomId, curD.c, curD.r);
          if (dch === '#') break;
          if (dch === '.' || dch === 'L') continue;
          const dpl = plateMap.get(`${curD.roomId},${curD.c},${curD.r}`);
          if (dpl) {
            const targets = Array.isArray(dpl.targetId) ? dpl.targetId : [dpl.targetId];
            for (const tid of targets) {
              if (!unlocked.has(tid)) {
                unlocked.add(tid);
                changed = true;
              }
            }
          }
          break;
        }
      };
      if (tileAt(level, cur.roomId, cur.c, cur.r) === 'L') {
        triggerDebrisFrom(cur);
      }
      const overhead = resolvePos(level, cur.roomId, cur.c, cur.r - 1);
      if (overhead && tileAt(level, overhead.roomId, overhead.c, overhead.r) === 'L') {
        triggerDebrisFrom(overhead);
      }

      for (const nb of getNeighbors(level, cur, gateMap, unlocked)) {
        const nk = `${nb.roomId},${nb.c},${nb.r}`;
        if (!visited.has(nk)) {
          visited.set(nk, nb);
          queue.push(nb);
        }
      }
    }
  }

  // Verify exit door is both reachable AND unlocked
  for (const ex of allExits) {
    const ek = `${ex.roomId},${ex.col},${ex.row}`;
    if (!visited.has(ek)) {
      error(tag, `Exit '${ex.id}' at Room ${ex.roomId} (${ex.col},${ex.row}) is NOT reachable from start!`);
    }
    if (!unlocked.has(ex.id)) {
      error(tag, `Exit '${ex.id}' plate is NOT reachable from start!`);
    }
  }

  // Verify all sword items are reachable (if level starts without sword)
  if (!level.start.hasSword) {
    let foundSword = false;
    for (const rid of roomIds) {
      for (const it of level.rooms[rid].items || []) {
        if (it.type === 'sword' && visited.has(`${rid},${it.col},${it.row}`)) {
          foundSword = true;
        }
      }
    }
    if (!foundSword) {
      error(tag, 'Level starts unarmed, but no sword pickup is reachable!');
    }
  }

  // 5. Fatal cross-room drop check: flag any pit/loose drop from a reachable tile that falls >= 3 floors
  //    onto a walkable floor in a linked lower room (classic broken recovery-pit bug!)
  for (const pos of visited.values()) {
    const checkDropFrom = (startDropPos) => {
      let cur = startDropPos;
      for (let f = 1; f <= 8; f++) {
        cur = resolvePos(level, cur.roomId, cur.c, cur.r + 1);
        if (!cur) break;
        const dch = tileAt(level, cur.roomId, cur.c, cur.r);
        if (dch === '#') break;
        if (hasFloor(level, cur.roomId, cur.c, cur.r)) {
          if (f >= 3 && cur.roomId !== pos.roomId) {
            error(tag, `Fatal ${f}-floor drop from Room ${pos.roomId} (${pos.c},${pos.r}) lands on walkable floor in Room ${cur.roomId} (${cur.c},${cur.r})`);
          }
          break;
        }
      }
    };
    if (tileAt(level, pos.roomId, pos.c, pos.r) === 'L') {
      checkDropFrom(pos);
    }
    for (const dir of [-1, 1]) {
      const next = resolvePos(level, pos.roomId, pos.c + dir, pos.r);
      if (next && tileAt(level, next.roomId, next.c, next.r) === '.') {
        checkDropFrom(next);
      }
    }
  }

  // 6. Return-reachability (soft-lock check):
  //    Build reverse graph on all visited tiles (with unlocked mechanisms) and ensure EVERY
  //    reachable non-spike tile can reach at least one exit door!
  if (allExits.length > 0) {
    const rev = new Map();
    for (const k of visited.keys()) rev.set(k, []);
    for (const [k, pos] of visited.entries()) {
      for (const nb of getNeighbors(level, pos, gateMap, unlocked)) {
        const nk = `${nb.roomId},${nb.c},${nb.r}`;
        if (rev.has(nk)) rev.get(nk).push(k);
      }
    }
    const canReachExit = new Set();
    const rq = [];
    for (const ex of allExits) {
      const ek = `${ex.roomId},${ex.col},${ex.row}`;
      if (visited.has(ek)) {
        canReachExit.add(ek);
        rq.push(ek);
      }
    }
    while (rq.length > 0) {
      const cur = rq.shift();
      for (const prev of rev.get(cur) || []) {
        if (!canReachExit.has(prev)) {
          canReachExit.add(prev);
          rq.push(prev);
        }
      }
    }
    for (const [k, pos] of visited.entries()) {
      if (tileAt(level, pos.roomId, pos.c, pos.r) === '^') continue;
      if (!canReachExit.has(k)) {
        error(tag, `SOFT-LOCK: Reachable tile Room ${pos.roomId} (${pos.c},${pos.r}) cannot reach the Exit Door!`);
      }
    }
  }

  // 7. Verify all rooms with items/enemies are actually reachable
  for (const rid of roomIds) {
    const rm = level.rooms[rid];
    const hasContent = (rm.items && rm.items.length > 0) || (rm.enemies && rm.enemies.length > 0);
    if (hasContent) {
      let roomReached = false;
      for (const pos of visited.values()) {
        if (pos.roomId === rid) { roomReached = true; break; }
      }
      if (!roomReached) {
        error(tag, `Room ${rid} has items/enemies but is completely unreachable from start!`);
      }
    }
  }

  console.log(`  Reachable tiles: ${visited.size}, Multi-floor rooms: ${multiFloorRooms}/${roomIds.length}, Unlocked: [${[...unlocked].join(', ')}]`);
}

for (const lvl of LEVELS) {
  validateLevel(lvl);
}

if (totalErrors > 0) {
  console.error(`\nVALIDATION FAILED with ${totalErrors} error(s).`);
  process.exit(1);
} else {
  console.log(`\nALL ${LEVELS.length} LEVELS PASSED VALIDATION!`);
}
