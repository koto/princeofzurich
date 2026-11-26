// Level runtime: tile grid, gates, plates, loose floors, debris, slicers, items.
export const COLS = 12, ROWS = 4, TW = 32, TH = 50, FEET = 44, W = 384, H = 216, HANG_Y = 40;
export const fy = (r) => r * TH + FEET;

// Tile chars (~ = bottomless void below the map): . empty  _ floor  # wall  L loose  ^ spikes  S slicer  D exit door  M mirror
// 1-9 gate (closed by default)  a-z pressure plate
export const isPlateCh = (ch) => ch >= 'a' && ch <= 'z' && ch.length === 1;
export const isGateCh = (ch) => ch >= '1' && ch <= '9';
export const supportsCh = (ch) => ch === '_' || ch === 'L' || ch === '^' || ch === 'S' || ch === 'D' || ch === 'M' || isPlateCh(ch) || isGateCh(ch);
export const ceilingCh = (ch) => supportsCh(ch) || ch === '#';

export function slicerOpen(t, c) {
  const p = (t + c * 37) % 110;
  if (p < 40) return 1;
  if (p < 55) return 1 - (p - 40) / 15;
  if (p < 62) return 0;
  if (p < 80) return (p - 62) / 18;
  return 1;
}

export class Level {
  constructor(def, idx) {
    this.def = def; this.idx = idx; this.t = 0;
    this.rooms = {};
    this.gates = {};
    this.items = [];
    this.debris = [];
    this.rubble = [];
    this.loose = new Map();
    this.down = new Set();
    this.events = [];
    this.doorUnlocked = false; this.doorOpen = 0; this.door = null;
    this.mirror = null;
    if (def.layout) def.layout.forEach((row, i) => row.forEach((id, j) => {
      if (!id) return; const rd = def.rooms[id];
      rd.l = (row[j - 1]) || null; rd.r = (row[j + 1]) || null;
      rd.u = (def.layout[i - 1] && def.layout[i - 1][j]) || null; rd.d = (def.layout[i + 1] && def.layout[i + 1][j]) || null;
    }));
    for (const [id, rd] of Object.entries(def.rooms)) {
      const rm = { id, t: rd.t.map((s) => s.split('')), l: rd.l || null, r: rd.r || null, u: rd.u || null, d: rd.d || null, rd };
      this.rooms[id] = rm;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const ch = rm.t[r][c];
        if (isGateCh(ch)) { (this.gates[ch] = this.gates[ch] || { id: ch, open: 0, timer: 0, lock: 0, cells: [] }).cells.push({ room: id, c, r }); }
        if (ch === 'D') this.door = { room: id, c, r };
        if (ch === 'M') this.mirror = { room: id, c, r };
      }
      for (const it of rd.i || []) this.items.push({ room: id, c: it.c, r: it.r, t: it.t, taken: false });
    }
  }
  tile(rid, c, r) {
    let R = this.rooms[rid];
    if (c < 0) { if (!R.l) return '#'; R = this.rooms[R.l]; c += COLS; }
    else if (c >= COLS) { if (!R.r) return '#'; R = this.rooms[R.r]; c -= COLS; }
    if (r < 0) { if (!R.u) return '#'; R = this.rooms[R.u]; r += ROWS; }
    else if (r >= ROWS) { if (!R.d) return '~'; R = this.rooms[R.d]; r -= ROWS; }
    return R.t[r][c];
  }
  setTile(rid, c, r, ch) { this.rooms[rid].t[r][c] = ch; }
  blocks(ch) { return ch === '#' || (isGateCh(ch) && this.gates[ch].open < 0.85); }
  supports(ch) { return supportsCh(ch); }
  itemAt(room, c, r) { return this.items.find((i) => !i.taken && i.room === room && i.c === c && i.r === r); }
  stepOn(room, c, r) {
    if (this.tile(room, c, r) !== 'L') return;
    const k = room + ':' + c + ':' + r;
    if (!this.loose.has(k)) { this.loose.set(k, 0); this.events.push('shake'); }
  }
  press(ch, who) {
    const p = this.def.plates && this.def.plates[ch];
    if (!p) return;
    this.events.push('plate');
    for (const id of p.opens || []) {
      const g = this.gates[id];
      if (g) {
        const wasClosed = g.open < 0.1 && g.timer <= 0;
        g.timer = Math.max(g.timer, p.time || 720);
        if (wasClosed) this.events.push('gate');
      }
    }
    for (const id of p.closes || []) { const g = this.gates[id]; if (g) { g.timer = 0; } }
    if (p.door && !this.doorUnlocked) { this.doorUnlocked = true; this.events.push('door'); }
  }
  update(actors) {
    this.t++;
    // loose floors
    for (const [k, n] of [...this.loose]) {
      if (n >= 22) {
        this.loose.delete(k);
        const [room, c, r] = k.split(':'); const cc = +c, rr = +r;
        if (this.tile(room, cc, rr) === 'L') {
          const riders = new Set(actors.filter((a) => !a.dead && a.room === room && Math.abs(a.x - (cc * TW + TW / 2)) < 22 && a.row() === rr));
          this.setTile(room, cc, rr, '.');
          this.debris.push({ room, x: cc * TW + TW / 2, y: fy(rr), vy: 0.5, riders });
          this.events.push('crash0');
        }
      } else this.loose.set(k, n + 1);
    }
    // debris
    const pressed = new Set();
    for (const d of [...this.debris]) {
      const py = d.y; d.vy = Math.min(5, d.vy + 0.25); d.y += d.vy;
      let landed = false;
      const c = Math.floor(d.x / TW);
      for (let k = Math.floor(py / TH); k <= Math.floor(d.y / TH) && !landed; k++) {
        if (py < fy(k) && fy(k) <= d.y && this.supports(this.tile(d.room, c, k))) {
          landed = true; d.y = fy(k);
          for (const a of actors) if (!a.dead && (!d.riders || !d.riders.has(a)) && a.room === d.room && Math.abs(a.x - d.x) < 12 && Math.abs(a.y - fy(k)) < 24 && a.row() === k) a.hurtBy('debris');
          const ch = this.tile(d.room, c, k);
          if (isPlateCh(ch)) pressed.add(d.room + ':' + c + ':' + k + ':' + ch);
          if (k >= 0 && k < ROWS) this.rubble.push({ room: d.room, c, r: k, x: d.x });
          this.events.push('crash1');
        }
      }
      if (landed) this.debris.splice(this.debris.indexOf(d), 1);
      else if (d.y >= H - 16) { const R = this.rooms[d.room]; if (R.d) { d.room = R.d; d.y -= ROWS * TH; } else this.debris.splice(this.debris.indexOf(d), 1); }
    }
    // plates (actors standing on them + rubble resting on them)
    const now = new Set();
    for (const a of actors) {
      if (a.dead || !a.onGround()) continue;
      const c = a.col(), r = a.row(); const ch = this.tile(a.room, c, r);
      if (isPlateCh(ch)) now.add(a.room + ':' + c + ':' + r + ':' + ch);
    }
    for (const rb of this.rubble) {
      const ch = this.tile(rb.room, rb.c, rb.r);
      if (isPlateCh(ch)) now.add(rb.room + ':' + rb.c + ':' + rb.r + ':' + ch);
    }
    for (const k of pressed) now.add(k);
    for (const k of now) {
      const ch = k.split(':')[3];
      if (!this.down.has(k)) this.press(ch, null);
      else {
        const p = this.def.plates && this.def.plates[ch];
        if (p && p.opens) for (const id of p.opens) { const g = this.gates[id]; if (g && g.lock <= 0) g.timer = Math.max(g.timer, 8); }
      }
    }
    this.down = now;
    // gates
    const heroRoom = actors[0] && actors[0].room;
    for (const g of Object.values(this.gates)) {
      if (g.lock > 0) { g.lock--; g.open = Math.max(0, g.open - 0.08); continue; }
      if (g.timer > 0) {
        g.timer--; g.open = Math.min(1, g.open + 0.03);
        if (g.timer > 0 && g.timer <= 90 && g.timer % 25 === 0 && heroRoom && g.cells.some((q) => q.room === heroRoom)) this.events.push('tick');
      } else if (g.open > 0) {
        const occupied = actors.some((a) => !a.dead && g.cells.some((q) => q.room === a.room && q.c === a.col() && q.r === a.row()));
        if (!occupied) { const was = g.open; g.open = Math.max(0, g.open - 0.025); if (was >= 0.5 && g.open < 0.5) this.events.push('gateclose'); }
      }
    }
    // slicer snap audio for hero's current room
    if (heroRoom && this.rooms[heroRoom]) {
      const R = this.rooms[heroRoom];
      let snapped = false;
      for (let r = 0; r < ROWS && !snapped; r++) for (let c = 0; c < COLS && !snapped; c++) {
        if (R.t[r][c] === 'S' && (this.t + c * 37) % 110 === 51) snapped = true;
      }
      if (snapped) this.events.push('slicer');
    }
    if (this.doorUnlocked) this.doorOpen = Math.min(1, this.doorOpen + 0.02);
  }
  slicerLethal(c) { return slicerOpen(this.t, c) < 0.3; }
}
