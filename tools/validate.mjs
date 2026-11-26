// Validates every level: structure, links, plates/gates/exit, and a coarse reachability check.
import { Level, COLS, ROWS, supportsCh, ceilingCh, isGateCh, isPlateCh } from '../src/level.js';
import l1 from '../src/levels/l1.js'; import l2 from '../src/levels/l2.js'; import l3 from '../src/levels/l3.js';
import l4 from '../src/levels/l4.js'; import l5 from '../src/levels/l5.js';

const defs = [l1, l2, l3, l4, l5];
let bad = 0;
const err = (i, m) => { bad++; console.log(`  FAIL L${i + 1}: ${m}`); };

defs.forEach((def, i) => {
  const L = new Level(def, i);
  const ids = Object.keys(L.rooms);
  console.log(`Level ${i + 1} ${def.name}: ${ids.length} rooms`);
  if (ids.length < 8 || ids.length > 14) err(i, 'room count out of 8..14');
  for (const id of ids) {
    const R = L.rooms[id];
    if (R.t.length !== ROWS || R.t.some((r) => r.length !== COLS)) err(i, `room ${id} wrong dimensions`);
    for (const [k, o] of [['l', 'r'], ['r', 'l'], ['u', 'd'], ['d', 'u']]) {
      if (R[k]) { if (!L.rooms[R[k]]) err(i, `${id}.${k} -> missing ${R[k]}`); else if (L.rooms[R[k]][o] !== id) err(i, `asymmetric link ${id}.${k}`); }
    }
    for (const g of (R.rd.g || [])) if (!supportsCh(R.t[g.r][g.c])) err(i, `guard in ${id} not on floor`);
    for (const it of (R.rd.i || [])) if (!supportsCh(R.t[it.r][it.c])) err(i, `item in ${id} not on floor`);
  }
  const s = def.start;
  if (!L.rooms[s.room] || !supportsCh(L.rooms[s.room].t[s.r][s.c])) err(i, 'start missing or not on floor');
  if (!L.door) err(i, 'no exit door');
  // gates need plates, door needs plate
  const plateDefs = def.plates || {};
  for (const gid of Object.keys(L.gates)) if (!Object.values(plateDefs).some((p) => (p.opens || []).includes(gid))) err(i, `gate ${gid} has no plate`);
  if (!Object.values(plateDefs).some((p) => p.door)) err(i, 'exit door has no plate');
  const plateTiles = {};
  for (const id of ids) L.rooms[id].t.forEach((row, r) => row.forEach((ch, c) => { if (isPlateCh(ch)) { (plateTiles[ch] = plateTiles[ch] || []).push([id, c, r]); } }));
  for (const ch of Object.keys(plateDefs)) if (!plateTiles[ch]) err(i, `plate ${ch} defined but not placed`);
  for (const ch of Object.keys(plateTiles)) if (!plateDefs[ch]) err(i, `plate tile ${ch} has no definition`);

  // coarse reachability
  const norm = (room, c, r) => {
    let R = L.rooms[room];
    if (c < 0) { if (!R.l) return null; room = R.l; c += COLS; } else if (c >= COLS) { if (!R.r) return null; room = R.r; c -= COLS; }
    R = L.rooms[room];
    if (r < 0) { if (!R.u) return null; room = R.u; r += ROWS; } else if (r >= ROWS) { if (!R.d) return null; room = R.d; r -= ROWS; }
    return [room, c, r];
  };
  const T = (room, c, r) => L.tile(room, c, r);
  const key = (n) => n.join(':');
  const seen = new Set(); const q = [[s.room, s.c, s.r]]; seen.add(key(q[0]));
  const add = (n) => { if (n && !seen.has(key(n))) { seen.add(key(n)); q.push(n); } };
  const stand = (room, c, r) => { const t = T(room, c, r); return supportsCh(t); };
  while (q.length) {
    const [room, c, r] = q.shift();
    for (const d of [-1, 1]) {
      const a = T(room, c + d, r);
      if (a === '#') continue;
      if (supportsCh(a)) { add(norm(room, c + d, r)); }
      else {
        // gaps: jump over up to 2 tiles
        for (let g = 1; g <= 2; g++) {
          const m = T(room, c + d * g, r); if (supportsCh(m) || m === '#') break;
          const t2 = T(room, c + d * (g + 1), r);
          if (supportsCh(t2) && t2 !== '#') add(norm(room, c + d * (g + 1), r));
        }
        // drop / climb down: land on first floor below (max 2 floors)
        const n0 = norm(room, c + d, r);
        if (n0) for (let k = 1; k <= 3; k++) { const t = T(n0[0], n0[1], n0[2] + k); if (t === '~' || t === 'v') break; if (supportsCh(t)) { if (k <= 2) add(norm(n0[0], n0[1], n0[2] + k)); break; } }
        // climb up: open above, ledge ahead one row up
        if (!ceilingCh(T(room, c, r - 1)) && supportsCh(T(room, c + d, r - 1)) && T(room, c + d, r - 1) !== '#') add(norm(room, c + d, r - 1));
      }
      // climb up also when neighbour is floor-level (ledge adjacent above)
      if (!ceilingCh(T(room, c, r - 1)) && supportsCh(T(room, c + d, r - 1)) && T(room, c + d, r - 1) !== '#') add(norm(room, c + d, r - 1));
    }
    // fall in place through this tile cannot happen (it supports)
  }
  if (!seen.has(key([L.door.room, L.door.c, L.door.r]))) err(i, 'exit door NOT reachable from start');
  for (const ch of Object.keys(plateTiles)) if (!plateTiles[ch].some(([rm, c, r]) => seen.has(key([rm, c, r])))) err(i, `plate ${ch} NOT reachable`);
  for (const id of ids) for (const g of (L.rooms[id].rd.g || [])) { /* guards may be anywhere */ }
  console.log(`  reachable cells: ${seen.size}`);
});
console.log(bad ? `\n${bad} problem(s)` : '\nAll levels OK');
process.exit(bad ? 1 : 0);
